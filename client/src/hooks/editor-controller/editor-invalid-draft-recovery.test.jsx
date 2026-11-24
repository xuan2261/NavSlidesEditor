import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCallback, useState } from 'react'
import { createDefaultGameConfig, normalizePresentationGames } from 'revealjs-shared'
import { api } from '../../utils/api'
import { usePresentationStore } from '../../stores/presentation-store'
import { useEditorPersistenceController } from './use-editor-persistence-controller'
import { clearEditorDraft, readEditorDraft, writeEditorDraft } from '../../utils/editor-draft-store'

vi.mock('../../utils/api', () => ({
  api: {
    getPresentation: vi.fn(),
    getTemplate: vi.fn(),
    updatePresentation: vi.fn(),
    updateTemplate: vi.fn(),
  },
}))
vi.mock('../../utils/editor-draft-store', () => ({
  clearEditorDraft: vi.fn().mockResolvedValue(true),
  readEditorDraft: vi.fn().mockResolvedValue(null),
  writeEditorDraft: vi.fn().mockResolvedValue(true),
  createEditorDraft: vi.fn(({ snapshot, attemptId, draftId }) => ({
    id: snapshot.id,
    snapshot,
    attemptId,
    draftId,
    updatedAt: attemptId,
    idempotencyKey: snapshot.idempotencyKey,
  })),
}))

const noop = () => {}
const deck = (game) => ({
  id: 'deck-1',
  title: 'Authored draft',
  aggregateGeneration: 1,
  slides: [
    {
      id: 'slide-1',
      elements: [
        { id: 'text-1', type: 'text', content: '<p>Keep my authored explanation</p>' },
        ...(game ? [game] : []),
      ],
    },
  ],
})
function incomplete(type) {
  const config = createDefaultGameConfig(type)
  if (type === 'poll') config.options = [{ id: 'only-option', text: 'Authored choice' }]
  else config.dailyDouble = ['deleted-cell']
  return { id: 'game-1', type: 'game', gameType: type, [type]: config, gameStatus: 'active' }
}
function repair(snapshot) {
  const next = structuredClone(snapshot)
  const game = next.slides[0].elements[1]
  if (game.gameType === 'poll') game.poll.options.push({ id: 'added-option', text: 'New choice' })
  else game.jeopardy.dailyDouble = []
  return next
}
function useHarness() {
  const [presentation, updatePresentation] = useState(null)
  const setPresentation = useCallback((value) => {
    updatePresentation(value)
    usePresentationStore.getState().setPresentation(value)
  }, [])
  const controller = useEditorPersistenceController({
    presentation,
    setPresentation,
    presentationId: 'deck-1',
    isTemplate: false,
    setGridSize: noop,
    seedHistory: noop,
    resetEditorInteraction: noop,
  })
  return { presentation, setPresentation, controller }
}
const settle = () =>
  act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
const manualSave = async (result, snapshot) => {
  act(() => result.current.setPresentation(snapshot))
  act(() => result.current.controller.handleManualSave())
  await settle()
}

describe('editor invalid draft save recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.updatePresentation.mockReset().mockResolvedValue({ aggregateGeneration: 2 })
    readEditorDraft.mockReset().mockResolvedValue(null)
    writeEditorDraft.mockReset().mockResolvedValue(true)
    usePresentationStore.setState({ presentation: null, saveConflict: null })
    api.getPresentation.mockResolvedValue(deck())
  })

  it('saves a corrected successor after local normalization rejects the invalid snapshot', async () => {
    const { result } = renderHook(useHarness)
    await settle()
    const invalid = deck(incomplete('poll'))
    await manualSave(result, invalid)
    expect(result.current.controller.saveStatus).toBe('error')
    expect(api.updatePresentation).not.toHaveBeenCalled()
    expect(clearEditorDraft).not.toHaveBeenCalled()
    expect(
      writeEditorDraft.mock.calls.at(-1)[0].snapshot.slides[0].elements[1].poll.options
    ).toEqual(invalid.slides[0].elements[1].poll.options)

    await manualSave(result, repair(invalid))
    expect(api.updatePresentation).toHaveBeenCalledTimes(1)
    const saved = api.updatePresentation.mock.calls[0][1]
    expect(saved.slides[0].elements[1].poll.options).toEqual([
      { id: 'only-option', text: 'Authored choice' },
      { id: 'added-option', text: 'New choice' },
    ])
    expect(saved.slides[0].elements[0].content).toBe('<p>Keep my authored explanation</p>')
    expect(result.current.controller.saveStatus).toBe('saved')
    expect(usePresentationStore.getState().presentation.aggregateGeneration).toBe(2)
  })

  it('advances to a queued correction when the rejected local snapshot finishes draft storage', async () => {
    const { result } = renderHook(useHarness)
    await settle()
    let finishDraft
    writeEditorDraft.mockImplementation((draft) =>
      draft.snapshot.slides[0].elements[1]?.poll?.options.length === 1
        ? new Promise((resolve) => {
            finishDraft = resolve
          })
        : Promise.resolve(true)
    )
    const invalid = deck(incomplete('poll'))
    act(() => result.current.setPresentation(invalid))
    act(() => result.current.controller.handleManualSave())
    act(() => result.current.setPresentation(repair(invalid)))
    act(() => result.current.controller.handleManualSave())
    await act(async () => {
      finishDraft(true)
    })
    await settle()
    expect(api.updatePresentation).toHaveBeenCalledTimes(1)
    expect(api.updatePresentation.mock.calls[0][1].slides[0].elements[1].poll.options).toEqual(
      repair(invalid).slides[0].elements[1].poll.options
    )
    expect(result.current.controller.saveStatus).toBe('saved')
  })

  it('retries an uncertain remote body with its original key before the corrected successor', async () => {
    api.updatePresentation
      .mockRejectedValueOnce(new Error('connection interrupted'))
      .mockResolvedValueOnce({ aggregateGeneration: 2 })
      .mockResolvedValueOnce({ aggregateGeneration: 3 })
    const { result } = renderHook(useHarness)
    await settle()
    const original = repair(deck(incomplete('poll')))
    await manualSave(result, original)
    const first = structuredClone(api.updatePresentation.mock.calls[0][1])
    const successor = structuredClone(original)
    successor.slides[0].elements[1].poll.prompt = 'Corrected prompt'
    await manualSave(result, successor)
    expect(api.updatePresentation).toHaveBeenCalledTimes(3)
    expect(api.updatePresentation.mock.calls[1][1]).toEqual(first)
    expect(api.updatePresentation.mock.calls[2][1]).toMatchObject({ aggregateGeneration: 2 })
    expect(api.updatePresentation.mock.calls[2][1].idempotencyKey).not.toBe(first.idempotencyKey)
    expect(usePresentationStore.getState().presentation.aggregateGeneration).toBe(3)
  })

  it('replays a retained write at its original generation after the remote head has advanced', async () => {
    const snapshot = { ...deck(), title: 'Retained edit', idempotencyKey: 'retained-key' }
    readEditorDraft.mockResolvedValueOnce({ id: snapshot.id, snapshot, attemptId: 7 })
    api.getPresentation.mockResolvedValueOnce({ ...deck(), aggregateGeneration: 2 })
    api.updatePresentation.mockImplementation(async (_id, payload) => {
      if (payload.idempotencyKey === 'retained-key' && payload.aggregateGeneration !== 1) {
        throw Object.assign(new Error('Idempotency key reused with another body'), {
          status: 409,
          reason: 'IDEMPOTENCY_KEY_REUSED',
        })
      }
      return { aggregateGeneration: payload.idempotencyKey === 'retained-key' ? 2 : 3 }
    })
    const { result } = renderHook(useHarness)
    await settle()
    act(() => result.current.controller.recoverLocalDraft())
    await settle()
    expect(result.current.controller.saveStatus).toBe('saved')
    expect(result.current.presentation.title).toBe('Retained edit')
    expect(usePresentationStore.getState().presentation.aggregateGeneration).toBe(2)
    await manualSave(result, { ...result.current.presentation, title: 'Successor edit' })
    expect(api.updatePresentation.mock.calls[1][1]).toMatchObject({
      title: 'Successor edit',
      aggregateGeneration: 2,
    })
    expect(api.updatePresentation.mock.calls[1][1].idempotencyKey).not.toBe('retained-key')
    expect(usePresentationStore.getState().presentation.aggregateGeneration).toBe(3)
  })

  it.each(['poll', 'jeopardy'])(
    'restores an incomplete canonical %s draft and saves its repair',
    async (type) => {
      const snapshot = { ...deck(incomplete(type)), idempotencyKey: 'recovered-key' }
      readEditorDraft.mockResolvedValueOnce({ id: snapshot.id, snapshot, attemptId: 7 })
      const { result } = renderHook(useHarness)
      await settle()
      act(() => result.current.controller.recoverLocalDraft())
      await settle()
      const restored = result.current.presentation
      expect(restored.slides[0].elements[0]).toEqual(snapshot.slides[0].elements[0])
      expect(restored.slides[0].elements[1][type]).toEqual(snapshot.slides[0].elements[1][type])
      expect(restored.slides[0].elements[1].gameStatus).toBeUndefined()
      expect(() => normalizePresentationGames(restored)).toThrow()
      expect(api.updatePresentation).not.toHaveBeenCalled()
      expect(clearEditorDraft).not.toHaveBeenCalled()
      expect(result.current.controller.saveStatus).toBe('error')
      await manualSave(result, repair(restored))
      expect(api.updatePresentation).toHaveBeenCalledTimes(1)
      expect(result.current.controller.saveStatus).toBe('saved')
      expect(usePresentationStore.getState().presentation.aggregateGeneration).toBe(2)
    }
  )
})

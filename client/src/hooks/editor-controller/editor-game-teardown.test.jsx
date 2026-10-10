import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultGameConfig } from 'revealjs-shared'
import { api } from '../../utils/api'
import { usePresentationStore } from '../../stores/presentation-store'
import { useEditorSaveController } from './use-editor-save-controller'
import { clearEditorDraft, writeEditorDraft } from '../../utils/editor-draft-store'

vi.mock('../../utils/api', () => ({
  api: { updatePresentation: vi.fn(), updateTemplate: vi.fn() },
}))
vi.mock('../../utils/editor-draft-store', () => ({
  clearEditorDraft: vi.fn().mockResolvedValue(true),
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
const deck = (game) => ({
  id: 'deck-1',
  title: 'Teardown draft',
  aggregateGeneration: 1,
  slides: [{ id: 'slide-1', elements: [game] }],
})
const settle = () =>
  act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })

beforeEach(() => {
  vi.clearAllMocks()
  api.updatePresentation.mockReset().mockResolvedValue({ aggregateGeneration: 2 })
  usePresentationStore.setState({ presentation: null, saveConflict: null })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
})
afterEach(() => vi.unstubAllGlobals())

describe('canonical game teardown persistence', () => {
  it('keeps canvas geometry and authored settings but excludes runtime state from the unload request', async () => {
    const config = {
      ...createDefaultGameConfig('name-picker'),
      rotation: 810,
      exclusions: ['item-1'],
    }
    const snapshot = deck({
      id: 'game-1',
      type: 'game',
      gameType: 'name-picker',
      rotation: 23,
      gameStatus: 'active',
      currentQuestion: 4,
      'name-picker': config,
    })
    const { result } = renderHook(() => useEditorSaveController({ isTemplate: false }))
    act(() => result.current.scheduleSave(snapshot, 1500))
    await settle()
    act(() => result.current.flush())
    await settle()
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    const game = body.slides[0].elements[0]
    expect(game.rotation).toBe(23)
    expect(game['name-picker'].items).toEqual(config.items)
    expect(game['name-picker'].weighted).toBe(config.weighted)
    expect(game).not.toHaveProperty('gameStatus')
    expect(game).not.toHaveProperty('currentQuestion')
    expect(game['name-picker']).not.toHaveProperty('rotation')
    expect(game['name-picker']).not.toHaveProperty('exclusions')
    expect(clearEditorDraft).not.toHaveBeenCalled()
  })

  it('retains an incomplete canonical draft without dispatching it and admits its corrected successor', async () => {
    const config = {
      ...createDefaultGameConfig('poll'),
      options: [{ id: 'a', text: 'First choice' }],
    }
    const snapshot = deck({ id: 'game-1', type: 'game', gameType: 'poll', poll: config })
    const { result } = renderHook(() => useEditorSaveController({ isTemplate: false }))
    act(() => result.current.scheduleSave(snapshot, 1500))
    await settle()
    act(() => result.current.flush())
    await settle()
    expect(fetch).not.toHaveBeenCalled()
    expect(api.updatePresentation).not.toHaveBeenCalled()
    expect(clearEditorDraft).not.toHaveBeenCalled()
    expect(writeEditorDraft.mock.calls[0][0].snapshot.slides[0].elements[0].poll.options).toEqual(
      config.options
    )
    expect(result.current.saveStatus).toBe('error')
    const repaired = structuredClone(snapshot)
    repaired.slides[0].elements[0].poll.options.push({ id: 'b', text: 'Second choice' })
    act(() => result.current.scheduleSave(repaired, 0))
    await settle()
    expect(result.current.saveStatus).toBe('saved')
    expect(api.updatePresentation.mock.calls[0][1].slides[0].elements[0].poll.options).toEqual([
      { id: 'a', text: 'First choice' },
      { id: 'b', text: 'Second choice' },
    ])
  })
})

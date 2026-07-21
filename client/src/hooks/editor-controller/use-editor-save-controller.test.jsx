import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../utils/api'
import { usePresentationStore } from '../../stores/presentation-store'
import { useEditorSaveController } from './use-editor-save-controller'
import {
  clearEditorDraft,
  writeEditorDraft,
} from '../../utils/editor-draft-store'

vi.mock('../../utils/api', () => ({
  api: {
    updatePresentation: vi.fn(),
    updateTemplate: vi.fn(),
  },
}))

vi.mock('../use-editor-save-queue', () => ({
  flushPendingSave: vi.fn(),
}))

vi.mock('../../utils/editor-draft-store', () => ({
  clearEditorDraft: vi.fn().mockResolvedValue(true),
  createEditorDraft: vi.fn(({ snapshot, isTemplate, attemptId }) => ({
    key: `${isTemplate ? 'template' : 'presentation'}:${snapshot.id}`,
    id: snapshot.id,
    isTemplate,
    snapshot,
    idempotencyKey: snapshot.idempotencyKey || null,
    attemptId,
  })),
  writeEditorDraft: vi.fn().mockResolvedValue(true),
}))

const snapshot = (title) => ({
  id: 'deck-1',
  title,
  aggregateGeneration: 1,
  slides: [{ id: 'slide-1', elements: [] }],
})

const settle = () =>
  act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })

describe('useEditorSaveController route ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    writeEditorDraft.mockReset().mockResolvedValue(true)
    usePresentationStore.setState({ saveConflict: null })
  })

  it('defers a queued edit during a slow validated export and rebases it to R1', async () => {
    let resolveDownload
    const slowDownload = new Promise((resolve) => {
      resolveDownload = resolve
    })
    api.updatePresentation.mockResolvedValueOnce({ aggregateGeneration: 4 })
    let resolveRebasedDraft
    writeEditorDraft.mockImplementation((draft) => {
      if (draft.snapshot.aggregateGeneration === 3) {
        return new Promise((resolve) => {
          resolveRebasedDraft = resolve
        })
      }
      return Promise.resolve(true)
    })

    const { result } = renderHook(() =>
      useEditorSaveController({ isTemplate: false })
    )
    let exportToken
    act(() => {
      exportToken = result.current.beginExport()
      result.current.scheduleSave({ ...snapshot('Edit during export'), aggregateGeneration: 2 }, 0)
    })
    await settle()

    expect(exportToken).toBe(1)
    expect(api.updatePresentation).not.toHaveBeenCalled()
    const pendingFlush = result.current.flushAndWait()
    await settle()
    expect(api.updatePresentation).not.toHaveBeenCalled()

    const exportPromise = slowDownload.then(() => {
      act(() => {
        result.current.adoptGeneration(3)
        result.current.endExport(exportToken)
      })
    })
    resolveDownload(new Blob(['R1']))
    await act(async () => {
      await exportPromise
      await settle()
    })
    expect(api.updatePresentation).not.toHaveBeenCalled()
    expect(resolveRebasedDraft).toBeTypeOf('function')
    resolveRebasedDraft(true)
    await act(async () => {
      await pendingFlush
      await settle()
    })

    expect(api.updatePresentation).toHaveBeenCalledTimes(1)
    expect(api.updatePresentation.mock.calls[0][1]).toMatchObject({
      title: 'Edit during export',
      aggregateGeneration: 3,
    })
    expect(writeEditorDraft).toHaveBeenLastCalledWith(expect.objectContaining({
      snapshot: expect.objectContaining({
        title: 'Edit during export',
        aggregateGeneration: 3,
      }),
    }))
  })

  it('rejects a concurrent validated export token without releasing the active barrier', () => {
    const { result } = renderHook(() =>
      useEditorSaveController({ isTemplate: false })
    )

    let firstToken
    let secondToken
    act(() => {
      firstToken = result.current.beginExport()
      secondToken = result.current.beginExport()
    })

    expect(firstToken).toBe(1)
    expect(secondToken).toBeNull()
    act(() => result.current.endExport(secondToken))
    act(() => result.current.endExport(firstToken))
  })

  it('cancels a waiting export flush when the route is reset', async () => {
    const { result } = renderHook(() =>
      useEditorSaveController({ isTemplate: false })
    )
    act(() => {
      result.current.beginExport()
      result.current.scheduleSave(snapshot('Route-bound edit'), 0)
    })
    const pendingFlush = result.current.flushAndWait()
    await settle()
    act(() => result.current.resetForRoute())

    await expect(pendingFlush).resolves.toBe(false)
    expect(api.updatePresentation).not.toHaveBeenCalled()
  })

  it('does not treat a same-id save from a prior route as the current successor', async () => {
    let rejectA
    const requestA = new Promise((_, reject) => {
      rejectA = reject
    })
    const stale = Object.assign(new Error('stale generation'), {
      status: 409,
      reason: 'STALE_GENERATION',
      currentGeneration: 2,
    })
    api.updatePresentation
      .mockImplementationOnce(() => requestA)
      .mockResolvedValueOnce({ aggregateGeneration: 3 })
    usePresentationStore.setState({ saveConflict: null })

    const { result } = renderHook(() =>
      useEditorSaveController({ isTemplate: false })
    )

    act(() => result.current.scheduleSave(snapshot('Old A'), 0))
    await settle()
    expect(api.updatePresentation).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.resetForRoute()
      result.current.scheduleSave(snapshot('Current A'), 1500)
    })

    await act(async () => {
      rejectA(stale)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(usePresentationStore.getState().saveConflict).toBeNull()
    act(() => result.current.retrySave())
    await settle()

    expect(api.updatePresentation).toHaveBeenCalledTimes(2)
    expect(api.updatePresentation.mock.calls[1][1].title).toBe('Current A')
  })

  it('records the snapshot before an in-flight request can outlive teardown', async () => {
    let rejectRequest
    api.updatePresentation.mockImplementationOnce(() => new Promise((_, reject) => {
      rejectRequest = reject
    }))

    const { result } = renderHook(() =>
      useEditorSaveController({ isTemplate: false })
    )
    act(() => result.current.scheduleSave(snapshot('Pending'), 0))
    await settle()

    expect(writeEditorDraft).toHaveBeenCalledWith(expect.objectContaining({
      snapshot: expect.objectContaining({ title: 'Pending' }),
    }))
    expect(writeEditorDraft).toHaveBeenCalledTimes(1)
    expect(api.updatePresentation).toHaveBeenCalledTimes(1)

    act(() => result.current.flush())
    rejectRequest(new Error('request interrupted'))
    await settle()

    expect(clearEditorDraft).not.toHaveBeenCalled()
  })

  it('clears only the committed draft identity after a successful request', async () => {
    api.updatePresentation.mockResolvedValueOnce({ aggregateGeneration: 2 })

    const { result } = renderHook(() =>
      useEditorSaveController({ isTemplate: false })
    )
    act(() => result.current.scheduleSave(snapshot('Committed'), 0))
    await settle()

    expect(clearEditorDraft).toHaveBeenCalledWith(
      'deck-1',
      false,
      expect.objectContaining({ attemptId: expect.any(Number) })
    )
  })

  it('discards queued successor drafts when Use Remote fences pending saves', async () => {
    const stale = Object.assign(new Error('stale generation'), {
      status: 409,
      reason: 'STALE_GENERATION',
      currentGeneration: 5,
    })
    api.updatePresentation.mockRejectedValueOnce(stale)

    const { result } = renderHook(() =>
      useEditorSaveController({ isTemplate: false })
    )
    act(() => result.current.scheduleSave(snapshot('Conflict'), 0))
    await settle()
    act(() => result.current.scheduleSave(snapshot('Queued successor'), 1500))
    clearEditorDraft.mockClear()

    await act(async () => {
      await result.current.discardPendingSave()
    })

    expect(clearEditorDraft).toHaveBeenCalledWith(
      'deck-1',
      false,
      expect.objectContaining({ attemptId: expect.any(Number) })
    )
  })

  it('does not resurrect a rejected save after a route reset', async () => {
    let rejectA
    const requestA = new Promise((_, reject) => {
      rejectA = reject
    })
    api.updatePresentation
      .mockImplementationOnce(() => requestA)
      .mockResolvedValueOnce({ aggregateGeneration: 2 })

    const { result } = renderHook(() =>
      useEditorSaveController({ isTemplate: false })
    )

    act(() => result.current.scheduleSave(snapshot('Deck A'), 0))
    await settle()
    expect(api.updatePresentation).toHaveBeenCalledTimes(1)

    act(() => result.current.resetForRoute())
    expect(result.current.saving).toBe(false)
    expect(result.current.saveStatus).toBe('')
    await act(async () => {
      rejectA(new Error('route closed'))
      await Promise.resolve()
      await Promise.resolve()
    })

    act(() => result.current.scheduleSave(snapshot('Deck B'), 0))
    await settle()

    expect(api.updatePresentation).toHaveBeenCalledTimes(2)
    expect(api.updatePresentation.mock.calls[1][1].title).toBe('Deck B')
  })

  it('keeps a prior route request locked while the successor waits', async () => {
    let resolveA
    const requestA = new Promise((resolve) => {
      resolveA = resolve
    })
    api.updatePresentation
      .mockImplementationOnce(() => requestA)
      .mockResolvedValueOnce({ aggregateGeneration: 2 })

    const { result } = renderHook(() =>
      useEditorSaveController({ isTemplate: false })
    )
    act(() => result.current.scheduleSave(snapshot('Deck A'), 0))
    await settle()

    act(() => {
      result.current.resetForRoute()
      result.current.scheduleSave(snapshot('Deck B'), 0)
    })
    await settle()
    expect(api.updatePresentation).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveA({ aggregateGeneration: 1 })
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(api.updatePresentation).toHaveBeenCalledTimes(2)
    expect(api.updatePresentation.mock.calls[1][1].title).toBe('Deck B')
  })

  it('rotates a recovered idempotency key before the next edit', async () => {
    api.updatePresentation
      .mockResolvedValueOnce({ aggregateGeneration: 2 })
      .mockResolvedValueOnce({ aggregateGeneration: 3 })

    const { result } = renderHook(() =>
      useEditorSaveController({ isTemplate: false })
    )
    act(() => result.current.scheduleSave({ ...snapshot('Recovered'), idempotencyKey: 'recovery-key' }, 0, {
      preserveIdempotencyKey: true,
    }))
    await settle()
    act(() => result.current.scheduleSave({ ...snapshot('Edited'), idempotencyKey: 'recovery-key' }, 0))
    await settle()

    expect(api.updatePresentation).toHaveBeenCalledTimes(2)
    expect(api.updatePresentation.mock.calls[0][1].idempotencyKey).toBe('recovery-key')
    expect(api.updatePresentation.mock.calls[1][1].idempotencyKey).not.toBe('recovery-key')
  })

  it('retries a failed body before the queued successor after a non-conflict rejection', async () => {
    api.updatePresentation
      .mockRejectedValueOnce(new Error('validation rejected'))
      .mockResolvedValueOnce({ aggregateGeneration: 2 })
      .mockResolvedValueOnce({ aggregateGeneration: 3 })

    const { result } = renderHook(() =>
      useEditorSaveController({ isTemplate: false })
    )
    act(() => result.current.scheduleSave(snapshot('Will Fail'), 0))
    await settle()
    expect(result.current.saveStatus).toBe('error')
    const failedKey = api.updatePresentation.mock.calls[0][1].idempotencyKey

    act(() => result.current.scheduleSave(snapshot('Second Try'), 0))
    await settle()

    expect(api.updatePresentation).toHaveBeenCalledTimes(3)
    expect(api.updatePresentation.mock.calls[1][1].title).toBe('Will Fail')
    expect(api.updatePresentation.mock.calls[1][1].idempotencyKey).toBe(failedKey)
    expect(api.updatePresentation.mock.calls[2][1].title).toBe('Second Try')
  })
})

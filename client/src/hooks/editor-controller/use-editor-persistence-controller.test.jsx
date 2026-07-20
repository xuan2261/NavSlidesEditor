import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../utils/api'
import { usePresentationStore } from '../../stores/presentation-store'
import { useEditorPersistenceController } from './use-editor-persistence-controller'
import {
  clearEditorDraft,
  readEditorDraft,
} from '../../utils/editor-draft-store'

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
  createEditorDraft: vi.fn(({ snapshot, isTemplate, attemptId }) => ({
    key: `${isTemplate ? 'template' : 'presentation'}:${snapshot.id}`,
    id: snapshot.id,
    isTemplate,
    snapshot,
    idempotencyKey: snapshot.idempotencyKey || null,
    attemptId,
  })),
  readEditorDraft: vi.fn().mockResolvedValue(null),
  writeEditorDraft: vi.fn().mockResolvedValue(true),
}))

const snapshot = (title, aggregateGeneration = 1, id = 'deck-1') => ({
  id,
  title,
  aggregateGeneration,
  slides: [{ id: 'slide-1', elements: [] }],
})

const flushMicrotasks = async () => {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

function useHarness(
  presentationId = 'deck-1',
  onSeedHistory = null,
  onReset = null,
  onSetGridSize = null
) {
  const [presentation, setPresentation] = useState(null)
  const setGridSize = useCallback(
    (value) => onSetGridSize?.(value),
    [onSetGridSize]
  )
  const seedHistory = useCallback(
    (snapshotValue) => onSeedHistory?.(snapshotValue),
    [onSeedHistory]
  )
  const resetEditorInteraction = useCallback(() => onReset?.(), [onReset])
  const controller = useEditorPersistenceController({
    presentation,
    setPresentation,
    presentationId,
    isTemplate: false,
    setGridSize,
    seedHistory,
    resetEditorInteraction,
  })
  return { controller, presentation, setPresentation }
}

describe('useEditorPersistenceController conflict recovery', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    api.updatePresentation.mockReset()
    api.updateTemplate.mockReset()
    readEditorDraft.mockReset().mockResolvedValue(null)
    clearEditorDraft.mockReset().mockResolvedValue(true)
    usePresentationStore.setState({ saveConflict: null, presentation: null, loading: true })
    api.getPresentation.mockResolvedValue(snapshot('Remote', 1))
  })

  it('exposes an interrupted draft without replacing the loaded remote state', async () => {
    const draft = {
      key: 'presentation:deck-1',
      id: 'deck-1',
      isTemplate: false,
      attemptId: 7,
      idempotencyKey: 'recovery-key',
      snapshot: snapshot('Local recovery', 1),
    }
    draft.snapshot.idempotencyKey = draft.idempotencyKey
    readEditorDraft.mockResolvedValueOnce(draft)

    const { result } = renderHook(() => useHarness())
    await flushMicrotasks()

    expect(result.current.presentation.title).toBe('Remote')
    expect(result.current.controller.saveRecovery).toBe(draft)
    expect(api.updatePresentation).not.toHaveBeenCalled()
  })

  it('requires an explicit recovery choice before applying the local draft', async () => {
    const draft = {
      key: 'presentation:deck-1',
      id: 'deck-1',
      isTemplate: false,
      attemptId: 8,
      idempotencyKey: 'recovery-key',
      snapshot: { ...snapshot('Local recovery', 1), idempotencyKey: 'recovery-key' },
    }
    readEditorDraft.mockResolvedValueOnce(draft)
    api.updatePresentation.mockResolvedValueOnce({ aggregateGeneration: 2 })

    const { result } = renderHook(() => useHarness())
    await flushMicrotasks()
    expect(result.current.presentation.title).toBe('Remote')

    await act(async () => {
      result.current.controller.recoverLocalDraft()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.presentation.title).toBe('Local recovery')
    expect(api.updatePresentation).toHaveBeenCalledWith(
      'deck-1',
      expect.objectContaining({ title: 'Local recovery', idempotencyKey: 'recovery-key' })
    )
    expect(result.current.controller.saveRecovery).toBeNull()
  })

  it('discards an interrupted draft only after the user chooses remote', async () => {
    const draft = {
      key: 'presentation:deck-1',
      id: 'deck-1',
      isTemplate: false,
      attemptId: 9,
      idempotencyKey: 'recovery-key',
      snapshot: snapshot('Local recovery', 1),
    }
    readEditorDraft.mockResolvedValueOnce(draft)

    const { result } = renderHook(() => useHarness())
    await flushMicrotasks()

    await act(async () => result.current.controller.dismissSaveRecovery())

    expect(clearEditorDraft).toHaveBeenCalledWith('deck-1', false, {
      idempotencyKey: 'recovery-key',
      attemptId: 9,
    })
    expect(result.current.controller.saveRecovery).toBeNull()
  })

  it('keeps the first-load marker available for the parent rich-text clear effect', async () => {
    const clearRichTextContent = vi.fn()
    const { result } = renderHook(() => {
      const harness = useHarness()
      const editorRef = useRef({})
      useEffect(() => {
        if (!harness.presentation || !harness.controller.firstLoadRef.current) return
        clearRichTextContent()
        harness.controller.firstLoadRef.current = false
      }, [harness.controller.firstLoadRef, harness.presentation])
      return { ...harness, editor: editorRef.current }
    })

    await flushMicrotasks()

    expect(result.current.presentation.title).toBe('Remote')
    expect(clearRichTextContent).toHaveBeenCalledTimes(1)
  })

  it('Keep Local replaces a stale failed entry before dispatching the fresh body', async () => {
    const stale = Object.assign(new Error('stale generation'), {
      status: 409,
      reason: 'STALE_GENERATION',
      currentGeneration: 5,
    })
    api.updatePresentation
      .mockRejectedValueOnce(stale)
      .mockResolvedValueOnce({ aggregateGeneration: 6 })

    const { result } = renderHook(() => useHarness())
    await flushMicrotasks()
    expect(result.current.presentation.title).toBe('Remote')

    act(() => result.current.setPresentation(snapshot('Local edit', 1)))
    await act(async () => vi.advanceTimersByTimeAsync(1500))
    expect(api.updatePresentation).toHaveBeenCalledTimes(1)
    expect(usePresentationStore.getState().saveConflict).toBeTruthy()

    api.getPresentation.mockResolvedValueOnce(snapshot('Remote', 5))
    await act(async () => {
      await result.current.controller.keepLocalSaveConflict()
      await vi.runAllTimersAsync()
    })

    expect(api.updatePresentation).toHaveBeenCalledTimes(2)
    expect(api.updatePresentation.mock.calls[1][1]).toMatchObject({
      title: 'Local edit',
      aggregateGeneration: 5,
    })
  })

  it('Keep Local preserves a newer edit queued behind the conflict', async () => {
    const stale = Object.assign(new Error('stale generation'), {
      status: 409,
      reason: 'STALE_GENERATION',
      currentGeneration: 5,
    })
    api.updatePresentation
      .mockRejectedValueOnce(stale)
      .mockResolvedValueOnce({ aggregateGeneration: 6 })

    const { result } = renderHook(() => useHarness())
    await flushMicrotasks()
    act(() => result.current.setPresentation(snapshot('Local edit 1', 1)))
    await act(async () => vi.advanceTimersByTimeAsync(1500))
    expect(usePresentationStore.getState().saveConflict).toBeTruthy()

    act(() => result.current.setPresentation(snapshot('Local edit 2', 1)))
    await flushMicrotasks()
    api.getPresentation.mockResolvedValueOnce(snapshot('Remote', 5))

    await act(async () => {
      await result.current.controller.keepLocalSaveConflict()
      await vi.runAllTimersAsync()
    })

    expect(api.updatePresentation).toHaveBeenCalledTimes(2)
    expect(api.updatePresentation.mock.calls[1][1]).toMatchObject({
      title: 'Local edit 2',
      aggregateGeneration: 5,
    })
  })

  it('Keep Local reads the latest edit when the remote check is pending', async () => {
    const stale = Object.assign(new Error('stale generation'), {
      status: 409,
      reason: 'STALE_GENERATION',
      currentGeneration: 5,
    })
    api.updatePresentation
      .mockRejectedValueOnce(stale)
      .mockResolvedValueOnce({ aggregateGeneration: 6 })

    const { result } = renderHook(() => useHarness())
    await flushMicrotasks()
    act(() => result.current.setPresentation(snapshot('Local edit 1', 1)))
    await act(async () => vi.advanceTimersByTimeAsync(1500))
    expect(usePresentationStore.getState().saveConflict).toBeTruthy()

    let resolveRemote
    api.getPresentation.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRemote = resolve
        })
    )
    let pendingKeepLocal
    await act(async () => {
      pendingKeepLocal = result.current.controller.keepLocalSaveConflict()
      await Promise.resolve()
    })
    act(() => result.current.setPresentation(snapshot('Local edit 2', 1)))
    await flushMicrotasks()
    resolveRemote(snapshot('Remote', 5))
    await act(async () => {
      await pendingKeepLocal
      await vi.runAllTimersAsync()
    })

    expect(api.updatePresentation).toHaveBeenCalledTimes(2)
    expect(api.updatePresentation.mock.calls[1][1]).toMatchObject({
      title: 'Local edit 2',
      aggregateGeneration: 5,
    })
  })

  it('Use Remote clears a stale failed entry before replacing local state', async () => {
    const stale = Object.assign(new Error('stale generation'), {
      status: 409,
      reason: 'STALE_GENERATION',
      currentGeneration: 5,
    })
    api.updatePresentation
      .mockRejectedValueOnce(stale)
      .mockResolvedValueOnce({ aggregateGeneration: 6 })

    const seedHistory = vi.fn()
    const resetEditorInteraction = vi.fn()
    const setGridSize = vi.fn()
    const { result } = renderHook(() =>
      useHarness('deck-1', seedHistory, resetEditorInteraction, setGridSize)
    )
    await flushMicrotasks()
    act(() => result.current.setPresentation(snapshot('Local edit', 1)))
    await act(async () => vi.advanceTimersByTimeAsync(1500))
    expect(api.updatePresentation).toHaveBeenCalledTimes(1)
    expect(usePresentationStore.getState().saveConflict).toBeTruthy()

    api.getPresentation.mockResolvedValueOnce({
      ...snapshot('Remote wins', 5),
      gridSize: 32,
    })
    await act(async () => {
      await result.current.controller.useRemoteSaveConflict()
    })
    expect(setGridSize).toHaveBeenLastCalledWith(32)
    expect(seedHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Remote wins', aggregateGeneration: 5 })
    )
    expect(resetEditorInteraction).toHaveBeenCalledTimes(2)
    await act(async () => {
      result.current.controller.retryPendingSave()
      await vi.runAllTimersAsync()
    })

    expect(api.updatePresentation).toHaveBeenCalledTimes(1)
  })

  it('Use Remote discards a queued successor before replacing local state', async () => {
    const stale = Object.assign(new Error('stale generation'), {
      status: 409,
      reason: 'STALE_GENERATION',
      currentGeneration: 5,
    })
    api.updatePresentation.mockRejectedValueOnce(stale)

    const { result } = renderHook(() => useHarness())
    await flushMicrotasks()
    act(() => result.current.setPresentation(snapshot('Local edit 1', 1)))
    await act(async () => vi.advanceTimersByTimeAsync(1500))
    expect(usePresentationStore.getState().saveConflict).toBeTruthy()

    act(() => result.current.setPresentation(snapshot('Local edit 2', 1)))
    await flushMicrotasks()
    expect(api.updatePresentation).toHaveBeenCalledTimes(1)

    api.getPresentation.mockResolvedValueOnce(snapshot('Remote wins', 5))
    await act(async () => {
      await result.current.controller.useRemoteSaveConflict()
      await vi.advanceTimersByTimeAsync(1500)
    })

    expect(api.updatePresentation).toHaveBeenCalledTimes(1)
  })

  it('fences Use Remote after asynchronous draft cleanup', async () => {
    let resolveCleanup
    clearEditorDraft.mockImplementationOnce(
      () => new Promise((resolve) => { resolveCleanup = resolve })
    )
    const { result, rerender } = renderHook(
      ({ id }) => useHarness(id),
      { initialProps: { id: 'deck-1' } }
    )
    await flushMicrotasks()
    const stale = Object.assign(new Error('stale generation'), {
      status: 409,
      reason: 'STALE_GENERATION',
      currentGeneration: 5,
    })
    api.updatePresentation.mockRejectedValueOnce(stale)
    act(() => result.current.setPresentation(snapshot('Local A', 1, 'deck-1')))
    await act(async () => vi.advanceTimersByTimeAsync(1500))
    expect(usePresentationStore.getState().saveConflict).toBeTruthy()
    api.getPresentation.mockResolvedValueOnce(snapshot('Remote A', 5, 'deck-1'))

    let pendingRemote
    await act(async () => {
      pendingRemote = result.current.controller.useRemoteSaveConflict()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(resolveCleanup).toBeTypeOf('function')

    api.getPresentation.mockResolvedValueOnce(snapshot('Remote B', 2, 'deck-2'))
    await act(async () => {
      rerender({ id: 'deck-2' })
      await Promise.resolve()
      await Promise.resolve()
    })
    await act(async () => {
      resolveCleanup(true)
      await pendingRemote
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.presentation.title).toBe('Remote B')
  })

  it.each([
    ['Use Remote', 'useRemoteSaveConflict'],
    ['Keep Local', 'keepLocalSaveConflict'],
  ])('ignores duplicate %s conflict actions while resolution is pending', async (_label, method) => {
    let resolveConflictLoad
    const conflictLoad = new Promise((resolve) => {
      resolveConflictLoad = resolve
    })
    const { result } = renderHook(() => useHarness())
    await flushMicrotasks()
    api.getPresentation.mockImplementationOnce(() => conflictLoad)
    act(() => {
      usePresentationStore
        .getState()
        .setSaveConflict(snapshot('Local edit', 1), 2)
    })

    let firstResolution
    let duplicateResolution
    await act(async () => {
      firstResolution = result.current.controller[method]()
      duplicateResolution = result.current.controller[method]()
      await Promise.resolve()
    })

    expect(api.getPresentation).toHaveBeenCalledTimes(2)

    await act(async () => {
      resolveConflictLoad(snapshot('Remote latest', 2))
      await firstResolution
      await duplicateResolution
    })
  })

  it.each([
    ['Use Remote', 'useRemoteSaveConflict'],
    ['Keep Local', 'keepLocalSaveConflict'],
  ])('does not apply a canceled %s resolution to a replacement conflict', async (_label, method) => {
    let resolveConflictLoad
    const conflictLoad = new Promise((resolve) => {
      resolveConflictLoad = resolve
    })
    const { result } = renderHook(() => useHarness())
    await flushMicrotasks()
    api.getPresentation.mockImplementationOnce(() => conflictLoad)
    act(() => {
      usePresentationStore
        .getState()
        .setSaveConflict(snapshot('Local C1', 1), 2)
    })

    let pendingConflict
    await act(async () => {
      pendingConflict = result.current.controller[method]()
      await Promise.resolve()
    })
    act(() => {
      result.current.controller.clearSaveConflict()
      usePresentationStore
        .getState()
        .setSaveConflict(snapshot('Local C2', 1), 3)
    })

    await act(async () => {
      resolveConflictLoad(snapshot('Remote C1', 2))
      await pendingConflict
    })

    expect(usePresentationStore.getState().saveConflict.local.title).toBe('Local C2')
    expect(result.current.presentation.title).toBe('Remote')
    expect(api.updatePresentation).not.toHaveBeenCalled()
  })

  it.each([
    ['Use Remote', 'useRemoteSaveConflict'],
    ['Keep Local', 'keepLocalSaveConflict'],
  ])('does not let a stale %s failure annotate a newer route', async (_label, method) => {
    let rejectConflictLoad
    const conflictLoad = new Promise((_resolve, reject) => {
      rejectConflictLoad = reject
    })
    api.getPresentation
      .mockResolvedValueOnce(snapshot('Remote A', 1, 'deck-1'))
      .mockImplementationOnce(() => conflictLoad)
      .mockResolvedValueOnce(snapshot('Remote B', 2, 'deck-2'))

    const { result, rerender } = renderHook(
      ({ id }) => useHarness(id),
      { initialProps: { id: 'deck-1' } }
    )
    await flushMicrotasks()
    act(() => {
      usePresentationStore.getState().setSaveConflict({ id: 'deck-1' }, 1)
    })

    let pendingConflict
    await act(async () => {
      pendingConflict = result.current.controller[method]()
      rerender({ id: 'deck-2' })
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(result.current.controller.lastSaveError).toBe('')

    await act(async () => {
      rejectConflictLoad(new Error('old route failed'))
      await pendingConflict
    })

    expect(result.current.controller.lastSaveError).toBe('')
  })

  it('does not let an old conflict continuation clear a newer route failure', async () => {
    const stale = Object.assign(new Error('stale generation'), {
      status: 409,
      reason: 'STALE_GENERATION',
      currentGeneration: 5,
    })
    let resolveConflictLoad
    const conflictLoad = new Promise((resolve) => {
      resolveConflictLoad = resolve
    })
    api.updatePresentation
      .mockRejectedValueOnce(stale)
      .mockRejectedValueOnce(new Error('deck B failed'))
      .mockResolvedValueOnce({ aggregateGeneration: 7 })
    api.getPresentation
      .mockResolvedValueOnce(snapshot('Remote A', 1, 'deck-1'))
      .mockImplementationOnce(() => conflictLoad)
      .mockResolvedValueOnce(snapshot('Remote B', 2, 'deck-2'))

    const { result, rerender } = renderHook(
      ({ id }) => useHarness(id),
      { initialProps: { id: 'deck-1' } }
    )
    await flushMicrotasks()
    act(() => result.current.setPresentation(snapshot('Local A', 1, 'deck-1')))
    await act(async () => vi.advanceTimersByTimeAsync(1500))
    expect(usePresentationStore.getState().saveConflict).toBeTruthy()

    let pendingConflict
    await act(async () => {
      pendingConflict = result.current.controller.useRemoteSaveConflict()
      rerender({ id: 'deck-2' })
      await Promise.resolve()
      await Promise.resolve()
    })

    act(() => result.current.setPresentation(snapshot('Local B', 2, 'deck-2')))
    await act(async () => vi.advanceTimersByTimeAsync(1500))
    expect(api.updatePresentation).toHaveBeenCalledTimes(2)

    await act(async () => {
      resolveConflictLoad(snapshot('Remote A', 5, 'deck-1'))
      await pendingConflict
      result.current.controller.retryPendingSave()
      await vi.runAllTimersAsync()
    })

    expect(api.updatePresentation).toHaveBeenCalledTimes(3)
    expect(api.updatePresentation.mock.calls[2][0]).toBe('deck-2')
    expect(api.updatePresentation.mock.calls[2][1]).toMatchObject({
      title: 'Local B',
    })
  })

  it('does not autosave retained state during an A-to-B-to-A load bounce', async () => {
    let resolveB
    let resolveReloadedA
    api.getPresentation
      .mockResolvedValueOnce(snapshot('Remote A', 1, 'deck-1'))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveB = resolve
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveReloadedA = resolve
          })
      )

    const { rerender } = renderHook(
      ({ id }) => useHarness(id),
      { initialProps: { id: 'deck-1' } }
    )
    await flushMicrotasks()

    await act(async () => {
      rerender({ id: 'deck-2' })
      await Promise.resolve()
    })
    await act(async () => {
      rerender({ id: 'deck-1' })
      await Promise.resolve()
    })
    await act(async () => vi.advanceTimersByTimeAsync(1500))

    expect(api.updatePresentation).not.toHaveBeenCalled()

    await act(async () => {
      resolveB(snapshot('Remote B', 2, 'deck-2'))
      resolveReloadedA(snapshot('Remote A refreshed', 3, 'deck-1'))
      await Promise.resolve()
      await Promise.resolve()
    })
  })
})

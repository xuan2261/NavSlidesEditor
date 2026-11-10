import { useCallback, useState } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../utils/api'
import { usePresentationStore } from '../../stores/presentation-store'
import { useEditorPersistenceController } from './use-editor-persistence-controller'

vi.mock('../../utils/api', () => ({
  api: {
    getPresentation: vi.fn(),
    getTemplate: vi.fn(),
    updatePresentation: vi.fn(),
    updateTemplate: vi.fn(),
    restoreSnapshot: vi.fn(),
  },
}))
vi.mock('../../utils/editor-draft-store', () => ({
  readEditorDraft: vi.fn().mockResolvedValue(null),
  clearEditorDraft: vi.fn().mockResolvedValue(true),
  createEditorDraft: vi.fn(({ snapshot }) => ({ snapshot, id: snapshot.id })),
  writeEditorDraft: vi.fn().mockResolvedValue(true),
}))
const snapshot = (id = 'deck') => ({
  id,
  title: id,
  aggregateGeneration: 1,
  slides: [{ id: 'slide', elements: [] }],
})
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
function useHarness(id) {
  const [presentation, setPresentation] = useState(null)
  const noOp = useCallback(() => {}, [])
  const controller = useEditorPersistenceController({
    presentation,
    setPresentation,
    presentationId: id,
    isTemplate: false,
    setGridSize: noOp,
    seedHistory: noOp,
    resetEditorInteraction: noOp,
  })
  return { presentation, setPresentation, controller }
}
async function mountLoaded() {
  const load = deferred()
  api.getPresentation.mockReturnValueOnce(load.promise)
  const hook = renderHook(({ id }) => useHarness(id), { initialProps: { id: 'deck' } })
  await act(async () => {
    load.resolve(snapshot())
    await load.promise
  })
  expect(hook.result.current.controller.loading).toBe(false)
  return hook
}
describe('source font acknowledged-save token', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    api.updatePresentation.mockReset()
    usePresentationStore.setState({ presentation: null, loading: true, saveConflict: null })
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('publishes a token only after the current transport succeeds', async () => {
    const save = deferred(),
      dispatched = deferred(),
      hook = await mountLoaded()
    api.updatePresentation.mockImplementation(() => {
      dispatched.resolve()
      return save.promise
    })
    expect(hook.result.current.controller.lastSavedAt).toBeNull()
    await act(async () => {
      hook.result.current.controller.handleManualSave()
      await dispatched.promise
    })
    expect(hook.result.current.controller.lastSavedAt).toBeNull()
    await act(async () => {
      save.resolve({ aggregateGeneration: 2 })
      await save.promise
    })
    expect(hook.result.current.controller.lastSavedAt).toBeInstanceOf(Date)
  })

  it('does not publish a token for a failed transport', async () => {
    const save = deferred(),
      dispatched = deferred(),
      hook = await mountLoaded()
    api.updatePresentation.mockImplementation(() => {
      dispatched.resolve()
      return save.promise
    })
    await act(async () => {
      hook.result.current.controller.handleManualSave()
      await dispatched.promise
    })
    await act(async () => {
      save.reject(new Error('network unavailable'))
      await save.promise.catch(() => {})
    })
    expect(hook.result.current.controller.saveStatus).toBe('error')
    expect(hook.result.current.controller.lastSavedAt).toBeNull()
  })

  it('does not treat a superseded save as acknowledgement of the newer source', async () => {
    const old = deferred(),
      next = deferred(),
      firstDispatch = deferred(),
      nextDispatch = deferred()
    api.updatePresentation
      .mockImplementationOnce(() => {
        firstDispatch.resolve()
        return old.promise
      })
      .mockImplementationOnce(() => {
        nextDispatch.resolve()
        return next.promise
      })
    const hook = await mountLoaded()
    await act(async () => {
      hook.result.current.controller.handleManualSave()
      await firstDispatch.promise
    })
    act(() =>
      hook.result.current.setPresentation({ ...hook.result.current.presentation, title: 'new' })
    )
    act(() => hook.result.current.controller.handleManualSave())
    await act(async () => {
      old.resolve({ aggregateGeneration: 2 })
      await nextDispatch.promise
    })
    expect(hook.result.current.controller.lastSavedAt).toBeNull()
    await act(async () => {
      next.resolve({ aggregateGeneration: 3 })
      await next.promise
    })
    expect(hook.result.current.controller.lastSavedAt).toBeInstanceOf(Date)
  })
})

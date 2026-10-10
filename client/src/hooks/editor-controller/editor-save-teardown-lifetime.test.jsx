import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../utils/api'
import { usePresentationStore } from '../../stores/presentation-store'
import * as drafts from '../../utils/editor-draft-store'
import { useEditorSaveController } from './use-editor-save-controller'
import {
  oversizedDeck,
  receiptAuthority,
  stubSynchronousReceipt,
} from './editor-save-replay-fixtures'

vi.mock('../../utils/api', () => ({
  api: { updatePresentation: vi.fn(), updateTemplate: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
  api.updatePresentation.mockReset()
  localStorage.clear()
  usePresentationStore.setState({ presentation: null, saveConflict: null })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function uncertainPredecessor() {
  const authority = receiptAuthority()
  api.updatePresentation.mockImplementation(async (_id, body) => {
    const saved = authority.save(body)
    if (body.title === 'Uncertain edit') throw new Error('Acknowledgement lost')
    return saved
  })
  stubSynchronousReceipt(authority)
  const owner = renderHook(() => useEditorSaveController({ isTemplate: false }))
  await act(async () => {
    owner.result.current.scheduleSave(oversizedDeck('Uncertain edit'), 0)
    await owner.result.current.flushAndWait()
  })
  expect(owner.result.current.saveStatus).toBe('error')
  await act(async () => {
    owner.result.current.scheduleSave(oversizedDeck('Final edit'), 1500)
  })
  return { ...owner, authority }
}

describe('synchronous save teardown lifetime', () => {
  it('keeps an unsent rebased successor recoverable without automatically sending it during teardown', async () => {
    const { result, unmount, authority } = await uncertainPredecessor()
    await act(async () => {
      result.current.flush({ allowSynchronous: true })
    })
    expect(authority.generation).toBe(2)
    expect(authority.presentation.title).toBe('Uncertain edit')
    expect(api.updatePresentation).toHaveBeenCalledTimes(1)
    const retained = await drafts.readEditorDraft('replay-ordering-deck')
    unmount()

    const recovered = renderHook(() => useEditorSaveController({ isTemplate: false }))
    await act(async () => {
      recovered.result.current.adoptGeneration(authority.generation)
      recovered.result.current.scheduleSave(retained.snapshot, 0, { preserveIdempotencyKey: true })
      await recovered.result.current.flushAndWait()
    })
    expect(recovered.result.current.saveStatus).toBe('saved')
    expect(authority.generation).toBe(3)
    expect(authority.presentation.title).toBe('Final edit')
    expect(await drafts.readEditorDraft('replay-ordering-deck')).toBeNull()
    recovered.unmount()
  })

  it.each(['unmount', 'route reset'])(
    'cancels an explicit drain on %s while transport cleanup is pending',
    async (cancellation) => {
      const { result, unmount, authority } = await uncertainPredecessor()
      let releaseCleanup
      const cleanupPending = new Promise((resolve) => {
        releaseCleanup = resolve
      })
      const clear = drafts.clearEditorDraft
      vi.spyOn(drafts, 'clearEditorDraft').mockImplementationOnce(async (...args) => {
        await cleanupPending
        return clear(...args)
      })
      let drain
      act(() => {
        result.current.flush({ allowSynchronous: true })
        drain = result.current.flushAndWait()
      })
      let drained
      await act(async () => {
        if (cancellation === 'unmount') unmount()
        else result.current.resetForRoute()
        drained = await drain
      })
      expect(drained).toBe(false)
      await act(async () => {
        releaseCleanup()
        await cleanupPending
      })
      expect(authority.generation).toBe(2)
      expect(authority.presentation.title).toBe('Uncertain edit')
      expect(api.updatePresentation).toHaveBeenCalledTimes(1)
      expect((await drafts.readEditorDraft('replay-ordering-deck')).snapshot.title).toBe(
        'Final edit'
      )
      if (cancellation !== 'unmount') unmount()
    }
  )
})

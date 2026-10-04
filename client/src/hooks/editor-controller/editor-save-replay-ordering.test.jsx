import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../utils/api'
import { usePresentationStore } from '../../stores/presentation-store'
import { readEditorDraft } from '../../utils/editor-draft-store'
import { useEditorSaveController } from './use-editor-save-controller'
import {
  deck,
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
afterEach(() => vi.unstubAllGlobals())

describe('durable canonical save replay ordering', () => {
  it('recovers a rebased queued successor after its remote commit loses the acknowledgement', async () => {
    const authority = receiptAuthority()
    let firstBody
    let acknowledgeFirst
    api.updatePresentation.mockImplementation((_id, body) => {
      if (body.title === 'First edit') {
        firstBody = structuredClone(body)
        return new Promise((resolve) => {
          acknowledgeFirst = resolve
        })
      }
      authority.save(body)
      return Promise.reject(new Error('Acknowledgement lost'))
    })
    const original = renderHook(() => useEditorSaveController({ isTemplate: false }))
    await act(async () => {
      original.result.current.scheduleSave(deck('First edit'), 0)
    })
    await act(async () => {
      original.result.current.scheduleSave(deck('Queued edit'), 0)
    })
    await act(async () => {
      acknowledgeFirst(authority.save(firstBody))
      await original.result.current.flushAndWait()
    })
    expect(original.result.current.saveStatus).toBe('error')
    expect(authority.generation).toBe(3)
    const retained = await readEditorDraft('replay-ordering-deck')
    original.unmount()

    api.updatePresentation.mockImplementation(async (_id, body) => authority.save(body))
    const recovered = renderHook(() => useEditorSaveController({ isTemplate: false }))
    await act(async () => {
      recovered.result.current.adoptGeneration(authority.generation)
      recovered.result.current.scheduleSave(retained.snapshot, 0, { preserveIdempotencyKey: true })
      await recovered.result.current.flushAndWait()
    })
    expect(recovered.result.current.saveStatus).toBe('saved')
    expect(authority.presentation.title).toBe('Queued edit')
    expect(authority.generation).toBe(3)
    expect(await readEditorDraft('replay-ordering-deck')).toBeNull()
    recovered.unmount()
  })

  it.each(['keepalive', 'synchronous'])(
    'drains a mounted caller after %s unload-style reconciliation',
    async (transport) => {
      const authority = receiptAuthority()
      api.updatePresentation.mockImplementation(async (_id, body) => {
        const saved = authority.save(body)
        if (body.title === 'Uncertain edit') throw new Error('Acknowledgement lost')
        return saved
      })
      const keepalive = vi.fn(async (_url, { body }) => {
        try {
          const saved = authority.save(JSON.parse(body))
          return { ok: true, json: async () => saved }
        } catch (error) {
          return { ok: false, json: async () => ({ error: error.message }) }
        }
      })
      vi.stubGlobal('fetch', keepalive)
      stubSynchronousReceipt(authority)
      const snapshot = transport === 'synchronous' ? oversizedDeck : deck
      const { result, unmount } = renderHook(() => useEditorSaveController({ isTemplate: false }))
      await act(async () => {
        result.current.scheduleSave(snapshot('Uncertain edit'), 0)
        await result.current.flushAndWait()
      })
      expect(result.current.saveStatus).toBe('error')
      await act(async () => {
        result.current.scheduleSave(snapshot('Final edit'), 1500)
      })
      let drained
      await act(async () => {
        result.current.flush({ allowSynchronous: true })
        drained = await result.current.flushAndWait()
      })
      expect(drained).toBe(true)
      expect(authority.presentation.title).toBe('Final edit')
      expect(authority.generation).toBe(3)
      expect(result.current.saveStatus).toBe('saved')
      expect(await readEditorDraft('replay-ordering-deck')).toBeNull()
      unmount()
    }
  )
})

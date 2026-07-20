// Covers teardown persistence of a pending autosave: the transport decision
// (PUT route selection + keepalive vs synchronous fallback by payload size)
// and idempotent dispatch.
import { describe, it, expect, vi } from 'vitest'
import {
  flushPendingSave,
  saveUrlFor,
  KEEPALIVE_MAX_BYTES,
} from './use-editor-save-queue'

describe('saveUrlFor', () => {
  it('routes presentations to the presentations PUT endpoint', () => {
    expect(saveUrlFor('deck-1', false)).toBe('/api/presentations/deck-1')
  })

  it('routes templates to the templates PUT endpoint', () => {
    expect(saveUrlFor('tpl-1', true)).toBe('/api/templates/tpl-1')
  })
})

describe('flushPendingSave', () => {
  it('dispatches a small pending snapshot via the keepalive transport', () => {
    const sendKeepalive = vi.fn()
    const sendSync = vi.fn()
    const snapshot = { id: 'deck-1', title: 'Pending' }

    const dispatched = flushPendingSave(snapshot, {
      isTemplate: false,
      sendKeepalive,
      sendSync,
    })

    expect(dispatched).toBe(true)
    expect(sendKeepalive).toHaveBeenCalledTimes(1)
    expect(sendKeepalive).toHaveBeenCalledWith(
      '/api/presentations/deck-1',
      JSON.stringify(snapshot)
    )
    expect(sendSync).not.toHaveBeenCalled()
  })

  it('falls back to the synchronous transport when the payload exceeds the keepalive ceiling', () => {
    const sendKeepalive = vi.fn()
    const sendSync = vi.fn()
    // Inflate the snapshot past the keepalive cap (mimics an inlined base64
    // background data-URL).
    const snapshot = { id: 'deck-1', blob: 'x'.repeat(KEEPALIVE_MAX_BYTES + 1) }

    const dispatched = flushPendingSave(snapshot, {
      isTemplate: false,
      sendKeepalive,
      sendSync,
    })

    expect(dispatched).toBe(true)
    expect(sendSync).toHaveBeenCalledTimes(1)
    expect(sendKeepalive).not.toHaveBeenCalled()
  })

  it('counts UTF-8 bytes when deciding whether keepalive is safe', () => {
    const sendKeepalive = vi.fn()
    const sendSync = vi.fn()
    const snapshot = { id: 'deck-1', text: '漢'.repeat(KEEPALIVE_MAX_BYTES / 2) }

    const dispatched = flushPendingSave(snapshot, {
      isTemplate: false,
      sendKeepalive,
      sendSync,
    })

    expect(dispatched).toBe(true)
    expect(sendSync).toHaveBeenCalledTimes(1)
    expect(sendKeepalive).not.toHaveBeenCalled()
  })

  it('does not dispatch an oversized payload without the unload-only sync transport', () => {
    const sendKeepalive = vi.fn()
    const snapshot = { id: 'deck-1', blob: 'x'.repeat(KEEPALIVE_MAX_BYTES + 1) }

    expect(flushPendingSave(snapshot, { isTemplate: false, sendKeepalive })).toBe(false)
    expect(sendKeepalive).not.toHaveBeenCalled()
  })

  it('does nothing when there is no pending snapshot', () => {
    const sendKeepalive = vi.fn()
    expect(flushPendingSave(null, { sendKeepalive })).toBe(false)
    expect(flushPendingSave({ title: 'no id' }, { sendKeepalive })).toBe(false)
    expect(sendKeepalive).not.toHaveBeenCalled()
  })
})

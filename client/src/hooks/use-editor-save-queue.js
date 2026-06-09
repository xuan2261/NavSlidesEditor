// Teardown-time persistence for the editor's pending autosave.
//
// When the editor is torn down (component unmount, route param switch, or the
// browser tab closing) any edit still sitting inside the autosave debounce
// window would be lost. This module dispatches that pending snapshot with a
// transport that survives unload.
//
// Transport note: the save route only accepts PUT, and `navigator.sendBeacon`
// is POST-only, so a beacon would 404 and silently drop the edit. We therefore
// rely on `fetch(..., { keepalive: true })`, which supports PUT and lets the
// request outlive the page. The browser caps keepalive request bodies, so a
// snapshot larger than that ceiling takes a synchronous fallback instead.

// Conservative ceiling for keepalive request bodies. Slide background images
// can be inlined as base64 data-URLs, so a snapshot can realistically exceed
// this; oversize payloads fall back to a synchronous transport.
export const KEEPALIVE_MAX_BYTES = 60 * 1024

export function saveUrlFor(id, isTemplate) {
  return isTemplate ? `/api/templates/${id}` : `/api/presentations/${id}`
}

// Dispatch a single pending save on teardown. Returns true if a request was
// dispatched. The caller is responsible for nulling its queue reference before
// invoking this so a double trigger (unmount + tab-close) sends at most once.
//
// `sendKeepalive(url, body)` and `sendSync(url, body)` are injected so the
// decision logic (URL routing + size-based transport selection) is unit
// testable without a real network or DOM.
export function flushPendingSave(snapshot, { isTemplate, sendKeepalive, sendSync } = {}) {
  if (!snapshot?.id) return false

  const body = JSON.stringify(snapshot)
  const url = saveUrlFor(snapshot.id, isTemplate)
  const oversize = body.length > KEEPALIVE_MAX_BYTES

  if (oversize && typeof sendSync === 'function') {
    sendSync(url, body)
    return true
  }
  if (typeof sendKeepalive === 'function') {
    sendKeepalive(url, body)
    return true
  }
  return false
}

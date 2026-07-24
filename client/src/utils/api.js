const BASE = '/api'

async function handleResponse(r) {
  const body = await r.json().catch((err) => {
    if (err?.name === 'AbortError') throw err
    return { error: `HTTP ${r.status}` }
  })
  if (!r.ok) {
    const err = new Error(body.error || `Request failed (${r.status})`)
    const retryAfterRaw = r.headers?.get?.('Retry-After') ?? null
    err.status = r.status
    err.retryAfter = Number(retryAfterRaw || 0)
    err.retryAfterRaw = retryAfterRaw
    err.reason = body.reason
    err.currentGeneration = body.currentGeneration
    throw err
  }
  return body
}

const MAX_BUSY_RETRY_DELAY_MS = 300_000

function clampBusyRetryDelay(value) {
  if (!Number.isFinite(value)) return 5000
  return Math.min(Math.max(value, 0), MAX_BUSY_RETRY_DELAY_MS)
}

function getBusyRetryDelayMs(retryAfterRaw, fallbackMs) {
  if (/^[0-9]+$/u.test(retryAfterRaw || '')) {
    const seconds = Number(retryAfterRaw)
    if (Number.isSafeInteger(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, MAX_BUSY_RETRY_DELAY_MS)
    }
  }
  return clampBusyRetryDelay(fallbackMs)
}

function createAbortError() {
  const error = new Error('The operation was aborted')
  error.name = 'AbortError'
  return error
}

function sleepWithSignal(ms, signal) {
  if (signal?.aborted) return Promise.reject(createAbortError())
  return new Promise((resolve, reject) => {
    let settled = false
    let timer
    let onAbort
    const cleanup = () => {
      clearTimeout(timer)
      signal?.removeEventListener?.('abort', onAbort)
    }
    const finish = (callback, value) => {
      if (settled) return
      settled = true
      cleanup()
      callback(value)
    }
    onAbort = () => finish(reject, createAbortError())
    timer = setTimeout(() => finish(resolve), ms)
    signal?.addEventListener?.('abort', onAbort, { once: true })
    if (signal?.aborted) onAbort()
  })
}

export const api = {
  getPresentations: () => fetch(`${BASE}/presentations`).then(handleResponse),
  getPresentation: (id) => fetch(`${BASE}/presentations/${id}`).then(handleResponse),
  createPresentation: (data) =>
    fetch(`${BASE}/presentations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
  updatePresentation: (id, data) =>
    fetch(`${BASE}/presentations/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(data?.idempotencyKey ? { 'Idempotency-Key': data.idempotencyKey } : {}),
      },
      body: JSON.stringify(data),
    }).then(handleResponse),
  deletePresentation: (id) =>
    fetch(`${BASE}/presentations/${id}`, { method: 'DELETE' }).then(handleResponse),
  duplicatePresentation: (id) =>
    fetch(`${BASE}/presentations/${id}/duplicate`, { method: 'POST' }).then(handleResponse),

  // Trash
  getTrash: () => fetch(`${BASE}/presentations/trash/list`).then(handleResponse),
  restorePresentation: (id) =>
    fetch(`${BASE}/presentations/${id}/restore`, { method: 'POST' }).then(handleResponse),
  permanentDeletePresentation: (id) =>
    fetch(`${BASE}/presentations/${id}/permanent`, { method: 'DELETE' }).then(handleResponse),
  /** Download immutable original PPTX bytes, optionally fenced to a package generation. */
  downloadPptxOriginal: (id, expectedGeneration) => {
    const url = `${BASE}/presentations/${id}/pptx-original`
    const request = Number.isSafeInteger(expectedGeneration)
      ? fetch(url, { headers: { 'If-Pptx-Generation': String(expectedGeneration) } })
      : fetch(url)
    return request.then(async (r) => {
      if (!r.ok) {
        const body = await r.json().catch(() => ({ error: `HTTP ${r.status}` }))
        const err = new Error(body.error || `Request failed (${r.status})`)
        err.status = r.status
        err.code = body.code
        throw err
      }
      return r.blob()
    })
  },
  getPptxFidelity: (id) =>
    fetch(`${BASE}/presentations/${id}/pptx-fidelity`).then(handleResponse),
  downloadValidatedEditedPptx: (id, generation, idempotencyKey) =>
    fetch(`${BASE}/presentations/${id}/pptx-edited`, {
      method: 'POST',
      headers: {
        'Idempotency-Key': idempotencyKey,
        'If-Pptx-Generation': String(generation),
      },
    }).then(async (r) => {
      if (!r.ok) {
        const body = await r.json().catch(() => ({ error: `HTTP ${r.status}` }))
        const err = new Error(body.error || `Request failed (${r.status})`)
        err.status = r.status
        err.code = body.code
        throw err
      }
      const blob = await r.blob()
      const generationHeader = r.headers?.get?.('X-Pptx-Generation')
      const successorGeneration = /^[1-9]\d*$/u.test(generationHeader || '')
        ? Number(generationHeader)
        : null
      if (!Number.isSafeInteger(successorGeneration)) {
        const err = new Error('Validated edited export did not return a successor generation')
        err.code = 'MISSING_PPTX_GENERATION'
        throw err
      }
      Object.defineProperty(blob, 'aggregateGeneration', {
        configurable: true,
        enumerable: false,
        value: successorGeneration,
      })
      return blob
    }),

  uploadFile: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return fetch('/api/upload', { method: 'POST', body: fd }).then(handleResponse)
  },
  importPptxAsync: async (file, opts = {}) => {
    const {
      retryOnBusy = false,
      maxBusyRetries = 0,
      busyRetryDelayMs = 5000,
      onBusyRetry,
      signal,
    } = opts
    const fd = new FormData()
    fd.append('file', file)
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await fetch(`${BASE}/pptx/import`, {
          method: 'POST',
          body: fd,
          signal,
        }).then(handleResponse)
      } catch (err) {
        if (!retryOnBusy || err.status !== 429 || err.message !== 'import-in-progress' || attempt >= maxBusyRetries) {
          throw err
        }
        onBusyRetry?.(attempt + 1)
        await sleepWithSignal(getBusyRetryDelayMs(err.retryAfterRaw, busyRetryDelayMs), signal)
      }
    }
  },
  pollPptxJob: (jobId, opts = {}) => {
    const init = opts.signal ? { signal: opts.signal } : {}
    return fetch(`${BASE}/pptx/jobs/${jobId}`, init).then(handleResponse)
  },
  cancelPptxJob: (jobId, opts = {}) => {
    const init = { method: 'DELETE', ...(opts.signal ? { signal: opts.signal } : {}) }
    return fetch(`${BASE}/pptx/jobs/${jobId}`, init).then(handleResponse)
  },
  getGithubConfig: () => fetch(`${BASE}/github/config`).then(handleResponse),
  saveGithubConfig: (data) =>
    fetch(`${BASE}/github/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
  pushToGithub: (id, message) =>
    fetch(`${BASE}/presentations/${id}/github/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    }).then(handleResponse),

  // Templates
  getTemplates: () => fetch(`${BASE}/templates`).then(handleResponse),
  getTemplate: (id) => fetch(`${BASE}/templates/${id}`).then(handleResponse),
  createTemplate: (data) =>
    fetch(`${BASE}/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
  updateTemplate: (id, data) =>
    fetch(`${BASE}/templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
  deleteTemplate: (id) =>
    fetch(`${BASE}/templates/${id}`, { method: 'DELETE' }).then(handleResponse),
  saveAsTemplate: (id, title) =>
    fetch(`${BASE}/presentations/${id}/save-as-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    }).then(handleResponse),

  // Version History
  saveSnapshot: (id, name) =>
    fetch(`${BASE}/presentations/${id}/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).then(handleResponse),
  getSnapshots: (id) => fetch(`${BASE}/presentations/${id}/snapshots`).then(handleResponse),
  restoreSnapshot: (id, snapshotId) =>
    fetch(`${BASE}/presentations/${id}/restore/${snapshotId}`, { method: 'POST' }).then(
      handleResponse
    ),
  deleteSnapshot: (id, snapshotId) =>
    fetch(`${BASE}/presentations/${id}/snapshots/${snapshotId}`, { method: 'DELETE' }).then(
      handleResponse
    ),

  // Rclone / Proton Drive
  getRcloneStatus: () => fetch(`${BASE}/rclone/status`).then(handleResponse),
  configureRclone: (data) =>
    fetch(`${BASE}/rclone/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
  syncToRemote: (data) =>
    fetch(`${BASE}/rclone/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
  syncSingleToRemote: (data) =>
    fetch(`${BASE}/rclone/sync-single`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  // Share links
  enableShare: (id) =>
    fetch(`${BASE}/presentations/${id}/share`, { method: 'POST' }).then(handleResponse),
  disableShare: (id) =>
    fetch(`${BASE}/presentations/${id}/share`, { method: 'DELETE' }).then(handleResponse),
  getShareStatus: (id) => fetch(`${BASE}/presentations/${id}/share`).then(handleResponse),

  // Media Library
  getMedia: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return fetch(`${BASE}/media${q ? '?' + q : ''}`).then(handleResponse)
  },
  updateMedia: (id, data) =>
    fetch(`${BASE}/media/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
  deleteMedia: (filename) =>
    fetch(`${BASE}/media/${filename}`, { method: 'DELETE' }).then(handleResponse),

  // Template Marketplace
  getMarketplaceTemplates: (category) => {
    const q = category ? `?category=${category}` : ''
    return fetch(`${BASE}/marketplace/templates${q}`).then(handleResponse)
  },
  getMarketplaceTemplate: (id) => fetch(`${BASE}/marketplace/templates/${id}`).then(handleResponse),
}

const BASE = '/api'

async function handleResponse(r) {
  const body = await r.json().catch(() => ({ error: `HTTP ${r.status}` }))
  if (!r.ok) {
    const err = new Error(body.error || `Request failed (${r.status})`)
    err.status = r.status
    err.retryAfter = Number(r.headers?.get?.('Retry-After') || 0)
    throw err
  }
  return body
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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
      headers: { 'Content-Type': 'application/json' },
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
    } = opts
    const fd = new FormData()
    fd.append('file', file)
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await fetch(`${BASE}/pptx/import`, { method: 'POST', body: fd }).then(handleResponse)
      } catch (err) {
        if (!retryOnBusy || err.status !== 429 || err.message !== 'import-in-progress' || attempt >= maxBusyRetries) {
          throw err
        }
        onBusyRetry?.(attempt + 1)
        await sleep(busyRetryDelayMs)
      }
    }
  },
  pollPptxJob: (jobId) => fetch(`${BASE}/pptx/jobs/${jobId}`).then(handleResponse),
  cancelPptxJob: (jobId) =>
    fetch(`${BASE}/pptx/jobs/${jobId}`, { method: 'DELETE' }).then(handleResponse),
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

const path = require('path')
const { UPLOADS_DIR } = require('../services/storage')

function isWithinUploads(targetPath) {
  const normalizedTarget = path.resolve(targetPath)
  const normalizedUploads = path.resolve(UPLOADS_DIR)
  return (
    normalizedTarget === normalizedUploads ||
    normalizedTarget.startsWith(`${normalizedUploads}${path.sep}`)
  )
}

function normalizeServerImageSource(src) {
  if (!src) return null
  const raw = String(src)

  if (raw.startsWith('data:')) return { data: raw }
  if (raw.startsWith('/uploads/')) {
    const relative = path.posix.normalize(raw.slice('/uploads/'.length))
    if (relative.startsWith('..') || relative.startsWith('/')) return null
    const resolved = path.resolve(UPLOADS_DIR, ...relative.split('/'))
    return isWithinUploads(resolved) ? { path: resolved } : null
  }

  if (path.isAbsolute(raw)) {
    return isWithinUploads(raw) ? { path: raw } : null
  }

  const resolved = path.resolve(raw)
  return isWithinUploads(resolved) ? { path: resolved } : null
}

module.exports = {
  normalizeServerImageSource,
}

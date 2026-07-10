const fs = require('fs-extra')
const path = require('path')
const { STALE_TEMP_UPLOAD_AGE_MS } = require('./constants')

const UUID_PPTX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pptx$/i

async function sweepStaleTempUploads(directory, options = {}) {
  const now = options.now || Date.now()
  const maxAgeMs = options.maxAgeMs || STALE_TEMP_UPLOAD_AGE_MS
  const activePaths = options.activePaths || new Set()
  const names = await fs.readdir(directory).catch(() => [])
  const removed = []
  for (const name of names) {
    if (!UUID_PPTX.test(name)) continue
    const filePath = path.join(directory, name)
    if (activePaths.has(filePath)) continue
    const stat = await fs.stat(filePath).catch(() => null)
    if (!stat || now - stat.mtimeMs <= maxAgeMs) continue
    try {
      await fs.unlink(filePath)
      removed.push(filePath)
    } catch {
      // A concurrent import or cleanup may already own/remove this file.
    }
  }
  return removed
}

module.exports = { sweepStaleTempUploads }

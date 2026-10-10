const path = require('node:path').posix
const { collectMediaUrls } = require('./project-import-presentation')

function fileName(value) {
  try {
    return path.basename(new URL(String(value), 'http://navslides.local').pathname)
  } catch {
    return path.basename(String(value || ''))
  }
}


function buildLegacyMediaInventory(presentation, archivePaths) {
  const candidates = new Map()
  for (const url of collectMediaUrls(presentation)) {
    const name = fileName(url)
    if (!candidates.has(name)) candidates.set(name, [])
    candidates.get(name).push(url)
  }
  return archivePaths.map((archivePath) => {
    const filename = path.basename(archivePath)
    const matching = candidates.get(filename) || []
    return {
      archivePath,
      filename,
      originalUrl: matching.shift() || `/uploads/${filename}`,
    }
  })
}

module.exports = { buildLegacyMediaInventory }

const path = require('node:path').posix
const { collectGameMediaReferences } = require('revealjs-shared')

function fileName(value) {
  try {
    return path.basename(new URL(String(value), 'http://navslides.local').pathname)
  } catch {
    return path.basename(String(value || ''))
  }
}

function collectMediaUrls(presentation) {
  return collectGameMediaReferences(presentation).map(({ url }) => url)
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

module.exports = { buildLegacyMediaInventory, collectMediaUrls }

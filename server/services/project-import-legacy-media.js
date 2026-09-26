const path = require('node:path').posix

function fileName(value) {
  try {
    return path.basename(new URL(String(value), 'http://navslides.local').pathname)
  } catch {
    return path.basename(String(value || ''))
  }
}

function collectMediaUrls(presentation) {
  const urls = []
  const add = (value) => {
    if (typeof value === 'string' && value) urls.push(value)
  }
  const visit = (slides) => (slides || []).forEach((slide) => {
    const background = slide?.background
    if (background?.type === 'image') add(background.image || background.src)
    for (const element of slide?.elements || []) {
      add(element.src)
      add(element.poster)
      for (const track of element.tracks || []) add(track?.src)
    }
    visit(slide?.children)
  })
  visit(presentation?.slides)
  return urls
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

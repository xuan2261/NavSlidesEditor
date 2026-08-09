const fs = require('node:fs/promises')
const path = require('node:path')
const {
  classifyPptxMediaSource,
  classifyPptxPosterSource,
} = require('revealjs-shared')
const { UPLOADS_DIR } = require('../services/storage')
const { normalizeServerImageSource } = require('./server-image-source')

const POSTER_MIMES = Object.freeze({
  gif: ['image/gif'],
  jpeg: ['image/jpeg'],
  jpg: ['image/jpeg'],
  png: ['image/png'],
  webp: ['image/webp'],
})

function isWithinRoot(root, target) {
  const relative = path.relative(root, target)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

async function readValidatedUpload(source) {
  const normalized = normalizeServerImageSource(source)
  if (!normalized?.path) return null
  try {
    const [realRoot, realTarget] = await Promise.all([
      fs.realpath(UPLOADS_DIR),
      fs.realpath(normalized.path),
    ])
    if (!isWithinRoot(realRoot, realTarget)) return null
    const stat = await fs.stat(realTarget)
    if (!stat.isFile() || stat.size <= 0 || stat.size > 100 * 1024 * 1024) return null
    return fs.readFile(realTarget)
  } catch {
    return null
  }
}

async function detectAcceptedData(source, acceptedMimeTypes) {
  const bytes = await readValidatedUpload(source)
  if (!bytes) return null
  try {
    const { fileTypeFromBuffer } = await import('file-type')
    const detected = await fileTypeFromBuffer(Uint8Array.from(bytes))
    if (!detected || !acceptedMimeTypes.includes(detected.mime)) return null
    return `data:${detected.mime};base64,${Buffer.from(bytes).toString('base64')}`
  } catch {
    return null
  }
}

async function resolveServerPptxMedia(element) {
  const classified = classifyPptxMediaSource(element)
  if (!classified.embeddable) return { ...classified, embedded: false }

  const data = await detectAcceptedData(classified.source, classified.acceptedMimeTypes)
  if (!data) {
    return { ...classified, embedded: false, reason: 'upload-mime-mismatch-or-unavailable' }
  }

  let cover
  if (element.type === 'video') {
    const poster = classifyPptxPosterSource(element.poster, { embeddedCover: true })
    if (poster) {
      cover = (await detectAcceptedData(poster.source, ['image/png'])) || undefined
    }
  }
  return { ...classified, embedded: true, data, cover }
}

async function resolveServerPptxPoster(source) {
  const poster = classifyPptxPosterSource(source)
  if (!poster) return null
  return detectAcceptedData(poster.source, POSTER_MIMES[poster.extension] || [])
}

module.exports = {
  readValidatedUpload,
  resolveServerPptxMedia,
  resolveServerPptxPoster,
}

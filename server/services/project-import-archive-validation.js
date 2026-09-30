const path = require('node:path').posix
const crypto = require('node:crypto')
const { createPresentationSchema } = require('../middleware/schemas')

const SAFE_MEDIA_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico',
  '.mp4', '.webm', '.ogg', '.ogv', '.mov', '.avi',
  '.mp3', '.wav', '.flac', '.aac', '.m4a', '.pdf', '.vtt',
])

function importError(code, message, status = 400, details = {}) {
  return Object.assign(new Error(message), { code, status, ...details })
}

function assertArchivePath(name, limits) {
  const depth = name.split('/').filter(Boolean).length - 1
  if (name.length > limits.maxPathLength) {
    throw importError('PROJECT_ARCHIVE_PATH_LIMIT', 'Archive path is too long', 413)
  }
  if (depth > limits.maxNesting) {
    throw importError('PROJECT_ARCHIVE_NESTING_LIMIT', 'Archive nesting is too deep', 413)
  }
  const allowed = ['manifest.json', 'presentation.json', 'presentation.html'].includes(name)
  if (!allowed && !/^media\/[^/]+$/u.test(name)) {
    throw importError('PROJECT_ARCHIVE_ENTRY_REJECTED', 'Archive contains an unexpected entry')
  }
  if (name.startsWith('media/') && !SAFE_MEDIA_EXTENSIONS.has(path.extname(name).toLowerCase())) {
    throw importError('PROJECT_MEDIA_TYPE_REJECTED', 'Archive media type is not allowed')
  }
}

function inspectPresentation(presentation, limits) {
  if (!presentation || typeof presentation !== 'object' || !Array.isArray(presentation.slides)) {
    throw importError('PROJECT_PRESENTATION_INVALID', 'Presentation slides must be an array')
  }
  let slides = 0
  let elements = 0
  let maxString = 0
  const walk = (value) => {
    if (typeof value === 'string') maxString = Math.max(maxString, Buffer.byteLength(value))
    else if (Array.isArray(value)) value.forEach(walk)
    else if (value && typeof value === 'object') Object.values(value).forEach(walk)
  }
  const visitSlides = (items) => {
    for (const slide of items || []) {
      slides += 1
      elements += Array.isArray(slide?.elements) ? slide.elements.length : 0
      visitSlides(slide?.children)
    }
  }
  walk(presentation)
  visitSlides(presentation.slides)
  if (maxString > limits.maxStringBytes || slides > limits.maxSlides || elements > limits.maxElements) {
    throw importError('PROJECT_PRESENTATION_BUDGET_EXCEEDED', 'Presentation exceeds content budget', 413)
  }
  if (!createPresentationSchema.safeParse(presentation).success) {
    throw importError('PROJECT_PRESENTATION_INVALID', 'Presentation schema is invalid')
  }
}

function activeContentInventory(presentation) {
  const inventory = new Set()
  if (presentation?.customCSS) inventory.add('custom-css')
  if (presentation?.customJS || presentation?.customScript) inventory.add('custom-javascript')
  const visit = (slides) => (slides || []).forEach((slide) => {
    ;(slide?.elements || []).forEach((element) => {
      if (element?.type === 'html' && String(element.content || element.html || '').trim()) {
        inventory.add('html-element')
      }
    })
    visit(slide?.children)
  })
  visit(presentation?.slides)
  return [...inventory].sort()
}

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

module.exports = {
  activeContentInventory,
  assertArchivePath,
  digest,
  importError,
  inspectPresentation,
}

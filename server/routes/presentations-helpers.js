const fs = require('fs-extra')
const path = require('path')
const { readTemplates, DATA_DIR } = require('../services/storage')
const { normalizeBuiltInTemplates } = require('../services/template-normalization')
const { readAuthoritativePresentation } = require('../services/package-backed-presentation-read')
const liveRooms = require('../services/live-rooms')
const { hashCanonical } = require('../services/pptx-import/evidence/canonical-hash')

const uuidv4 = () => require('node:crypto').randomUUID()
const UPLOAD_HASHES_FILE = path.join(DATA_DIR, 'upload-hashes.json')

function isSafePresentationId(value) {
  return typeof value === 'string' && value.length > 0 && value !== '.' && value !== '..' &&
    !value.includes('/') && !value.includes('\\') &&
    !value.includes(String.fromCharCode(0))
}

async function readPresentablePresentation(id) {
  const resolved = await readAuthoritativePresentation(id)
  if (resolved?.presentation) return resolved.presentation

  const templates = await readTemplates()
  const template = templates.find((item) => item.id === id)
  if (template) return template

  try {
    const builtIn = await fs.readJson(path.join(__dirname, '..', 'data', 'built-in-templates.json'))
    return normalizeBuiltInTemplates(builtIn).find((item) => item.id === id) || null
  } catch {
    return null
  }
}

function isCurrentPresenterBootstrap(expected, currentRoom) {
  return Boolean(
    currentRoom &&
    expected &&
    currentRoom === expected.room &&
    currentRoom.presenterId === expected.presenterId &&
    currentRoom.presenterConnected === true &&
    currentRoom.presentationId === expected.presentationId &&
    currentRoom.presentationGeneration === expected.presentationGeneration &&
    liveRooms.isValidPresenterToken(currentRoom, expected.presenterToken)
  )
}

function packageIdentityForFidelity(presentation) {
  const head = presentation?.pptxAggregateHead
  if (typeof head?.packageRevisionId !== 'string' || !head.packageRevisionId) return undefined
  return { revisionId: head.packageRevisionId, headHash: hashCanonical(head) }
}

function getUploadMimeType(filename) {
  const ext = path.extname(filename).toLowerCase()
  const mimeMap = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp', '.ico': 'image/x-icon',
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogv': 'video/ogg',
    '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
    '.flac': 'audio/flac', '.aac': 'audio/aac', '.m4a': 'audio/mp4',
    '.pdf': 'application/pdf',
  }
  return mimeMap[ext] || 'application/octet-stream'
}

function getUploadFilenameFromUrl(value) {
  if (!value || typeof value !== 'string') return null
  const match = value.match(/\/uploads\/([^?#]+)/)
  if (!match) return null
  return path.basename(decodeURIComponent(match[1]))
}

function collectPresentationUploadRefs(presentation) {
  const refs = new Set()
  for (const slide of presentation?.slides || []) {
    for (const element of slide.elements || []) {
      ;[element.src, element.videoUrl, element.poster].forEach((value) => {
        const filename = getUploadFilenameFromUrl(value)
        if (filename) refs.add(filename)
      })
    }
  }
  return refs
}

async function readUploadHashes() {
  try {
    return await fs.readJson(UPLOAD_HASHES_FILE)
  } catch {
    return {}
  }
}

function getLocalBaseUrl(req) {
  const localPort = req.socket?.localPort || process.env.PORT
  const host = req.get('host')
  if (localPort) return `http://127.0.0.1:${localPort}`
  return host ? `${req.protocol || 'http'}://${host}` : ''
}

module.exports = {
  uuidv4,
  UPLOAD_HASHES_FILE,
  isSafePresentationId,
  readPresentablePresentation,
  isCurrentPresenterBootstrap,
  packageIdentityForFidelity,
  getUploadMimeType,
  getUploadFilenameFromUrl,
  collectPresentationUploadRefs,
  readUploadHashes,
  getLocalBaseUrl,
}

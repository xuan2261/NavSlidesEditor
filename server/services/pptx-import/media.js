const fs = require('fs-extra')
const path = require('path')
const uuidv4 = () => require('node:crypto').randomUUID()
const { UPLOADS_DIR } = require('../storage')

const MAX_MEDIA_SIZE = 200 * 1024 * 1024 // 200MB per file

const MIME_EXTENSIONS = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/gif', 'gif'],
  ['image/webp', 'webp'],
  ['image/bmp', 'bmp'],
])

function sniffImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null
  if (buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) {
    return { mime: 'image/png', ext: 'png' }
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' }
  }
  const head = buffer.subarray(0, 6).toString('ascii')
  if (head === 'GIF87a' || head === 'GIF89a') return { mime: 'image/gif', ext: 'gif' }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { mime: 'image/webp', ext: 'webp' }
  }
  if (buffer.subarray(0, 2).toString('ascii') === 'BM') return { mime: 'image/bmp', ext: 'bmp' }
  return null
}

function createMediaIndex(zip) {
  const files = new Map()
  for (const entry of Object.values(zip.files)) {
    if (!entry.dir && entry.name.startsWith('ppt/media/')) {
      files.set(entry.name.replace(/\\/g, '/'), entry)
    }
  }
  return { files }
}

function parseDataUrl(value) {
  if (typeof value !== 'string') return null
  const match = value.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i)
  if (!match) return null
  return { mime: match[1].toLowerCase(), buffer: Buffer.from(match[2], 'base64') }
}

function getElementImagePayload(element) {
  const candidates = [
    element?.base64,
    element?.src,
    element?.blob,
    element?.fill?.value?.base64,
    element?.fill?.value?.blob,
  ]
  for (const candidate of candidates) {
    const parsed = parseDataUrl(candidate)
    if (parsed) return parsed
  }
  return null
}

async function detectImage(buffer, hintedMime) {
  const detected = sniffImage(buffer)
  if (!detected || (hintedMime && hintedMime !== detected.mime)) return null
  return { mime: detected.mime, ext: MIME_EXTENSIONS.get(detected.mime) }
}

async function persistImageBuffer(buffer, hintedMime, uploadsDir = UPLOADS_DIR) {
  if (buffer.length > MAX_MEDIA_SIZE) return null
  const detected = await detectImage(buffer, hintedMime)
  if (!detected) return null
  await fs.ensureDir(uploadsDir)
  const filename = `${uuidv4()}.${detected.ext}`
  await fs.writeFile(path.join(uploadsDir, filename), buffer)
  return `/uploads/${filename}`
}

async function persistZipMediaRef(mediaIndex, ref, uploadsDir = UPLOADS_DIR) {
  const normalized = String(ref || '').replace(/\\/g, '/').replace(/^\/+/, '')
  const entry = mediaIndex.files.get(normalized)
  if (!entry) return null
  const buffer = await entry.async('nodebuffer')
  return persistImageBuffer(buffer, null, uploadsDir)
}

async function persistMediaBlob(mediaIndex, ref, uploadsDir = UPLOADS_DIR) {
  const normalized = String(ref || '').replace(/\\/g, '/').replace(/^\/+/, '')
  const entry = mediaIndex.files.get(normalized)
  if (!entry) return null
  const buffer = await entry.async('nodebuffer')
  if (buffer.length > MAX_MEDIA_SIZE) return null
  const ext = normalized.split('.').pop()?.toLowerCase() || 'bin'
  await fs.ensureDir(uploadsDir)
  const filename = `${uuidv4()}.${ext}`
  await fs.writeFile(path.join(uploadsDir, filename), buffer)
  return `/uploads/${filename}`
}

async function persistImageForElement(element, mediaIndex, uploadsDir = UPLOADS_DIR) {
  const payload = getElementImagePayload(element)
  if (payload) {
    const url = await persistImageBuffer(payload.buffer, payload.mime, uploadsDir)
    if (url) return url
  }

  const refs = [element?.ref, element?.fill?.value?.ref].filter(Boolean)
  for (const ref of refs) {
    const url = await persistZipMediaRef(mediaIndex, ref, uploadsDir)
    if (url) return url
  }
  return null
}

module.exports = {
  MAX_MEDIA_SIZE,
  createMediaIndex,
  getElementImagePayload,
  persistImageBuffer,
  persistImageForElement,
  persistZipMediaRef,
  persistMediaBlob,
}

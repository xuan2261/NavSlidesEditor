const path = require('path')
const { UPLOADS_DIR } = require('../storage')
const { ALLOWED_MEDIA_EXTENSIONS } = require('./constants')
const { persistDedupedBuffer } = require('./media-dedup')

const MAX_MEDIA_SIZE = 200 * 1024 * 1024 // 200MB per file

const MIME_EXTENSIONS = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/gif', 'gif'],
  ['image/webp', 'webp'],
  ['image/bmp', 'bmp'],
  ['image/x-emf', 'emf'],
  ['image/x-wmf', 'wmf'],
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
  if (buffer.subarray(0, 4).equals(Buffer.from([0x01, 0x00, 0x00, 0x00]))) {
    return { mime: 'image/x-emf', ext: 'emf', unsupportedBrowserImage: true }
  }
  if (buffer.subarray(0, 4).equals(Buffer.from([0xd7, 0xcd, 0xc6, 0x9a]))) {
    return { mime: 'image/x-wmf', ext: 'wmf', unsupportedBrowserImage: true }
  }
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

function toNodeBuffer(value) {
  if (Buffer.isBuffer(value)) return value
  if (value instanceof Uint8Array) return Buffer.from(value)
  if (Array.isArray(value?.data)) return Buffer.from(value.data)
  return Buffer.from(value)
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
  if (!detected) return null
  return {
    mime: detected.mime,
    ext: MIME_EXTENSIONS.get(detected.mime),
    hintMismatch: Boolean(hintedMime && hintedMime !== detected.mime),
    unsupportedBrowserImage: detected.unsupportedBrowserImage,
  }
}

async function persistImageBuffer(buffer, hintedMime, uploadsDir = UPLOADS_DIR, options = {}) {
  options.signal?.throwIfAborted?.()
  if (buffer.length > MAX_MEDIA_SIZE) {
    return { url: null, warning: { code: 'media-too-large', byteLength: buffer.length } }
  }
  const detected = await detectImage(buffer, hintedMime)
  if (!detected) {
    return { url: null, warning: { code: 'image-detect-failed', byteLength: buffer.length } }
  }
  const media = await persistDedupedBuffer(buffer, detected.ext, uploadsDir, {
    mimeType: detected.mime,
    originalName: `pptx-image.${detected.ext}`,
    signal: options.signal,
  })
  const warning = detected.unsupportedBrowserImage
    ? { code: 'image-format-preserved-with-limited-browser-support', detected: detected.mime }
    : detected.hintMismatch
      ? { code: 'image-mime-hint-mismatch', detected: detected.mime, hinted: hintedMime }
      : undefined
  return { url: media.url, warning }
}

async function persistZipMediaRef(mediaIndex, ref, uploadsDir = UPLOADS_DIR, options = {}) {
  const normalized = String(ref || '').replace(/\\/g, '/').replace(/^\/+/, '')
  const entry = mediaIndex.files.get(normalized)
  if (!entry) return { url: null, warning: { code: 'media-ref-missing', ref: normalized } }
  options.signal?.throwIfAborted?.()
  const buffer = toNodeBuffer(await entry.async('nodebuffer'))
  return persistImageBuffer(buffer, null, uploadsDir, options)
}

async function persistMediaBlob(mediaIndex, ref, uploadsDir = UPLOADS_DIR, options = {}) {
  const normalized = String(ref || '').replace(/\\/g, '/').replace(/^\/+/, '')
  const entry = mediaIndex.files.get(normalized)
  if (!entry) return { url: null, warning: { code: 'media-ref-missing', ref: normalized } }
  options.signal?.throwIfAborted?.()
  const buffer = toNodeBuffer(await entry.async('nodebuffer'))
  if (buffer.length > MAX_MEDIA_SIZE) {
    return { url: null, warning: { code: 'media-too-large', byteLength: buffer.length } }
  }
  const ext = path.posix.extname(normalized).toLowerCase().slice(1)
  if (!ext || !ALLOWED_MEDIA_EXTENSIONS.has(ext)) {
    return { url: null, warning: { code: 'media-extension-rejected', ext } }
  }

  const { fileTypeFromBuffer } = await import('file-type')
  const detected = await fileTypeFromBuffer(Uint8Array.from(buffer))
  let detectedExt = detected?.ext
  if (detectedExt === 'jpg' && ext === 'jpeg') detectedExt = 'jpeg'
  if (detectedExt === 'ogx' && ext === 'ogg') detectedExt = 'ogg'
  if (!detected || !ALLOWED_MEDIA_EXTENSIONS.has(detectedExt) || detectedExt !== ext) {
    return {
      url: null,
      warning: {
        code: 'media-magic-mismatch',
        claimed: ext,
        sniffed: detected?.ext,
        mime: detected?.mime,
      },
    }
  }

  const media = await persistDedupedBuffer(buffer, ext, uploadsDir, {
    mimeType: detected.mime,
    originalName: path.posix.basename(normalized),
    signal: options.signal,
  })
  return { url: media.url }
}

async function persistImageForElement(element, mediaIndex, uploadsDir = UPLOADS_DIR, options = {}) {
  let firstWarning
  const payload = getElementImagePayload(element)
  if (payload) {
    const result = await persistImageBuffer(payload.buffer, payload.mime, uploadsDir, options)
    if (result.url) return result
    firstWarning = result.warning
  }

  const refs = [element?.ref, element?.fill?.value?.ref].filter(Boolean)
  for (const ref of refs) {
    const result = await persistZipMediaRef(mediaIndex, ref, uploadsDir, options)
    if (result.url) return result
    if (!firstWarning) firstWarning = result.warning
  }
  return { url: null, warning: firstWarning || { code: 'image-detect-failed', byteLength: 0 } }
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

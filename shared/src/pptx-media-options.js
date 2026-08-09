const MEDIA_BY_EXTENSION = Object.freeze({
  audio: Object.freeze({
    aac: Object.freeze(['audio/aac']),
    m4a: Object.freeze(['audio/mp4', 'audio/x-m4a']),
    mp3: Object.freeze(['audio/mpeg']),
    wav: Object.freeze(['audio/wav', 'audio/x-wav']),
  }),
  video: Object.freeze({
    mov: Object.freeze(['video/quicktime']),
    mp4: Object.freeze(['video/mp4']),
  }),
})

const STATIC_POSTER_EXTENSIONS = new Set(['gif', 'jpeg', 'jpg', 'png', 'webp'])

function ascii(bytes, start, value) {
  if (bytes.length < start + value.length) return false
  return [...value].every((character, index) => bytes[start + index] === character.charCodeAt(0))
}

function hasPptxUploadSignature(input, extension) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input || 0)
  switch (extension) {
    case 'aac':
      return bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0
    case 'm4a':
    case 'mov':
    case 'mp4':
      return ascii(bytes, 4, 'ftyp')
    case 'mp3':
      return ascii(bytes, 0, 'ID3') || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
    case 'wav':
      return ascii(bytes, 0, 'RIFF') && ascii(bytes, 8, 'WAVE')
    case 'gif':
      return ascii(bytes, 0, 'GIF87a') || ascii(bytes, 0, 'GIF89a')
    case 'jpeg':
    case 'jpg':
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    case 'png':
      return (
        bytes[0] === 0x89 &&
        ascii(bytes, 1, 'PNG') &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
      )
    case 'webp':
      return ascii(bytes, 0, 'RIFF') && ascii(bytes, 8, 'WEBP')
    default:
      return false
  }
}

function parseUploadSource(source) {
  const raw = String(source || '').trim()
  if (!raw.startsWith('/uploads/') || raw.includes('?') || raw.includes('#')) return null

  try {
    const decoded = decodeURIComponent(raw)
    if (!decoded.startsWith('/uploads/') || decoded.includes('\\')) return null
    const relative = decoded.slice('/uploads/'.length)
    const segments = relative.split('/')
    if (!relative || segments.some((segment) => !segment || segment === '.' || segment === '..')) {
      return null
    }
    const filename = segments.at(-1)
    const dot = filename.lastIndexOf('.')
    if (dot <= 0 || dot === filename.length - 1) return null
    return { source: raw, extension: filename.slice(dot + 1).toLowerCase() }
  } catch {
    return null
  }
}

function getPptxMediaSource(element) {
  if (!element || !['audio', 'video'].includes(element.type)) return ''
  if (Object.prototype.hasOwnProperty.call(element, 'src')) return element.src || ''
  return element.type === 'video' ? element.videoUrl || '' : ''
}

function classifyPptxMediaSource(element) {
  const source = getPptxMediaSource(element)
  const upload = parseUploadSource(source)
  if (!upload) return { embeddable: false, reason: 'source-not-validated-upload' }

  const supported = MEDIA_BY_EXTENSION[element.type]?.[upload.extension]
  if (!supported) {
    return { embeddable: false, reason: 'unsupported-media-type', source: upload.source }
  }
  return {
    embeddable: true,
    source: upload.source,
    extension: upload.extension,
    acceptedMimeTypes: supported,
    mediaType: element.type,
  }
}

function classifyPptxPosterSource(source, { embeddedCover = false } = {}) {
  const upload = parseUploadSource(source)
  if (!upload || !STATIC_POSTER_EXTENSIONS.has(upload.extension)) return null
  if (embeddedCover && upload.extension !== 'png') return null
  return upload
}

function getUnsupportedPptxMediaSemantics(element) {
  if (!element || !['audio', 'video'].includes(element.type)) return []
  const semantics = []
  if (Number(element.startTime) > 0 || Number(element.endTime) > 0) semantics.push('trim')
  if (Number.isFinite(Number(element.playbackRate)) && Number(element.playbackRate) !== 1) {
    semantics.push('playback speed')
  }
  if (element.autoplay === true) semantics.push('autoplay')
  if (element.loop === true) semantics.push('loop')
  if (element.muted === true) semantics.push('muted')
  return semantics
}

function getPptxMediaSemanticWarning(element, slideNumber) {
  const semantics = getUnsupportedPptxMediaSemantics(element)
  if (!semantics.length) return null
  return `Slide ${slideNumber}: browser-only ${semantics.join(', ')} ${semantics.length === 1 ? 'setting is' : 'settings are'} not preserved for ${element.type} in PPTX`
}

module.exports = {
  MEDIA_BY_EXTENSION,
  classifyPptxMediaSource,
  classifyPptxPosterSource,
  getPptxMediaSemanticWarning,
  getPptxMediaSource,
  getUnsupportedPptxMediaSemantics,
  hasPptxUploadSignature,
  parseUploadSource,
}

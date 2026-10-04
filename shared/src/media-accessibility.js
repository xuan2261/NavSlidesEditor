const { sanitizeMediaSrc } = require('./content-safety.js')

const MAX_IMAGE_ALT_LENGTH = 500
const MAX_LONG_DESCRIPTION_LENGTH = 4000
const MAX_MEDIA_DESCRIPTION_LENGTH = 12000
const MAX_TRACKS = 32
const MAX_TRACK_LABEL_LENGTH = 160
const MAX_TRACK_LANGUAGE_LENGTH = 35
const TRACK_KINDS = new Set(['captions', 'subtitles', 'descriptions', 'chapters', 'metadata'])

const MEDIA_CAPTION_STYLE = Object.freeze({
  color: '#f8fafc',
  backgroundColor: '#141413',
  fontFamily: 'sans-serif',
  fontSize: '14px',
  fontWeight: 400,
  lineHeight: 1.5,
  textAlign: 'left',
  padding: '6px 8px',
  margin: 0,
  boxSizing: 'border-box',
})
const MEDIA_CAPTION_CSS = `color:${MEDIA_CAPTION_STYLE.color};background-color:${MEDIA_CAPTION_STYLE.backgroundColor};font-family:${MEDIA_CAPTION_STYLE.fontFamily};font-size:${MEDIA_CAPTION_STYLE.fontSize};font-weight:${MEDIA_CAPTION_STYLE.fontWeight};line-height:${MEDIA_CAPTION_STYLE.lineHeight};text-align:${MEDIA_CAPTION_STYLE.textAlign};padding:${MEDIA_CAPTION_STYLE.padding};margin:${MEDIA_CAPTION_STYLE.margin};box-sizing:${MEDIA_CAPTION_STYLE.boxSizing};`
const MEDIA_CAPTION_TEXT_STYLE = Object.freeze({
  margin: 0,
  padding: 0,
  font: 'inherit',
  color: 'inherit',
})
const MEDIA_CAPTION_TEXT_CSS = `margin:${MEDIA_CAPTION_TEXT_STYLE.margin};padding:${MEDIA_CAPTION_TEXT_STYLE.padding};font:${MEDIA_CAPTION_TEXT_STYLE.font};color:${MEDIA_CAPTION_TEXT_STYLE.color};`

function boundedString(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function sanitizeMediaTrackSrc(value) {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (/^data:/i.test(raw)) {
    return /^data:text\/vtt;base64,(?:[a-z0-9+/]{4})*(?:[a-z0-9+/]{2}==|[a-z0-9+/]{3}=)?$/i.test(
      raw
    ) && raw.length > 'data:text/vtt;base64,'.length
      ? raw
      : ''
  }
  return sanitizeMediaSrc(raw)
}

function normalizeMediaTrack(track) {
  if (!track || typeof track !== 'object') return null
  const src = sanitizeMediaTrackSrc(track.src)
  if (!src) return null
  const kind = TRACK_KINDS.has(track.kind) ? track.kind : 'captions'
  return {
    src,
    srcLang: boundedString(track.srcLang, MAX_TRACK_LANGUAGE_LENGTH),
    label: boundedString(track.label, MAX_TRACK_LABEL_LENGTH),
    kind,
    default: track.default === true,
  }
}

function normalizeMediaTracks(tracks) {
  if (!Array.isArray(tracks)) return []
  let hasDefault = false
  return tracks.slice(0, MAX_TRACKS).flatMap((track) => {
    const normalized = normalizeMediaTrack(track)
    if (!normalized) return []
    if (normalized.default && hasDefault) normalized.default = false
    if (normalized.default) hasDefault = true
    return [normalized]
  })
}

function normalizeImageAccessibility(element) {
  if (element?.type !== 'image') return element
  const decorative = element.decorative === true
  const normalized = {
    ...element,
    alt: decorative ? '' : boundedString(element.alt, MAX_IMAGE_ALT_LENGTH),
    decorative,
  }
  const longDescription = boundedString(element.longDescription, MAX_LONG_DESCRIPTION_LENGTH)
  if (longDescription && !decorative) normalized.longDescription = longDescription
  else delete normalized.longDescription
  return normalized
}

function normalizeMediaAccessibility(element) {
  if (!element || !['video', 'audio'].includes(element.type)) return element
  const normalized = { ...element, tracks: normalizeMediaTracks(element.tracks) }
  for (const [key, limit] of [
    ['transcript', MAX_MEDIA_DESCRIPTION_LENGTH],
    ['audioDescription', MAX_MEDIA_DESCRIPTION_LENGTH],
  ]) {
    const value = boundedString(element[key], limit)
    if (value) normalized[key] = value
    else delete normalized[key]
  }
  return normalized
}

function getMediaAccessibilityFindings(element) {
  if (element?.type === 'image') {
    return !element.decorative && !boundedString(element.alt, MAX_IMAGE_ALT_LENGTH)
      ? ['Image needs alternative text or must be marked decorative.']
      : []
  }
  if (!['video', 'audio'].includes(element?.type)) return []
  const findings = []
  const tracks = Array.isArray(element.tracks) ? element.tracks : []
  let defaultCount = 0
  for (const track of tracks) {
    if (!sanitizeMediaTrackSrc(track?.src)) findings.push('Media track source is unsafe.')
    if (!boundedString(track?.label, MAX_TRACK_LABEL_LENGTH))
      findings.push('Media track needs a label.')
    if (!boundedString(track?.srcLang, MAX_TRACK_LANGUAGE_LENGTH))
      findings.push('Media track needs a language.')
    if (track?.default === true) defaultCount += 1
  }
  if (defaultCount > 1) findings.push('Only one media track can be the default.')
  return [...new Set(findings)]
}

module.exports = {
  MEDIA_CAPTION_STYLE,
  MEDIA_CAPTION_CSS,
  MEDIA_CAPTION_TEXT_STYLE,
  MEDIA_CAPTION_TEXT_CSS,
  MAX_IMAGE_ALT_LENGTH,
  MAX_LONG_DESCRIPTION_LENGTH,
  MAX_MEDIA_DESCRIPTION_LENGTH,
  MAX_TRACKS,
  TRACK_KINDS,
  normalizeImageAccessibility,
  normalizeMediaAccessibility,
  sanitizeMediaTrackSrc,
  normalizeMediaTrack,
  normalizeMediaTracks,
  getMediaAccessibilityFindings,
}

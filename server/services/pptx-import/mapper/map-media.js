const { buildMediaUrlAllowlist } = require('../constants')
const { fitBoxWithinBounds } = require('../geometry')
const { persistMediaBlob } = require('../media')
const { baseElement, placeholder } = require('./utils-base')
const { mapImage } = require('./map-image')
const { pushMediaWarning } = require('./media-warning')

const MAX_DATA_URL_BYTES = 5 * 1024 * 1024 // 5MB cap for inlined data: images

function gateExternalMediaUrl(ref, context) {
  if (!/^https?:\/\//i.test(ref)) return ref
  let host
  try {
    host = new URL(ref).hostname.toLowerCase()
  } catch {
    pushMediaWarning(context, { code: 'media-external-url-blocked', host: 'invalid-url' })
    return null
  }
  if (buildMediaUrlAllowlist().has(host)) return ref
  pushMediaWarning(context, { code: 'media-external-url-blocked', host })
  return null
}

// Gate a slide-background image src across ALL url-like schemes, not just http(s).
// - http(s): allowlist by host (reuses gateExternalMediaUrl)
// - data:image/*: allowed up to a size cap; other data: MIME types rejected
// - protocol-relative //host: rejected (would resolve to attacker scheme)
// - anything else url-like (other schemes): rejected
// Non-url refs (zip-internal media that already resolved to a base64 blob, or
// local /uploads paths) pass through unchanged.
function gateBackgroundImageSrc(ref, context) {
  const src = String(ref || '')
  if (!src) return src
  if (/^https?:\/\//i.test(src)) return gateExternalMediaUrl(src, context)
  if (/^\/\//.test(src)) {
    pushMediaWarning(context, { code: 'media-external-url-blocked', host: 'protocol-relative' })
    return null
  }
  if (/^data:/i.test(src)) {
    const match = src.match(/^data:(image\/[a-z0-9.+-]+);base64,([\s\S]*)$/i)
    if (!match) {
      pushMediaWarning(context, { code: 'media-external-url-blocked', host: 'data-url' })
      return null
    }
    const approxBytes = Math.floor((match[2].length * 3) / 4)
    if (approxBytes > MAX_DATA_URL_BYTES) {
      pushMediaWarning(context, { code: 'media-too-large', byteLength: approxBytes })
      return null
    }
    return src
  }
  // Reject any other explicit scheme (javascript:, file:, etc).
  if (/^[a-z][a-z0-9+.-]*:/i.test(src)) {
    pushMediaWarning(context, { code: 'media-external-url-blocked', host: 'scheme-blocked' })
    return null
  }
  return src
}

async function mapVideo(element, context) {
  const ref = element.ref || ''
  if (/^https?:\/\//i.test(ref)) {
    const src = gateExternalMediaUrl(ref, context)
    if (!src) return [placeholder(element, context.scale, context.zIndex, context.slideIndex, context.warnings, 'video-missing', 'Video media unavailable')]
    context.stats.videoCount = (context.stats.videoCount || 0) + 1
    return [{ ...baseElement(element, context.scale, context.zIndex), type: 'video', src, controls: true, autoplay: false, loop: false, muted: false }]
  }
  context.signal?.throwIfAborted?.()
  const media = await persistMediaBlob(context.mediaIndex, ref, context.uploadsDir, {
    signal: context.signal,
    mediaBudget: context.mediaBudget,
    mediaTransaction: context.mediaTransaction,
  })
  pushMediaWarning(context, media.warning)
  const src = media.url
  if (!src) return [placeholder(element, context.scale, context.zIndex, context.slideIndex, context.warnings, 'video-missing', 'Video media unavailable')]
  context.stats.videoCount = (context.stats.videoCount || 0) + 1
  return [{ ...baseElement(element, context.scale, context.zIndex), type: 'video', src, controls: true, autoplay: false, loop: false, muted: false }]
}

async function mapAudio(element, context) {
  const ref = element.ref || ''
  if (/^https?:\/\//i.test(ref)) {
    const src = gateExternalMediaUrl(ref, context)
    if (!src) return [placeholder(element, context.scale, context.zIndex, context.slideIndex, context.warnings, 'audio-missing', 'Audio media unavailable')]
    context.stats.audioCount = (context.stats.audioCount || 0) + 1
    return [{ ...baseElement(element, context.scale, context.zIndex), type: 'audio', src, autoplay: false, loop: false, muted: false }]
  }
  context.signal?.throwIfAborted?.()
  const media = await persistMediaBlob(context.mediaIndex, ref, context.uploadsDir, {
    signal: context.signal,
    mediaBudget: context.mediaBudget,
    mediaTransaction: context.mediaTransaction,
  })
  pushMediaWarning(context, media.warning)
  const src = media.url
  if (!src) return [placeholder(element, context.scale, context.zIndex, context.slideIndex, context.warnings, 'audio-missing', 'Audio media unavailable')]
  context.stats.audioCount = (context.stats.audioCount || 0) + 1
  return [{ ...baseElement(element, context.scale, context.zIndex), type: 'audio', src, autoplay: false, loop: false, muted: false }]
}

function mapMath(element, context) {
  const latex = element.latex || element.text || ''
  if (!latex) {
    if (element.picBase64) return mapImage({ ...element, type: 'image', base64: element.picBase64 }, context)
    return [placeholder(element, context.scale, context.zIndex, context.slideIndex, context.warnings, 'math', 'Math equation')]
  }
  const cleanLatex = latex.replace(/<\/?[a-z][^>]*>/gi, '').trim()
  if (!cleanLatex) {
    if (element.picBase64) return mapImage({ ...element, type: 'image', base64: element.picBase64 }, context)
    return [placeholder(element, context.scale, context.zIndex, context.slideIndex, context.warnings, 'math', 'Math equation')]
  }
  context.stats.mathCount = (context.stats.mathCount || 0) + 1
  const box = baseElement(element, context.scale, context.zIndex)
  return [{
    ...box,
    ...fitBoxWithinBounds(box),
    type: 'latex',
    content: cleanLatex,
    latex: cleanLatex,
    _fallbackSrc: element.picBase64 || null,
  }]
}

module.exports = {
  gateBackgroundImageSrc,
  gateExternalMediaUrl,
  mapAudio,
  mapMath,
  mapVideo,
}

const { buildMediaUrlAllowlist } = require('../constants')
const { persistMediaBlob } = require('../media')
const { baseElement, placeholder } = require('./utils-base')
const { mapImage } = require('./map-image')
const { pushMediaWarning } = require('./media-warning')

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

async function mapVideo(element, context) {
  const ref = element.ref || ''
  if (/^https?:\/\//i.test(ref)) {
    const src = gateExternalMediaUrl(ref, context)
    if (!src) return [placeholder(element, context.scale, context.zIndex, context.slideIndex, context.warnings, 'video-missing', 'Video media unavailable')]
    context.stats.videoCount = (context.stats.videoCount || 0) + 1
    return [{ ...baseElement(element, context.scale, context.zIndex), type: 'video', src, controls: true, autoplay: false, loop: false, muted: false }]
  }
  context.signal?.throwIfAborted?.()
  const media = await persistMediaBlob(context.mediaIndex, ref, context.uploadsDir, { signal: context.signal })
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
  const media = await persistMediaBlob(context.mediaIndex, ref, context.uploadsDir, { signal: context.signal })
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
  return [{
    ...baseElement(element, context.scale, context.zIndex),
    type: 'latex',
    content: cleanLatex,
    latex: cleanLatex,
    _fallbackSrc: element.picBase64 || null,
  }]
}

module.exports = {
  gateExternalMediaUrl,
  mapAudio,
  mapMath,
  mapVideo,
}

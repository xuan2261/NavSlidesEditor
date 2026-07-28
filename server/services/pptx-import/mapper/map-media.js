const crypto = require('node:crypto')
const net = require('node:net')
const { buildMediaUrlAllowlist } = require('../constants')
const { fitBoxWithinBounds } = require('../geometry')
const { persistMediaBlob } = require('../media')
const { baseElement, placeholder } = require('./utils-base')
const { mapImage } = require('./map-image')
const { pushMediaWarning } = require('./media-warning')

const MAX_DATA_URL_BYTES = 5 * 1024 * 1024 // 5MB cap for inlined data: images

function isPrivateIpv4(hostname) {
  const octets = hostname.split('.').map(Number)
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return false
  const [a, b] = octets
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
}

// An IPv6 literal can carry an IPv4 address in its low 32 bits, and reaches the
// same host as the bare IPv4 address, so judge the address it carries. URL
// parsing normalizes the readable form to hex (::ffff:127.0.0.1 arrives here as
// ::ffff:7f00:1), so the hex branch is the one that fires in practice.
function embeddedIpv4(host) {
  const dotted = host.match(/(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (dotted) return dotted[1]
  const hex = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (!hex) return null
  const [high, low] = [parseInt(hex[1], 16), parseInt(hex[2], 16)]
  return [high >> 8, high & 255, low >> 8, low & 255].join('.')
}

function isPrivateHost(hostname) {
  const host = String(hostname || '').replace(/^\[|\]$/g, '').toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true
  if (net.isIPv4(host)) return isPrivateIpv4(host)
  if (!net.isIPv6(host)) return false
  // '::' is the unspecified address and routes to loopback on most stacks;
  // 64:ff9b::/96 is the NAT64 translation prefix and has no business here.
  if (host === '::' || host === '::1' || host.startsWith('64:ff9b:')) return true
  const embedded = embeddedIpv4(host)
  if (embedded) return isPrivateIpv4(embedded)
  return /^(fc|fd|fe8|fe9|fea|feb)/.test(host)
}

function gateExternalMediaUrl(ref, context) {
  if (!/^https?:\/\//i.test(ref)) return ref
  let parsed
  try {
    parsed = new URL(ref)
  } catch {
    pushMediaWarning(context, { code: 'media-external-url-blocked', host: 'invalid-url' })
    return null
  }
  const host = parsed.hostname.toLowerCase()
  if (parsed.username || parsed.password || isPrivateHost(host) || !buildMediaUrlAllowlist().has(parsed.origin)) {
    pushMediaWarning(context, { code: 'media-external-url-blocked', host })
    return null
  }
  return ref
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
    // Shared aggregate media budget when provided (cannot bypass import-wide
    // accounting). Keyed by content, because one template background repeated on
    // every slide is one image, and charging it per slide would exhaust the
    // budget on a deck whose real media still has to fit.
    //
    // Keyed on the encoded payload rather than the decoded bytes: the group is
    // whitespace-tolerant, so two encodings of one image would key apart and be
    // charged twice. That errs toward charging more, never less, and avoids
    // decoding megabytes of base64 on every slide just to compute a key.
    const contentKey = crypto.createHash('sha256').update(match[2]).digest('hex')
    if (context?.mediaBudget?.tryReserve && !context.mediaBudget.tryReserve(approxBytes, contentKey)) {
      pushMediaWarning(context, { code: 'media-budget-exceeded', byteLength: approxBytes })
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

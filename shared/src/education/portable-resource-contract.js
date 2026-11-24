const PORTABLE_RESOURCE_KINDS = Object.freeze([
  'script',
  'style',
  'image',
  'media',
  'font',
  'frame',
  'connect',
])
const PORTABLE_LIMITS = Object.freeze({
  maxDepth: 24,
  maxResources: 1024,
  maxResourceBytes: 32 * 1024 * 1024,
  maxTotalBytes: 128 * 1024 * 1024,
  timeoutMs: 15000,
})
class PortableResourceError extends Error {
  constructor(code, url, context = {}, detail = '') {
    const remedy =
      code === 'authority'
        ? 'Generate local classroom HTML without live host credentials or bootstrap.'
        : code === 'manifest' || code === 'undeclared'
          ? 'Declare every finite offline dependency, or use hosted Share for online content.'
          : code === 'size'
            ? 'Reduce the asset size or explicitly increase the portable export budget.'
            : code === 'cycle' || code === 'depth'
              ? 'Remove the recursive resource reference or reduce nesting.'
              : code === 'mime'
                ? 'Serve the resource with its correct MIME type, or upload the correct file.'
                : 'Upload the resource locally or enable CORS for this origin; alternatively use hosted Share.'
    super(
      `Portable export ${code}: ${url || '(inline document)'}${context.slideId ? `; slide ${context.slideId}` : ''}${context.elementId ? `; element ${context.elementId}` : ''}${detail ? `; ${detail}` : ''}. ${remedy}`
    )
    this.name = 'PortableResourceError'
    Object.assign(this, {
      code,
      url,
      slideId: context.slideId,
      elementId: context.elementId,
      chain: [...(context.chain || [])],
      remedy,
      detail,
    })
  }
}
function portableLimits(overrides = {}) {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides))
    throw new TypeError('Invalid portable limits')
  const limits = { ...PORTABLE_LIMITS }
  for (const [key, value] of Object.entries(overrides)) {
    if (!Object.hasOwn(limits, key) || !Number.isSafeInteger(value) || value < 1)
      throw new TypeError(`Invalid portable limit: ${key}`)
    limits[key] = value
  }
  return limits
}
function portableMimeMatches(kind, mime) {
  if (!PORTABLE_RESOURCE_KINDS.includes(kind)) return false
  if (kind === 'connect') return Boolean(mime)
  if (kind === 'script')
    return /^(?:text|application)\/(?:javascript|ecmascript|x-javascript)$/.test(mime)
  if (kind === 'style') return mime === 'text/css'
  if (kind === 'frame')
    return ['text/html', 'application/xhtml+xml', 'application/pdf'].includes(mime)
  if (kind === 'image') return mime.startsWith('image/')
  if (kind === 'font')
    return /^(?:font\/|application\/(?:font-|x-font-|vnd\.ms-fontobject))/.test(mime)
  return /^(?:audio|video)\//.test(mime) || ['text/vtt', 'application/ogg'].includes(mime)
}
module.exports = {
  PORTABLE_RESOURCE_KINDS,
  PORTABLE_LIMITS,
  PortableResourceError,
  portableLimits,
  portableMimeMatches,
}

/**
 * Resolve OOXML schemeClr names to sRGB hex (basic theme defaults).
 * Full theme XML parse can extend this map later (Phase 08).
 */

const DEFAULT_SCHEME = Object.freeze({
  dk1: '#000000',
  lt1: '#FFFFFF',
  dk2: '#1F497D',
  lt2: '#EEECE1',
  accent1: '#4F81BD',
  accent2: '#C0504D',
  accent3: '#9BBB59',
  accent4: '#8064A2',
  accent5: '#4BACC6',
  accent6: '#F79646',
  hlink: '#0000FF',
  folHlink: '#800080',
  tx1: '#000000',
  tx2: '#1F497D',
  bg1: '#FFFFFF',
  bg2: '#EEECE1',
})

function resolveSchemeColor(name, scheme = DEFAULT_SCHEME) {
  if (!name) return null
  const key = String(name).trim()
  const lower = key.toLowerCase()
  return scheme[key] || scheme[lower] || DEFAULT_SCHEME[lower] || null
}

/**
 * Best-effort: if value looks like scheme token, resolve; else return as-is.
 */
function resolveColorValue(value, scheme = DEFAULT_SCHEME) {
  if (value == null) return value
  if (typeof value === 'object' && value.scheme) {
    return resolveSchemeColor(value.scheme, scheme) || value
  }
  const s = String(value)
  if (/^scheme:/i.test(s)) return resolveSchemeColor(s.slice(7), scheme) || s
  if (DEFAULT_SCHEME[s] || DEFAULT_SCHEME[s.toLowerCase()]) return resolveSchemeColor(s, scheme)
  return value
}

module.exports = {
  DEFAULT_SCHEME,
  resolveSchemeColor,
  resolveColorValue,
}

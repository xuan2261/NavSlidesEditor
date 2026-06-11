const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:'])

// Characters that would let an href break out of an HTML attribute or inject
// markup once interpolated into `href="..."`. Reject them for every form,
// including the relative/anchor fast-paths below.
const ATTRIBUTE_BREAKOUT = /["'<>`\s]/
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1f\x7f]/

export function isSafeHref(href) {
  const raw = String(href || '').trim()
  if (!raw) return false
  if (CONTROL_CHARS.test(raw)) return false
  if (ATTRIBUTE_BREAKOUT.test(raw)) return false
  if (raw.startsWith('#') || raw.startsWith('/')) return true
  if (raw.startsWith('./') || raw.startsWith('../')) return true

  try {
    const parsed = new URL(raw, 'https://navslides.local')
    return SAFE_SCHEMES.has(parsed.protocol)
  } catch {
    return false
  }
}

const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:'])

export function isSafeHref(href) {
  const raw = String(href || '').trim()
  if (!raw) return false
  if (raw.startsWith('#') || raw.startsWith('/')) return true
  if (raw.startsWith('./') || raw.startsWith('../')) return true

  try {
    const parsed = new URL(raw, 'https://navslides.local')
    return SAFE_SCHEMES.has(parsed.protocol)
  } catch {
    return false
  }
}

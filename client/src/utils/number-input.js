export function parseFiniteNumber(value, fallback = null) {
  if (typeof value === 'string' && value.trim() === '') return fallback
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function clampNumber(value, min, max, fallback = null) {
  const parsed = parseFiniteNumber(value, null)
  if (parsed === null) return fallback
  let next = parsed
  if (Number.isFinite(min)) next = Math.max(min, next)
  if (Number.isFinite(max)) next = Math.min(max, next)
  return next
}

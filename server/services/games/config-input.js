function assertFiniteConfig(value, depth = 0) {
  if (depth > 16) throw new Error('Game configuration nesting exceeds live limits')
  if (typeof value === 'number' && !Number.isFinite(value))
    throw new Error('Game configuration numbers must be finite')
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value) && value.length > 200)
    throw new Error('Game configuration exceeds live limits')
  for (const child of Object.values(value)) assertFiniteConfig(child, depth + 1)
}
module.exports = { assertFiniteConfig }

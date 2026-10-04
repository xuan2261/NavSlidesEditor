/** Scale positive table dimension weights to the available authored extent. */
function resolveTableDimensions(values, extent) {
  if (!Array.isArray(values) || !values.length || !Number.isFinite(extent) || extent <= 0)
    return undefined
  let total = 0
  for (const value of values) {
    const weight = Number(value)
    if (!Number.isFinite(weight) || weight <= 0) return undefined
    total += weight
  }
  if (!Number.isFinite(total) || total <= 0) return undefined
  return values.map((value) => (Number(value) / total) * extent)
}

module.exports = { resolveTableDimensions }

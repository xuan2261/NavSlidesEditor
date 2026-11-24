function pickWeightedItem(
  items,
  { weighted = false, random = Math.random, excludedIds = [] } = {}
) {
  if (!Array.isArray(items)) throw new Error('Picker items must be an array')
  if (typeof weighted !== 'boolean') throw new Error('Picker weighted must be a boolean')
  if (typeof random !== 'function')
    throw new Error('Picker random must be a function returning a number in [0, 1)')
  if (!Array.isArray(excludedIds) || excludedIds.some((id) => typeof id !== 'string'))
    throw new Error('Picker excludedIds must be an array of IDs')
  const excluded = new Set(excludedIds)
  const seen = new Set()
  let count = 0
  let max = 0
  for (const [index, item] of items.entries()) {
    if (
      !item ||
      typeof item !== 'object' ||
      Array.isArray(item) ||
      typeof item.id !== 'string' ||
      !item.id.trim()
    )
      throw new Error(`Picker items[${index}] must have a nonempty id`)
    if (seen.has(item.id)) throw new Error(`Picker items[${index}].id is duplicated: ${item.id}`)
    seen.add(item.id)
    const weight = item.weight === undefined ? 1 : item.weight
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0)
      throw new Error(`Picker items[${index}].weight must be a positive finite number`)
    if (!excluded.has(item.id)) {
      count++
      max = Math.max(max, weight)
    }
  }
  if (!count) return null
  let draw
  try {
    draw = random()
  } catch (error) {
    throw new Error(
      `Picker random failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
  if (typeof draw !== 'number' || !Number.isFinite(draw) || draw < 0 || draw >= 1)
    throw new Error('Picker random must return a finite number in [0, 1)')
  if (!weighted) {
    let index = Math.floor(draw * count)
    for (const item of items) if (!excluded.has(item.id) && index-- === 0) return item
  }
  // Scale by the maximum before summing, so finite individual weights cannot overflow.
  let total = 0
  for (const item of items)
    if (!excluded.has(item.id)) total += (item.weight === undefined ? 1 : item.weight) / max
  let threshold = draw * total
  let last = null
  for (const item of items) {
    if (excluded.has(item.id)) continue
    last = item
    if (draw === 0) return item
    threshold -= (item.weight === undefined ? 1 : item.weight) / max
    if (threshold < 0) return item
  }
  // Rounding at the last interval must not produce an absent selection.
  return last
}
module.exports = { pickWeightedItem }

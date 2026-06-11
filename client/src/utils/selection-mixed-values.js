/**
 * Read-side multi-select mixing. For each requested key, decide whether the
 * selected elements share a single value or diverge. Pure; the write path
 * (element-update-fanout) is unchanged. Compute only when ids.length > 1 so
 * single-select shows concrete values and never a false "mixed".
 *
 * @param {Array<object>} elements - all elements on the slide
 * @param {Array<string>} ids - currently selected element ids (primary first)
 * @param {Array<string>} keys - property keys to evaluate
 * @returns {Record<string, {value: *, isMixed: boolean}>}
 */
export function computeMixedValues(elements, ids, keys) {
  const selected = (ids || [])
    .map((id) => (elements || []).find((el) => el && el.id === id))
    .filter(Boolean)
  const primary = selected[0]
  const result = {}
  for (const key of keys || []) {
    const value = primary ? primary[key] : undefined
    let isMixed = false
    if (selected.length > 1) {
      isMixed = selected.some((el) => el[key] !== value)
    }
    result[key] = { value, isMixed }
  }
  return result
}

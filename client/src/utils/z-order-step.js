/**
 * Pure z-order stepping helpers.
 *
 * Stepping an element "forward"/"backward" must cross exactly one visual
 * neighbor, even when zIndex values have gaps or ties. Naive `zIndex ± 1`
 * fails on gaps (never crosses) and creates ties. These helpers renormalize
 * the stack to a dense 1..N sequence (stable sort by (zIndex, array-index) so
 * the current on-canvas render order is preserved) and then swap with the
 * adjacent neighbor.
 */

/**
 * Order elements the way the canvas renders them: ascending zIndex, ties broken
 * by original array index (stable).
 */
function renderOrder(elements) {
  return elements
    .map((el, i) => ({ el, i }))
    .sort((a, b) => {
      const za = a.el.zIndex || 0
      const zb = b.el.zIndex || 0
      if (za !== zb) return za - zb
      return a.i - b.i
    })
    .map((x) => x.el)
}

/**
 * Renormalize a stack to dense 1..N zIndex values, preserving render order.
 * @returns {Array} new elements array (render order) with rewritten zIndex.
 */
function renormalize(ordered) {
  return ordered.map((el, idx) => ({ ...el, zIndex: idx + 1 }))
}

/**
 * Step one element above/below its immediate neighbor.
 * @param {Array} elements - slide elements (any zIndex/order)
 * @param {string} id - element to move
 * @param {'forward'|'backward'} dir
 * @returns {Array} new elements (render order) with dense, tie-free zIndex.
 *   At a stack edge the stack is renormalized only (no unbounded inflation
 *   forward, floors at 1 backward).
 */
export function computeZOrderStep(elements, id, dir) {
  const ordered = renderOrder(elements)
  const pos = ordered.findIndex((el) => el.id === id)
  if (pos === -1) return renormalize(ordered)

  const swapWith = dir === 'forward' ? pos + 1 : pos - 1
  if (swapWith < 0 || swapWith >= ordered.length) {
    // Already topmost (forward) / bottommost (backward): just dedupe ties.
    return renormalize(ordered)
  }

  const seq = [...ordered]
  const tmp = seq[pos]
  seq[pos] = seq[swapWith]
  seq[swapWith] = tmp
  return renormalize(seq)
}

/**
 * Step every id in a multi-selection one neighbor over, preserving the
 * selection's internal relative order. Forward moves are applied topmost-first
 * and backward moves bottommost-first so members never leapfrog each other.
 * @param {Array} elements
 * @param {string[]} ids - selected element ids
 * @param {'forward'|'backward'} dir
 * @returns {Array} new elements (render order) with dense zIndex.
 */
export function computeMultiZOrderStep(elements, ids, dir) {
  if (!ids || ids.length === 0) return renormalize(renderOrder(elements))
  const zOf = (id) => {
    const el = elements.find((e) => e.id === id)
    return el ? el.zIndex || 0 : 0
  }
  const order = [...ids].sort((a, b) =>
    dir === 'forward' ? zOf(b) - zOf(a) : zOf(a) - zOf(b)
  )
  let next = elements
  for (const stepId of order) {
    next = computeZOrderStep(next, stepId, dir)
  }
  return next
}

/**
 * Move every id in a multi-selection to the front or back of the stack as a
 * contiguous block, preserving the selection's internal render order.
 * @param {Array} elements
 * @param {string[]} ids - selected element ids
 * @param {'front'|'back'} edge
 * @returns {Array} new elements (render order) with dense zIndex.
 */
export function computeMultiZOrderEdge(elements, ids, edge) {
  const ordered = renderOrder(elements)
  if (!ids || ids.length === 0) return renormalize(ordered)
  const idSet = new Set(ids)
  const selected = ordered.filter((el) => idSet.has(el.id))
  if (selected.length === 0) return renormalize(ordered)
  const others = ordered.filter((el) => !idSet.has(el.id))
  const reordered = edge === 'front' ? [...others, ...selected] : [...selected, ...others]
  return renormalize(reordered)
}

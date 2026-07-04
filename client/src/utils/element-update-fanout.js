import { ELEMENT_DEFAULTS } from '../data/element-defaults'
import { MIN_SIZE } from '../components/canvas/use-canvas-resize-rotate'
import { hasBlockedGroupMutation } from './active-slide-selection'

/**
 * Shared rules for applying a property/geometry edit across a multi-element
 * selection, so the Properties panel and the Format ribbon behave identically.
 *
 * Positional entry (X/Y) shifts the whole selection by the SAME delta — a plain
 * click on a grouped element selects the entire group, so writing an absolute X
 * to every member would collapse the group onto one point. Sizing (W/H) is
 * absolute (PowerPoint "make same size"). Rotation/opacity broadcast the same
 * value to all. Type-specific style props only reach elements that own them, so
 * fanning a fill across a mixed selection never writes dead props onto element
 * types that lack them.
 */

// Positional keys: applied as a delta from the primary element so relative
// layout survives across the selection.
const DELTA_KEYS = new Set(['x', 'y'])
// Geometry keys applied as the same absolute value to every selected element.
const ABSOLUTE_GEOMETRY_KEYS = new Set(['width', 'height', 'rotation', 'opacity'])
// Common controls are universal, so they are never gated by element defaults.
// Everything outside this set is a type-specific style prop.
const COMMON_KEYS = new Set([
  'x',
  'y',
  'width',
  'height',
  'rotation',
  'opacity',
  'locked',
  'fragment',
  'fragmentIndex',
  'fragmentAnimation',
])

const SHADOW_KEYS = new Set(['shadowX', 'shadowY', 'shadowBlur', 'shadowColor'])

export function normalizeRotation(value) {
  return ((value % 360) + 360) % 360
}

function ownsProperty(element, key) {
  if (element && Object.prototype.hasOwnProperty.call(element, key)) return true
  const defaults = ELEMENT_DEFAULTS[element?.type]
  return !!defaults && Object.prototype.hasOwnProperty.call(defaults, key)
}

function supportsShadow(element) {
  return element?.type !== 'html' && element?.type !== 'code'
}

export function isPureUnlockUpdate(updates) {
  const keys = Object.keys(updates || {})
  return keys.length === 1 && keys[0] === 'locked' && updates.locked === false
}

function isLockOnlyUpdate(updates) {
  const keys = Object.keys(updates || {})
  return keys.length === 1 && keys[0] === 'locked'
}

function canApplyUpdateToElement(element, updates) {
  if (!element?.locked) return true
  return isPureUnlockUpdate(updates)
}

/**
 * Compute the per-key value an individual element should receive.
 * Returns `undefined` when the key does not apply to this element.
 */
function valueForElement(element, primary, key, rawValue) {
  if (DELTA_KEYS.has(key)) {
    const delta = rawValue - (primary?.[key] || 0)
    return (element[key] || 0) + delta
  }
  if (key === 'rotation') return normalizeRotation(rawValue)
  if (key === 'width' || key === 'height') return Math.max(MIN_SIZE, rawValue)
  if (ABSOLUTE_GEOMETRY_KEYS.has(key) || COMMON_KEYS.has(key)) return rawValue
  if (SHADOW_KEYS.has(key)) return supportsShadow(element) ? rawValue : undefined
  // Type-specific style prop: only elements that own it receive it.
  return ownsProperty(element, key) ? rawValue : undefined
}

/**
 * Build the array of `{ id, ...partial }` records for `updateElements`, fanning
 * `updates` over every selected id under the rules above. Elements that receive
 * no applicable key are dropped so we never write empty patches.
 *
 * @param {Array} elements   active slide elements
 * @param {Array<string>} ids selected element ids
 * @param {string} primaryId the reference element for positional deltas
 * @param {Object} updates    partial update emitted by a control
 */
export function buildSelectionUpdates(elements, ids, primaryId, updates) {
  if (!Array.isArray(elements) || !Array.isArray(ids) || !updates) return []
  if (!isLockOnlyUpdate(updates) && hasBlockedGroupMutation({ elements }, ids)) return []
  const byId = new Map(elements.map((el) => [el.id, el]))
  const primary = byId.get(primaryId) || byId.get(ids[ids.length - 1])
  const keys = Object.keys(updates)
  const hasCommon = keys.some((k) => COMMON_KEYS.has(k))

  const result = []
  for (const id of ids) {
    const element = byId.get(id)
    if (!element) continue
    if (!canApplyUpdateToElement(element, updates)) continue
    const partial = {}
    for (const key of keys) {
      const next = valueForElement(element, primary, key, updates[key])
      if (next !== undefined) partial[key] = next
    }
    if (Object.keys(partial).length) result.push({ id, ...partial })
  }

  // No element owned a purely type-specific update (e.g. fill onto a selection
  // with no fill-bearing element): nothing to write.
  if (!result.length && !hasCommon) return []
  return result
}

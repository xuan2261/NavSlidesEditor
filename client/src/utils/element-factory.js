import { ELEMENT_DEFAULTS, DEFAULT_POSITIONS } from '../data/element-defaults.js'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../data/slide-constants.js'

/** @typedef {import('../../../shared/src/types/presentation').ElementType} ElementType */
/** @typedef {import('../../../shared/src/types/presentation').BaseElement} BaseElement */

/**
 * Create a new element with defaults for the given type.
 * @param {ElementType} type - Element type (text, image, shape, etc.)
 * @param {Partial<BaseElement>} overrides - Property overrides (position, size, content, etc.)
 * @returns {BaseElement} New element object with unique id
 */
export function createElement(type, overrides = {}) {
  const defaults = ELEMENT_DEFAULTS[type]
  if (!defaults) throw new Error(`Unknown element type: ${type}`)

  const pos = DEFAULT_POSITIONS[type] || { x: 100, y: 100 }
  let x = pos.x
  let y = pos.y

  // Handle center positioning (shapes, etc.)
  if (x === 'center') x = (CANVAS_WIDTH - (overrides.width || defaults.width)) / 2
  if (y === 'center') y = (CANVAS_HEIGHT - (overrides.height || defaults.height)) / 2

  return {
    id: crypto.randomUUID(),
    type,
    x,
    y,
    ...defaults,
    ...overrides,
  }
}

/**
 * use-canvas-snapping — snapping helpers for grid and smart guide snapping.
 * Returns a snap function and guide-style helpers.
 */
export const SNAP_REF_OPTIONS = [
  { id: 'ul', label: 'Upper Left', fx: 0, fy: 0 },
  { id: 'uc', label: 'Upper Center', fx: 0.5, fy: 0 },
  { id: 'ur', label: 'Upper Right', fx: 1, fy: 0 },
  { id: 'ml', label: 'Middle Left', fx: 0, fy: 0.5 },
  { id: 'mc', label: 'Center', fx: 0.5, fy: 0.5 },
  { id: 'mr', label: 'Middle Right', fx: 1, fy: 0.5 },
  { id: 'll', label: 'Lower Left', fx: 0, fy: 1 },
  { id: 'lc', label: 'Lower Center', fx: 0.5, fy: 1 },
  { id: 'lr', label: 'Lower Right', fx: 1, fy: 1 },
]

/**
 * Snap a coordinate to the grid.
 * @param {number} v - raw coordinate
 * @param {boolean} showGrid - whether grid snapping is enabled
 * @param {number} gridSize - grid cell size in pixels
 * @returns {number}
 */
export function snapToGrid(v, showGrid, gridSize) {
  return showGrid ? Math.round(v / gridSize) * gridSize : v
}

/**
 * Snap a point to the grid, using a snap reference handle.
 * @param {number} rawX - raw x coordinate
 * @param {number} rawY - raw y coordinate
 * @param {number} w - element width
 * @param {number} h - element height
 * @param {string} ref - snap reference handle id
 * @param {function} snapFn - 1D snap function (e.g. snapToGrid)
 * @returns {{ x: number, y: number }}
 */
export function snapWithRef(rawX, rawY, w, h, ref, snapFn) {
  const opt = SNAP_REF_OPTIONS.find((o) => o.id === ref) || SNAP_REF_OPTIONS[0]
  const refX = rawX + opt.fx * w
  const refY = rawY + opt.fy * h
  return {
    x: snapFn(refX) - opt.fx * w,
    y: snapFn(refY) - opt.fy * h,
  }
}

/**
 * Persistent guide line style helper.
 * @param {object} guide - { axis: 'x'|'y', position: number }
 * @param {number} slideW - slide width (for y-axis guides)
 * @param {number} slideH - slide height (for x-axis guides)
 */
export function getPersistentGuideStyle(guide, slideW, slideH) {
  return guide.axis === 'x'
    ? {
        position: 'absolute',
        left: guide.position,
        top: 0,
        width: 1,
        height: slideH,
        background: '#22d3ee',
        zIndex: 998,
        pointerEvents: 'auto',
        cursor: 'col-resize',
      }
    : {
        position: 'absolute',
        top: guide.position,
        left: 0,
        height: 1,
        width: slideW,
        background: '#22d3ee',
        zIndex: 998,
        pointerEvents: 'auto',
        cursor: 'row-resize',
      }
}

/**
 * Active (smart) guide line style helper.
 * @param {object} guide - { axis: 'x'|'y', position: number }
 * @param {number} slideW - slide width
 * @param {number} slideH - slide height
 */
export function getActiveGuideStyle(guide, slideW, slideH) {
  return guide.axis === 'x'
    ? {
        position: 'absolute',
        left: guide.position,
        top: 0,
        width: 1,
        height: slideH,
        background: '#f59e0b',
        zIndex: 999,
        pointerEvents: 'none',
      }
    : {
        position: 'absolute',
        top: guide.position,
        left: 0,
        height: 1,
        width: slideW,
        background: '#f59e0b',
        zIndex: 999,
        pointerEvents: 'none',
      }
}

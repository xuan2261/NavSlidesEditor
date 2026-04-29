/**
 * use-canvas-resize-rotate — resize and rotation math helpers.
 * Extracted from SlideCanvas interaction logic.
 */

export const MIN_SIZE = 40

export const HANDLE_STYLES = {
  nw: { top: -5, left: -5, cursor: 'nw-resize' },
  n: { top: -5, left: '50%', transform: 'translateX(-50%)', cursor: 'n-resize' },
  ne: { top: -5, right: -5, cursor: 'ne-resize' },
  e: { top: '50%', right: -5, transform: 'translateY(-50%)', cursor: 'e-resize' },
  se: { bottom: -5, right: -5, cursor: 'se-resize' },
  s: { bottom: -5, left: '50%', transform: 'translateX(-50%)', cursor: 's-resize' },
  sw: { bottom: -5, left: -5, cursor: 'sw-resize' },
  w: { top: '50%', left: -5, transform: 'translateY(-50%)', cursor: 'w-resize' },
}

/**
 * Apply resize to an element's bounding box.
 * @param {string} handle - resize handle id
 * @param {object} startEl - { x, y, width, height }
 * @param {number} dx - delta x
 * @param {number} dy - delta y
 * @returns {object} new { x, y, width, height }
 */
export function applyResize(handle, startEl, dx, dy) {
  let { x, y, width, height } = startEl
  switch (handle) {
    case 'se':
      width = Math.max(MIN_SIZE, startEl.width + dx)
      height = Math.max(MIN_SIZE, startEl.height + dy)
      break
    case 'sw':
      x = startEl.x + dx
      width = Math.max(MIN_SIZE, startEl.width - dx)
      if (width === MIN_SIZE) x = startEl.x + startEl.width - MIN_SIZE
      height = Math.max(MIN_SIZE, startEl.height + dy)
      break
    case 'ne':
      width = Math.max(MIN_SIZE, startEl.width + dx)
      y = startEl.y + dy
      height = Math.max(MIN_SIZE, startEl.height - dy)
      if (height === MIN_SIZE) y = startEl.y + startEl.height - MIN_SIZE
      break
    case 'nw':
      x = startEl.x + dx
      width = Math.max(MIN_SIZE, startEl.width - dx)
      if (width === MIN_SIZE) x = startEl.x + startEl.width - MIN_SIZE
      y = startEl.y + dy
      height = Math.max(MIN_SIZE, startEl.height - dy)
      if (height === MIN_SIZE) y = startEl.y + startEl.height - MIN_SIZE
      break
    case 'n':
      y = startEl.y + dy
      height = Math.max(MIN_SIZE, startEl.height - dy)
      if (height === MIN_SIZE) y = startEl.y + startEl.height - MIN_SIZE
      break
    case 's':
      height = Math.max(MIN_SIZE, startEl.height + dy)
      break
    case 'e':
      width = Math.max(MIN_SIZE, startEl.width + dx)
      break
    case 'w':
      x = startEl.x + dx
      width = Math.max(MIN_SIZE, startEl.width - dx)
      if (width === MIN_SIZE) x = startEl.x + startEl.width - MIN_SIZE
      break
  }
  return { x, y, width, height }
}

/**
 * Apply resize with aspect-ratio constraint (when Shift is held).
 * Mutates updates in place.
 * @param {string} handle - resize handle
 * @param {object} startEl - original element
 * @param {object} updates - partially-computed updates from applyResize
 */
export function applyResizeAspectRatio(handle, startEl, updates) {
  if (!['nw', 'ne', 'sw', 'se'].includes(handle)) return
  const ratio = startEl.width / startEl.height
  if (Math.abs(updates.width - startEl.width) >= Math.abs(updates.height - startEl.height)) {
    updates.height = Math.max(MIN_SIZE, Math.round(updates.width / ratio))
    if (handle === 'ne' || handle === 'nw')
      updates.y = startEl.y + startEl.height - updates.height
  } else {
    updates.width = Math.max(MIN_SIZE, Math.round(updates.height * ratio))
    if (handle === 'nw' || handle === 'sw')
      updates.x = startEl.x + startEl.width - updates.width
  }
}

/**
 * Calculate rotation angle from element center to mouse position.
 * @param {object} startEl - { x, y, width, height }
 * @param {number} mouseX - mouse x in slide coordinates
 * @param {number} mouseY - mouse y in slide coordinates
 * @param {boolean} snap15deg - snap to 15-degree increments
 * @returns {number} angle in degrees, normalized to 0-360
 */
export function getRotationAngle(startEl, mouseX, mouseY, snap15deg) {
  const centerX = startEl.x + startEl.width / 2
  const centerY = startEl.y + startEl.height / 2
  const angle = Math.atan2(mouseY - centerY, mouseX - centerX) * (180 / Math.PI) + 90
  let rotation = Math.round(angle)
  if (snap15deg) rotation = Math.round(rotation / 15) * 15
  return ((rotation % 360) + 360) % 360
}

/**
 * Clamp element bounds to slide dimensions.
 * @param {object} updates - { x, y, width, height }
 * @param {object} startEl - original element
 * @param {function} snapFn - optional 1D snap function
 * @param {number} slideW - slide width
 * @param {number} slideH - slide height
 */
export function clampToSlide(updates, startEl, snapFn, slideW, slideH) {
  updates.x = snapFn ? snapFn(Math.max(0, updates.x)) : Math.max(0, updates.x)
  updates.y = snapFn ? snapFn(Math.max(0, updates.y)) : Math.max(0, updates.y)
  updates.width = snapFn
    ? snapFn(Math.min(slideW - updates.x, updates.width))
    : Math.min(slideW - updates.x, updates.width)
  updates.height = snapFn
    ? snapFn(Math.min(slideH - updates.y, updates.height))
    : Math.min(slideH - updates.y, updates.height)
  updates.width = Math.max(MIN_SIZE, updates.width)
  updates.height = Math.max(MIN_SIZE, updates.height)
}

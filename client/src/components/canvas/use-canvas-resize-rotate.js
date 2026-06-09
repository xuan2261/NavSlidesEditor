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
 * Rotate a point about a center by `deg` degrees (clockwise in screen space).
 * At deg === 0 this returns the input bit-for-bit (cos(0)===1, sin(0)===0),
 * so the unrotated geometry path is numerically identical to a no-op.
 * @returns {{x:number,y:number}}
 */
export function rotatePoint(px, py, cx, cy, deg) {
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = px - cx
  const dy = py - cy
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos }
}

/**
 * Axis-aligned bounding box of an element's VISUAL (rotated) rectangle.
 * Rotation is about the element center (matches the CSS default 50% 50% origin).
 * For an unrotated element this is just the element box.
 * @returns {{x,y,width,height,left,top,right,bottom}}
 */
export function getRotatedAABB(el) {
  const rot = el.rotation || 0
  if (!rot) {
    const right = el.x + el.width
    const bottom = el.y + el.height
    return { x: el.x, y: el.y, width: el.width, height: el.height, left: el.x, top: el.y, right, bottom }
  }
  const cx = el.x + el.width / 2
  const cy = el.y + el.height / 2
  const corners = [
    rotatePoint(el.x, el.y, cx, cy, rot),
    rotatePoint(el.x + el.width, el.y, cx, cy, rot),
    rotatePoint(el.x, el.y + el.height, cx, cy, rot),
    rotatePoint(el.x + el.width, el.y + el.height, cx, cy, rot),
  ]
  const xs = corners.map((p) => p.x)
  const ys = corners.map((p) => p.y)
  const left = Math.min(...xs)
  const top = Math.min(...ys)
  const right = Math.max(...xs)
  const bottom = Math.max(...ys)
  return { x: left, y: top, width: right - left, height: bottom - top, left, top, right, bottom }
}

/**
 * Apply resize to an element's bounding box, honoring element rotation.
 *
 * The pointer delta (dx,dy) is mapped into the element's local (unrotated)
 * frame so the dragged edge grows toward the cursor along the rotated axes.
 * The opposite edge/corner is held FIXED in world space: its world position is
 * computed from the old box, then the new center is solved so that same anchor
 * (with the new dimensions) maps back to it. For rotation === 0 the trig is
 * exact (cos 1 / sin 0), reproducing the legacy axis-aligned math exactly.
 *
 * @param {string} handle - resize handle id
 * @param {object} startEl - { x, y, width, height, rotation? }
 * @param {number} dx - world-space delta x
 * @param {number} dy - world-space delta y
 * @returns {object} new { x, y, width, height }
 */
export function applyResize(handle, startEl, dx, dy) {
  const rot = startEl.rotation || 0
  const w0 = startEl.width
  const h0 = startEl.height
  const cx0 = startEl.x + w0 / 2
  const cy0 = startEl.y + h0 / 2
  const rad = (rot * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  // Pointer delta in the element's local frame (inverse rotation).
  const ldx = dx * cos + dy * sin
  const ldy = -dx * sin + dy * cos

  let w1 = w0
  let h1 = h0
  let ax = 0 // local-x sign of the fixed (opposite) edge/corner
  let ay = 0 // local-y sign of the fixed (opposite) edge/corner
  switch (handle) {
    case 'e': w1 = Math.max(MIN_SIZE, w0 + ldx); ax = -1; break
    case 'w': w1 = Math.max(MIN_SIZE, w0 - ldx); ax = 1; break
    case 's': h1 = Math.max(MIN_SIZE, h0 + ldy); ay = -1; break
    case 'n': h1 = Math.max(MIN_SIZE, h0 - ldy); ay = 1; break
    case 'se': w1 = Math.max(MIN_SIZE, w0 + ldx); h1 = Math.max(MIN_SIZE, h0 + ldy); ax = -1; ay = -1; break
    case 'sw': w1 = Math.max(MIN_SIZE, w0 - ldx); h1 = Math.max(MIN_SIZE, h0 + ldy); ax = 1; ay = -1; break
    case 'ne': w1 = Math.max(MIN_SIZE, w0 + ldx); h1 = Math.max(MIN_SIZE, h0 - ldy); ax = -1; ay = 1; break
    case 'nw': w1 = Math.max(MIN_SIZE, w0 - ldx); h1 = Math.max(MIN_SIZE, h0 - ldy); ax = 1; ay = 1; break
  }
  // World position of the fixed anchor (old dims) — invariant across the resize.
  const aWorldX = cx0 + ((ax * w0) / 2) * cos - ((ay * h0) / 2) * sin
  const aWorldY = cy0 + ((ax * w0) / 2) * sin + ((ay * h0) / 2) * cos
  // New center so the same anchor (new dims) maps back to that world point.
  const cx1 = aWorldX - (((ax * w1) / 2) * cos - ((ay * h1) / 2) * sin)
  const cy1 = aWorldY - (((ax * w1) / 2) * sin + ((ay * h1) / 2) * cos)
  return { x: cx1 - w1 / 2, y: cy1 - h1 / 2, width: w1, height: h1 }
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
  // A degenerate 0x0 element yields 0/0 = NaN, which would poison width/height.
  // There is no meaningful aspect to preserve, so leave the free-resize result.
  if (!startEl.width || !startEl.height) return
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
 *
 * For an unrotated element the axis-aligned box is the visual box, so it is
 * clamped (and snapped) directly. For a ROTATED element the axis-aligned box is
 * NOT the visual rectangle: shifting x/y or shrinking w/h here would undo the
 * world-space anchor that `applyResize` just established, making the element
 * jump at slide edges. The dimensions are already floored to MIN_SIZE upstream,
 * so the rotated case skips the axis-aligned clamp and preserves the anchor.
 * @param {object} updates - { x, y, width, height }
 * @param {object} startEl - original element ({ rotation? })
 * @param {function} snapFn - optional 1D snap function
 * @param {number} slideW - slide width
 * @param {number} slideH - slide height
 */
export function clampToSlide(updates, startEl, snapFn, slideW, slideH) {
  if (startEl.rotation) {
    updates.width = Math.max(MIN_SIZE, updates.width)
    updates.height = Math.max(MIN_SIZE, updates.height)
    return
  }
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

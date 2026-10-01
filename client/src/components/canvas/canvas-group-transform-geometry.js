import { getRotatedAABB, MIN_SIZE, rotatePoint } from './use-canvas-resize-rotate'

export function getGroupBounds(elements) {
  const boxes = elements.map(getRotatedAABB)
  const x = Math.min(...boxes.map((box) => box.left))
  const y = Math.min(...boxes.map((box) => box.top))
  return {
    x, y,
    width: Math.max(...boxes.map((box) => box.right)) - x,
    height: Math.max(...boxes.map((box) => box.bottom)) - y,
    rotation: 0,
  }
}

export function scaleLineResizePoints(element, updates) {
  if (element.type !== 'line') return updates
  const result = { ...updates }
  for (const [dimension, keys] of [['width', ['x1', 'x2', 'cx']], ['height', ['y1', 'y2', 'cy']]]) {
    if (!element[dimension] || updates[dimension] == null) continue
    const scale = updates[dimension] / element[dimension]
    for (const key of keys) {
      if (Number.isFinite(element[key])) result[key] = element[key] * scale
    }
  }
  return result
}

function constrainGroupTransform(elements, transform, slideW, slideH) {
  const fits = (batch) => batch.every((element, index) => {
    const box = getRotatedAABB(element)
    return element.width >= Math.min(MIN_SIZE, elements[index].width) &&
      element.height >= Math.min(MIN_SIZE, elements[index].height) &&
      box.left >= -1e-9 && box.top >= -1e-9 &&
      box.right <= slideW + 1e-9 && box.bottom <= slideH + 1e-9
  })
  const requested = transform(1)
  if (fits(requested)) return requested
  let low = 0
  let high = 1
  let best = transform(0)
  for (let index = 0; index < 40; index += 1) {
    const fraction = (low + high) / 2
    const candidate = transform(fraction)
    if (fits(candidate)) { best = candidate; low = fraction } else high = fraction
  }
  return best
}

export function applyGroupResize(elements, primary, updates, slideW, slideH) {
  const radians = ((primary.rotation || 0) * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const startX = primary.x + primary.width / 2
  const startY = primary.y + primary.height / 2
  const batch = constrainGroupTransform(elements, (fraction) => {
    const sx = 1 + (updates.width / primary.width - 1) * fraction
    const sy = 1 + (updates.height / primary.height - 1) * fraction
    const centerX = startX + (updates.x + updates.width / 2 - startX) * fraction
    const centerY = startY + (updates.y + updates.height / 2 - startY) * fraction
    return elements.map((element) => {
      const dx = element.x + element.width / 2 - startX
      const dy = element.y + element.height / 2 - startY
      const localX = (dx * cos + dy * sin) * sx
      const localY = (-dx * sin + dy * cos) * sy
      const width = element.width * sx
      const height = element.height * sy
      return {
        ...element, width, height,
        x: centerX + localX * cos - localY * sin - width / 2,
        y: centerY + localX * sin + localY * cos - height / 2,
      }
    })
  }, slideW, slideH)
  return batch.map((element, index) => ({
    id: element.id,
    ...scaleLineResizePoints(elements[index], {
      x: element.x, y: element.y, width: element.width, height: element.height,
    }),
  }))
}

export function applyGroupRotate(elements, bounds, rotation, slideW, slideH) {
  const delta = ((rotation % 360 + 540) % 360) - 180
  const cx = bounds.x + bounds.width / 2
  const cy = bounds.y + bounds.height / 2
  const batch = constrainGroupTransform(elements, (fraction) => elements.map((element) => {
    const angle = delta * fraction
    const center = rotatePoint(element.x + element.width / 2, element.y + element.height / 2, cx, cy, angle)
    return {
      ...element,
      x: center.x - element.width / 2,
      y: center.y - element.height / 2,
      rotation: (((element.rotation || 0) + angle) % 360 + 360) % 360,
    }
  }), slideW, slideH)
  return batch.map(({ id, x, y, rotation: angle }) => ({ id, x, y, rotation: angle }))
}

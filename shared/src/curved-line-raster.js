const { lineFallbackCoordinates } = require('./connector-geometry.js')

function axisRange(start, control, end) {
  let min = Math.min(start, end)
  let max = Math.max(start, end)
  const denominator = start - 2 * control + end
  const t = denominator === 0 ? -1 : (start - control) / denominator
  if (t > 0 && t < 1) {
    const value = (1 - t) ** 2 * start + 2 * (1 - t) * t * control + t ** 2 * end
    min = Math.min(min, value)
    max = Math.max(max, value)
  }
  return { min, max }
}

// Includes blank authored bounds so an in-bounds curve keeps its existing box.
// Marker safety padding contains all marker shapes used by renderLine.
function getCurvedLineRasterGeometry(element) {
  if (element?.type !== 'line' || !Number.isFinite(element.cx) || !Number.isFinite(element.cy))
    return null
  const { x1, y1, x2, y2 } = lineFallbackCoordinates(element)
  const horizontal = axisRange(x1, element.cx, x2)
  const vertical = axisRange(y1, element.cy, y2)
  const stroke = Math.abs(Number(element.strokeWidth) || 2)
  const markerTypes = ['arrow', 'diamond', 'circle', 'square']
  const hasMarker =
    markerTypes.includes(element.arrowStart) || markerTypes.includes(element.arrowEnd)
  const padding = hasMarker ? stroke * 10 : stroke / 2
  const authoredWidth = Number(element.width) || 0
  const authoredHeight = Number(element.height) || 0
  const left = Math.floor(Math.min(0, horizontal.min - padding))
  const top = Math.floor(Math.min(0, vertical.min - padding))
  const width = Math.ceil(Math.max(authoredWidth, horizontal.max + padding)) - left
  const height = Math.ceil(Math.max(authoredHeight, vertical.max + padding)) - top
  const dx = left + width / 2 - authoredWidth / 2
  const dy = top + height / 2 - authoredHeight / 2
  const angle = ((Number(element.rotation) || 0) * Math.PI) / 180
  const x =
    (Number(element.x) || 0) +
    authoredWidth / 2 +
    dx * Math.cos(angle) -
    dy * Math.sin(angle) -
    width / 2
  const y =
    (Number(element.y) || 0) +
    authoredHeight / 2 +
    dx * Math.sin(angle) +
    dy * Math.cos(angle) -
    height / 2
  return { left, top, width, height, element: { ...element, x, y, width, height } }
}

module.exports = { getCurvedLineRasterGeometry }

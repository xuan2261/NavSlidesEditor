const { CANVAS_SIZE } = require('./constants')

function readNumber(value, fallback, min = null) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  if (min != null && n < min) return fallback
  return n
}

function readCoord(primary, secondary, fallback = 0) {
  const p = Number(primary)
  if (Number.isFinite(p)) return p
  const s = Number(secondary)
  if (Number.isFinite(s)) return s
  return fallback
}

function normalizeSourceSize(size) {
  const width = readNumber(size?.width, CANVAS_SIZE.width, 1)
  const height = readNumber(size?.height, CANVAS_SIZE.height, 1)
  return {
    width,
    height,
    scale: Object.freeze({
      x: CANVAS_SIZE.width / width,
      y: CANVAS_SIZE.height / height,
    }),
  }
}

function mapBox(element, scale, defaults = { width: 80, height: 40 }) {
  const left = readCoord(element?.left, element?.x, 0)
  const top = readCoord(element?.top, element?.y, 0)
  const width = readNumber(element?.width, defaults.width, 0)
  const height = readNumber(element?.height, defaults.height, 0)
  return {
    x: Math.round(left * scale.x),
    y: Math.round(top * scale.y),
    width: Math.max(1, Math.round(width * scale.x)),
    height: Math.max(1, Math.round(height * scale.y)),
  }
}

function clampBox(box, bounds = CANVAS_SIZE) {
  const x = Math.max(0, readNumber(box?.x, 0))
  const y = Math.max(0, readNumber(box?.y, 0))
  const width = Math.max(1, readNumber(box?.width, 1))
  const height = Math.max(1, readNumber(box?.height, 1))
  return {
    x: Math.min(x, bounds.width - 1),
    y: Math.min(y, bounds.height - 1),
    width: Math.min(width, bounds.width),
    height: Math.min(height, bounds.height),
  }
}

function inferLineCoordinateMode(element, box) {
  const hasCoords =
    element?.x1 != null &&
    element?.y1 != null &&
    element?.x2 != null &&
    element?.y2 != null
  if (!hasCoords) return 'none'
  const x1 = Number(element.x1)
  const y1 = Number(element.y1)
  const x2 = Number(element.x2)
  const y2 = Number(element.y2)
  if (![x1, y1, x2, y2].every(Number.isFinite)) return 'none'

  const inLocalRange =
    x1 >= 0 &&
    y1 >= 0 &&
    x2 >= 0 &&
    y2 >= 0 &&
    x1 <= box.width &&
    x2 <= box.width &&
    y1 <= box.height &&
    y2 <= box.height

  return inLocalRange ? 'local' : 'absolute'
}

function mapLineGeometry(element, scale) {
  const box = mapBox(element, scale)
  const mode = inferLineCoordinateMode(element, box)
  const midY = Math.round(box.height / 2)

  if (mode === 'none') {
    return {
      box,
      endpoints: { x1: 0, y1: midY, x2: box.width, y2: midY },
      mode,
    }
  }

  if (mode === 'local') {
    return {
      box,
      endpoints: {
        x1: Math.round(Number(element.x1) * scale.x),
        y1: Math.round(Number(element.y1) * scale.y),
        x2: Math.round(Number(element.x2) * scale.x),
        y2: Math.round(Number(element.y2) * scale.y),
      },
      mode,
    }
  }

  const absX1 = Math.round(Number(element.x1) * scale.x)
  const absY1 = Math.round(Number(element.y1) * scale.y)
  const absX2 = Math.round(Number(element.x2) * scale.x)
  const absY2 = Math.round(Number(element.y2) * scale.y)
  const minX = Math.min(absX1, absX2)
  const minY = Math.min(absY1, absY2)
  const maxX = Math.max(absX1, absX2)
  const maxY = Math.max(absY1, absY2)

  return {
    box: {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    },
    endpoints: {
      x1: absX1 - minX,
      y1: absY1 - minY,
      x2: absX2 - minX,
      y2: absY2 - minY,
    },
    mode,
  }
}

function identityMatrix() {
  return [1, 0, 0, 1, 0, 0]
}

function multiply(m1, m2) {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ]
}

function translate(tx, ty) {
  return [1, 0, 0, 1, tx, ty]
}

function rotateAround(degrees, cx, cy) {
  const rad = (Number(degrees) * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const rotate = [cos, sin, -sin, cos, 0, 0]
  return multiply(translate(cx, cy), multiply(rotate, translate(-cx, -cy)))
}

function scaleAround(sx, sy, cx, cy) {
  const scale = [sx, 0, 0, sy, 0, 0]
  return multiply(translate(cx, cy), multiply(scale, translate(-cx, -cy)))
}

function applyToPoint(matrix, x, y) {
  return {
    x: matrix[0] * x + matrix[2] * y + matrix[4],
    y: matrix[1] * x + matrix[3] * y + matrix[5],
  }
}

function mapBoxByMatrix(box, matrix) {
  const corners = [
    applyToPoint(matrix, box.x, box.y),
    applyToPoint(matrix, box.x + box.width, box.y),
    applyToPoint(matrix, box.x, box.y + box.height),
    applyToPoint(matrix, box.x + box.width, box.y + box.height),
  ]
  const xs = corners.map((p) => p.x)
  const ys = corners.map((p) => p.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const maxX = Math.max(...xs)
  const maxY = Math.max(...ys)
  return {
    x: Math.round(minX),
    y: Math.round(minY),
    width: Math.max(1, Math.round(maxX - minX)),
    height: Math.max(1, Math.round(maxY - minY)),
  }
}

module.exports = {
  applyToPoint,
  clampBox,
  identityMatrix,
  mapBox,
  mapBoxByMatrix,
  mapLineGeometry,
  multiply,
  normalizeSourceSize,
  readCoord,
  readNumber,
  rotateAround,
  scaleAround,
  translate,
}

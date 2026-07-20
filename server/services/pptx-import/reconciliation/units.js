const EMU_PER_INCH = 914400
const POINTS_PER_INCH = 72
const PIXELS_PER_INCH = 96
const EMU_PER_POINT = EMU_PER_INCH / POINTS_PER_INCH
const EMU_PER_PIXEL_96 = EMU_PER_INCH / PIXELS_PER_INCH

function finite(value, label) {
  const number = Number(value)
  if (!Number.isFinite(number)) throw new TypeError(`${label} must be finite`)
  return number
}

function normalizeInteger(value) {
  const rounded = Math.round(value)
  return Math.abs(value - rounded) < Number.EPSILON * Math.max(1, Math.abs(value)) * 4
    ? rounded
    : value
}

function emuToPoints(value) {
  return finite(value, 'EMU') / EMU_PER_POINT
}

function pointsToEmu(value) {
  return normalizeInteger(finite(value, 'points') * EMU_PER_POINT)
}

function emuToPixels(value) {
  return finite(value, 'EMU') / EMU_PER_PIXEL_96
}

function pixelsToEmu(value) {
  return normalizeInteger(finite(value, 'pixels') * EMU_PER_PIXEL_96)
}

function emuRectToUnits(rect, canvas) {
  if (!rect || typeof rect !== 'object') return null
  const emu = {
    x: finite(rect.x, 'x EMU'),
    y: finite(rect.y, 'y EMU'),
    width: finite(rect.width, 'width EMU'),
    height: finite(rect.height, 'height EMU'),
  }
  const pixels96 = Object.fromEntries(
    Object.entries(emu).map(([key, value]) => [key, emuToPixels(value)])
  )
  const points = Object.fromEntries(
    Object.entries(emu).map(([key, value]) => [key, emuToPoints(value)])
  )
  const normalized = canvas?.width && canvas?.height
    ? {
        x: pixels96.x / canvas.width,
        y: pixels96.y / canvas.height,
        width: pixels96.width / canvas.width,
        height: pixels96.height / canvas.height,
      }
    : null
  return { emu, points, pixels96, normalized }
}

module.exports = {
  EMU_PER_INCH,
  EMU_PER_PIXEL_96,
  EMU_PER_POINT,
  emuRectToUnits,
  emuToPixels,
  emuToPoints,
  pixelsToEmu,
  pointsToEmu,
}

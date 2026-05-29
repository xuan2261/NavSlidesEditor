function colorValue(value, fallback = 'transparent') {
  if (typeof value === 'string' && value) return value
  if (value?.type === 'color' && value.value) return value.value
  if (value?.color) return value.color
  if (value?.type === 'none') return 'none'
  if (value?.type === 'gradient') return 'gradient'
  if (value?.type === 'pattern') return 'transparent'
  return fallback
}

function parseStopOffset(rawSource, index, count) {
  // pptxtojson@2.0.2 emits gsLst pos as `c/1e3 + "%"` (e.g. "50%") and "" when
  // the source omits it. Missing/empty → evenly distributed. Number("50%") is
  // NaN, which the old code silently collapsed to 0 (every gradient → solid).
  if (rawSource == null || rawSource === '') {
    return count > 1 ? index / (count - 1) : 0
  }
  const str = String(rawSource).trim()
  const hadPercent = str.endsWith('%')
  const num = parseFloat(str)
  if (!Number.isFinite(num)) return count > 1 ? index / (count - 1) : 0
  const offset = hadPercent || num > 1 ? num / 100 : num
  return Math.min(1, Math.max(0, offset))
}

function normalizeGradientStops(fill) {
  const colors = fill?.value?.colors || fill?.colors || fill?.stops || []
  return colors.map((stop, index) => ({
    offset: parseStopOffset(stop.offset ?? stop.pos, index, colors.length),
    color: stop.color || stop.value || '#000000',
  }))
}

function ooxmlAngleToCss(deg) {
  // OOXML gradient angle is clockwise from East (3 o'clock); CSS linear-gradient
  // is clockwise from North (12 o'clock). Same rotation sense, zero-reference
  // offset by exactly 90°, so cssAngle = (ooxml + 90) mod 360. Verified at all
  // cardinals: 0→90 (right), 90→180 (down), 180→270 (left), 270→0 (up).
  const d = Number(deg)
  if (!Number.isFinite(d)) return 0
  return (((Math.round(d) + 90) % 360) + 360) % 360
}

function gradientBackground(fill) {
  const stops = normalizeGradientStops(fill)
  const ooxmlAngle = Number(fill?.value?.rot ?? fill?.angle ?? 0) || 0
  const cssAngle = ooxmlAngleToCss(ooxmlAngle)
  const cssStops = stops.map((stop) => `${stop.color} ${Math.round(stop.offset * 100)}%`).join(', ')
  return {
    type: 'gradient',
    angle: cssAngle,
    stops,
    gradient: `linear-gradient(${cssAngle}deg, ${cssStops || '#ffffff 0%, #ffffff 100%'})`,
  }
}

function svgAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function arrowMarker(value) {
  const marker = String(value || '').toLowerCase()
  if (!marker || marker === 'none' || marker === 'no') return 'none'
  if (marker.includes('diamond')) return 'diamond'
  if (marker.includes('oval') || marker.includes('circle')) return 'circle'
  if (marker.includes('stealth')) return 'stealth'
  if (marker.includes('triangle') || marker.includes('arrow')) return 'arrow'
  return 'none'
}

module.exports = {
  arrowMarker,
  colorValue,
  gradientBackground,
  normalizeGradientStops,
  svgAttr,
}

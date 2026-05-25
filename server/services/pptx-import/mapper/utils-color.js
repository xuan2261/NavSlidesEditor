function colorValue(value, fallback = 'transparent') {
  if (typeof value === 'string' && value) return value
  if (value?.type === 'color' && value.value) return value.value
  if (value?.color) return value.color
  if (value?.type === 'none') return 'none'
  if (value?.type === 'gradient') return 'gradient'
  if (value?.type === 'pattern') return 'transparent'
  return fallback
}

function normalizeGradientStops(fill) {
  const colors = fill?.value?.colors || fill?.colors || fill?.stops || []
  return colors.map((stop, index) => {
    const offsetSource = stop.offset ?? stop.pos ?? (colors.length > 1 ? (index / (colors.length - 1)) * 100 : 0)
    const offset = Number(offsetSource) > 1 ? Number(offsetSource) / 100 : Number(offsetSource)
    return {
      offset: Number.isFinite(offset) ? Math.min(1, Math.max(0, offset)) : 0,
      color: stop.color || stop.value || '#000000',
    }
  })
}

function gradientBackground(fill) {
  const stops = normalizeGradientStops(fill)
  const angle = Number(fill?.value?.rot ?? fill?.angle ?? 0) || 0
  const cssStops = stops.map((stop) => `${stop.color} ${Math.round(stop.offset * 100)}%`).join(', ')
  return {
    type: 'gradient',
    angle,
    stops,
    gradient: `linear-gradient(${angle}deg, ${cssStops || '#ffffff 0%, #ffffff 100%'})`,
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

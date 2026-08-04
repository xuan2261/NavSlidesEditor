const DARK_CHART_TEXT = '#141413'
const DARK_CHART_GRID = 'rgba(20,20,19,0.16)'
const LIGHT_CHART_TEXT = '#f8fafc'
const LIGHT_CHART_GRID = 'rgba(248,250,252,0.28)'

const NAMED_COLORS = {
  black: '#000000',
  white: '#ffffff',
  gray: '#808080',
  grey: '#808080',
  transparent: '#00000000',
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function parseChannel(value) {
  const raw = String(value).trim()
  if (raw.endsWith('%')) return clamp((Number.parseFloat(raw) / 100) * 255, 0, 255)
  return clamp(Number.parseFloat(raw), 0, 255)
}

function parseCssColor(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return null
  const named = NAMED_COLORS[raw]
  if (named) return parseCssColor(named)

  const hex = raw.replace(/^#/, '')
  if (/^[0-9a-f]{3,8}$/.test(hex)) {
    const expanded = hex.length <= 4 ? hex.split('').map((part) => `${part}${part}`).join('') : hex
    if (expanded.length === 6 || expanded.length === 8) {
      return {
        r: Number.parseInt(expanded.slice(0, 2), 16),
        g: Number.parseInt(expanded.slice(2, 4), 16),
        b: Number.parseInt(expanded.slice(4, 6), 16),
      }
    }
  }

  const rgb = raw.match(/^rgba?\(([^)]+)\)$/)
  if (rgb) {
    const parts = rgb[1].split(/[\s,]+/).filter(Boolean)
    if (parts.length >= 3) {
      return { r: parseChannel(parts[0]), g: parseChannel(parts[1]), b: parseChannel(parts[2]) }
    }
  }

  const hsl = raw.match(/^hsla?\(([^)]+)\)$/)
  if (hsl) {
    const parts = hsl[1].split(/[\s,]+/).filter(Boolean)
    if (parts.length >= 3) {
      const hue = ((Number.parseFloat(parts[0]) % 360) + 360) % 360
      const saturation = clamp(Number.parseFloat(parts[1]), 0, 100) / 100
      const lightness = clamp(Number.parseFloat(parts[2]), 0, 100) / 100
      const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
      const segment = hue / 60
      const x = chroma * (1 - Math.abs((segment % 2) - 1))
      const [r1, g1, b1] =
        segment < 1
          ? [chroma, x, 0]
          : segment < 2
            ? [x, chroma, 0]
            : segment < 3
              ? [0, chroma, x]
              : segment < 4
                ? [0, x, chroma]
                : segment < 5
                  ? [x, 0, chroma]
                  : [chroma, 0, x]
      const match = (lightness - chroma / 2) * 255
      return { r: (r1 * 255) + match, g: (g1 * 255) + match, b: (b1 * 255) + match }
    }
  }

  return null
}

function getRelativeLuminance({ r, g, b }) {
  const linearize = (channel) => {
    const normalized = channel / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

function asColorBackground(color) {
  const value = typeof color === 'string' ? color.trim() : ''
  return value ? { type: 'color', color: value } : null
}

function getFxBackgroundColor(background, preferFallback = false) {
  const fx = background?.fx
  if (!fx || typeof fx !== 'object') return background?.value
  const paramsColor = fx.params && typeof fx.params.bg === 'string' ? fx.params.bg : ''
  const fallbackColor = typeof fx.fallbackColor === 'string' ? fx.fallbackColor : ''
  return preferFallback
    ? fallbackColor || paramsColor || background.value
    : paramsColor || fallbackColor || background.value
}

/**
 * Resolve the solid/gradient background that is actually visible behind a chart.
 * Missing and `none` backgrounds need a caller-provided rendered fallback because
 * the editor, present mode, and print mode intentionally use different defaults.
 */
function resolveChartBackground(background, fallbackColor, options = {}) {
  const fallback = asColorBackground(fallbackColor)
  if (!background || typeof background !== 'object') return fallback || background
  if (background.type === 'none') return fallback || background
  if (background.type === 'color') return asColorBackground(background.color) || fallback || background
  if (background.type === 'fx') {
    const fxColor = getFxBackgroundColor(background, options.preferFallback === true)
    return asColorBackground(fxColor) || fallback || background
  }
  if (background.type === 'gradient' && !background.gradient && !background.stops?.length) {
    return fallback || background
  }
  return background
}

function getBackgroundColorSources(background) {
  if (typeof background === 'string') return [background]
  if (!background || typeof background !== 'object') return []
  if (background.type === 'color') return [background.color]
  if (background.type === 'gradient') {
    const stopColors = Array.isArray(background.stops)
      ? background.stops.map((stop) => stop?.color).filter(Boolean).join(',')
      : ''
    return [background.gradient, stopColors]
  }
  if (background.type === 'fx') return [getFxBackgroundColor(background)]
  return []
}

function getBackgroundLuminance(background) {
  const sources = getBackgroundColorSources(background)
  const tokens = sources.flatMap((source) =>
    String(source || '').match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi) || []
  )
  const colors = tokens.map(parseCssColor).filter(Boolean)
  if (!colors.length) return null
  return colors.reduce((sum, color) => sum + getRelativeLuminance(color), 0) / colors.length
}

function resolveChartPalette(background) {
  const luminance = getBackgroundLuminance(background)
  if (luminance != null && luminance < 0.45) {
    return { text: LIGHT_CHART_TEXT, grid: LIGHT_CHART_GRID }
  }
  return { text: DARK_CHART_TEXT, grid: DARK_CHART_GRID }
}

module.exports = {
  DARK_CHART_TEXT,
  DARK_CHART_GRID,
  LIGHT_CHART_TEXT,
  LIGHT_CHART_GRID,
  getBackgroundLuminance,
  resolveChartBackground,
  resolveChartPalette,
}

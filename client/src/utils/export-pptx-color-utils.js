const DEFAULT_TEXT_COLOR = 'FFFFFF'
const DEFAULT_BACKGROUND_COLOR = '1E1E2E'
const COLOR_NAMES = {
  black: '#000000',
  blue: '#0000ff',
  gray: '#808080',
  green: '#008000',
  red: '#ff0000',
  transparent: 'transparent',
  white: '#ffffff',
  yellow: '#ffff00',
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function rgbaToPptColor(r, g, b, alpha = 1, fallback = DEFAULT_TEXT_COLOR) {
  const color = [r, g, b]
    .map((value) => clamp(Number(value) || 0, 0, 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
  const normalizedAlpha = clamp(Number(alpha), 0, 1)
  return {
    color: color || fallback,
    transparency:
      normalizedAlpha >= 1 ? undefined : clamp(Math.round((1 - normalizedAlpha) * 100), 0, 100),
  }
}

export function normalizeCssColor(input, fallback = DEFAULT_TEXT_COLOR) {
  const raw = String(input || '').trim().toLowerCase()
  if (!raw) return { color: fallback }
  if (raw === 'transparent') return { color: fallback, transparency: 100 }

  const named = COLOR_NAMES[raw]
  if (named) return normalizeCssColor(named, fallback)

  const hex = raw.replace('#', '')
  if (/^[0-9a-f]{3,8}$/.test(hex)) {
    if (hex.length === 3 || hex.length === 4) {
      const [r, g, b, a = 'f'] = hex.split('')
      return normalizeCssColor(`#${r}${r}${g}${g}${b}${b}${a}${a}`, fallback)
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = Number.parseInt(hex.slice(0, 2), 16)
      const g = Number.parseInt(hex.slice(2, 4), 16)
      const b = Number.parseInt(hex.slice(4, 6), 16)
      const alpha = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1
      return rgbaToPptColor(r, g, b, alpha, fallback)
    }
  }

  const rgbaMatch = raw.match(/^rgba?\(([^)]+)\)$/)
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(',').map((part) => part.trim())
    if (parts.length >= 3) {
      const alpha = parts[3] == null ? 1 : Number.parseFloat(parts[3])
      return rgbaToPptColor(parts[0], parts[1], parts[2], alpha, fallback)
    }
  }

  return { color: fallback }
}

export { DEFAULT_BACKGROUND_COLOR, DEFAULT_TEXT_COLOR }

/**
 * Design token layer: single source of truth for `'auto'` color resolution.
 *
 * Both render paths (string templates in element-renderers/shapeUtils AND the
 * React editor renderers) import from here so the `'auto' -> var(--ns-*)`
 * mapping never diverges.
 *
 * DEFAULT_TOKENS mirrors the pre-existing hardcoded element defaults exactly,
 * so a deck rendered with no active theme looks byte-identical at paint time.
 */

const DEFAULT_TOKENS = {
  colors: {
    bg: '#1e1e2e', // matches getBgPrintStyle / "none" background fallback
    surface: '#2a2a3e', // neutral panel surface (used by table cell bg auto)
    accent: '#6366f1', // matches shape.fill default
    accent2: '#8b5cf6', // matches shape stroke / secondary accent
    text: '#ffffff', // matches every white text/icon/stroke default
    muted: 'rgba(255,255,255,0.6)', // matches muted captions
  },
  fonts: {
    heading: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    body: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  radius: 8,
  spacingScale: 1,
}

const COLOR_KEYS = ['bg', 'surface', 'accent', 'accent2', 'text', 'muted']

/**
 * Maps {elementType -> {field -> tokenName}}. Each entry maps a themeable
 * color field to the token whose DEFAULT_TOKENS value equals that field's
 * historical hardcoded default, so flipping defaults to `'auto'` is a no-op
 * visually until a theme changes the token.
 */
const AUTO_FIELD_MAP = {
  shape: { fill: 'accent', stroke: 'accent2', textColor: 'text' },
  text: { textColor: 'text' },
  icon: { iconColor: 'text' },
  line: { stroke: 'text' },
  drawing: { strokeColor: 'text' },
  latex: { textColor: 'text' },
  timeline: { lineColor: 'accent', dotColor: 'accent', textColor: 'text' },
  callout: { calloutTextColor: 'text' },
  table: {
    textColor: 'text',
    headerTextColor: 'text',
    headerBgColor: 'accent',
    cellBgColor: 'surface',
    borderColor: 'muted',
  },
}

/** Returns the `var(--ns-*)` string a given (type, field) `'auto'` resolves to. */
function resolveAutoColor(elementType, field) {
  const token = AUTO_FIELD_MAP[elementType] && AUTO_FIELD_MAP[elementType][field]
  // Unknown (type, field) -> safe fallback to the text token; never throws.
  return `var(--ns-${token || 'text'})`
}

/** True for the exact `var(--ns-<name>)` shape we emit (used to whitelist in safeCssColor). */
function isTokenVar(value) {
  return typeof value === 'string' && /^var\(--ns-[a-z0-9-]+\)$/.test(value.trim())
}

/**
 * SVG presentation attributes (e.g. fill="...") do NOT resolve CSS custom
 * properties — only CSS contexts (style="fill:..."/stylesheet) do. So for an
 * SVG paint, emit token vars via `style` and literal colors as the attribute
 * (keeps frozen-hex output byte-identical). Returns `{ attr, style }` fragments.
 */
function svgPaint(name, value) {
  if (isTokenVar(value)) return { attr: '', style: `${name}:${value};` }
  return { attr: ` ${name}="${value}"`, style: '' }
}

/**
 * If a color field value is the `'auto'` sentinel, resolve it to a token var;
 * otherwise return the original value untouched (so frozen hex passes through).
 */
function resolveColorField(value, elementType, field) {
  return value === 'auto' ? resolveAutoColor(elementType, field) : value
}

/** Serialize a token set into a `--ns-*: value;` declaration string for a CSS block. */
function tokensToCssVars(tokens) {
  const t = tokens || DEFAULT_TOKENS
  const colors = t.colors || {}
  const parts = []
  for (const key of COLOR_KEYS) {
    if (colors[key] != null) parts.push(`--ns-${key}:${colors[key]}`)
  }
  if (t.fonts) {
    if (t.fonts.heading) parts.push(`--ns-font-heading:${t.fonts.heading}`)
    if (t.fonts.body) parts.push(`--ns-font-body:${t.fonts.body}`)
  }
  if (t.radius != null) parts.push(`--ns-radius:${typeof t.radius === 'number' ? `${t.radius}px` : t.radius}`)
  return parts.length ? `${parts.join(';')};` : ''
}

/** Deep-merge a partial token override onto a base token set (colors/fonts merged shallowly). */
function mergeTokens(base, override) {
  if (!override) return base
  return {
    ...base,
    ...override,
    colors: { ...(base.colors || {}), ...(override.colors || {}) },
    fonts: { ...(base.fonts || {}), ...(override.fonts || {}) },
  }
}

/**
 * Token set -> React inline-style object of CSS custom properties
 * ({ '--ns-accent': '#...', ... }) for the editor canvas root, so children
 * resolve var(--ns-*) natively. Mirrors tokensToCssVars for the string path.
 */
function tokensToStyleObject(tokens) {
  const t = tokens || DEFAULT_TOKENS
  const colors = t.colors || {}
  const obj = {}
  for (const key of COLOR_KEYS) {
    if (colors[key] != null) obj[`--ns-${key}`] = colors[key]
  }
  if (t.fonts) {
    if (t.fonts.heading) obj['--ns-font-heading'] = t.fonts.heading
    if (t.fonts.body) obj['--ns-font-body'] = t.fonts.body
  }
  if (t.radius != null) obj['--ns-radius'] = typeof t.radius === 'number' ? `${t.radius}px` : t.radius
  return obj
}

// Every color field name that can carry the `'auto'` sentinel, flattened from AUTO_FIELD_MAP.
const AUTO_COLOR_FIELDS = new Set(
  Object.values(AUTO_FIELD_MAP).flatMap((fields) => Object.keys(fields))
)

/** True if any themeable color field on an element holds the `'auto'` sentinel. */
function elementUsesAutoColor(el) {
  if (!el || typeof el !== 'object') return false
  for (const field of AUTO_COLOR_FIELDS) {
    if (el[field] === 'auto') return true
  }
  return false
}

/**
 * True if a presentation needs the token layer injected: it carries explicit
 * designTokens (deck or per-slide) OR any element uses an `'auto'` color.
 * When false, the deck is frozen-hex and must render byte-identically (no
 * `:root{--ns-*}` block emitted), preserving backward-compat for saved decks.
 */
function presentationUsesTokens(presentation) {
  if (!presentation) return false
  if (presentation.designTokens) return true
  const slides = presentation.slides || []
  for (const slide of slides) {
    if (slide && slide.designTokens) return true
    const groups = [slide && slide.elements, ...((slide && slide.children) || []).map((c) => c.elements)]
    for (const els of groups) {
      if (!Array.isArray(els)) continue
      for (const el of els) {
        if (elementUsesAutoColor(el)) return true
      }
    }
  }
  return false
}

module.exports = {
  DEFAULT_TOKENS,
  COLOR_KEYS,
  AUTO_FIELD_MAP,
  AUTO_COLOR_FIELDS,
  resolveAutoColor,
  resolveColorField,
  isTokenVar,
  svgPaint,
  tokensToCssVars,
  mergeTokens,
  tokensToStyleObject,
  elementUsesAutoColor,
  presentationUsesTokens,
}

const THEME_DEFAULT_COLORS = new Set([
  '#1e1e2e',
  '#1a1a4e',
  '#2a2a3e',
  '#2d2d4e',
  '#4b5563',
  '#6366f1',
  '#8b5cf6',
  '#888888',
  '#ffffff',
  '#fff',
])

const THEMEABLE_COLOR_FIELDS = new Set([
  'fill',
  'stroke',
  'textColor',
  'iconColor',
  'lineColor',
  'dotColor',
  'headerBgColor',
  'headerTextColor',
  'cellBgColor',
  'borderColor',
])

function clonePlain(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function normalizeThemeColorField(field, value, element) {
  if (!THEMEABLE_COLOR_FIELDS.has(field) || typeof value !== 'string') return value
  const normalized = value.trim().toLowerCase()
  const fill = typeof element?.fill === 'string' ? element.fill.trim().toLowerCase() : ''
  if (field === 'fill' && (normalized === '#ffffff' || normalized === '#fff')) return value
  if (field === 'textColor' && (fill === '#ffffff' || fill === '#fff')) return value
  return THEME_DEFAULT_COLORS.has(normalized) ? 'auto' : value
}

export function cloneTemplateElementForTheme(element, idFactory) {
  const cloned = clonePlain(element)
  cloned.id = idFactory()
  for (const [field, value] of Object.entries(cloned)) {
    cloned[field] = normalizeThemeColorField(field, value, cloned)
  }
  return cloned
}

export function cloneInheritedDesignTokens(slide) {
  return clonePlain(slide?.designTokens)
}

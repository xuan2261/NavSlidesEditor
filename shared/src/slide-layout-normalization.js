const ELEMENT_TYPES = new Set([
  'text', 'image', 'shape', 'code', 'latex', 'html', 'markdown', 'chart', 'video', 'audio',
  'table', 'icon', 'callout', 'qrcode', 'drawing', 'line', 'svg', 'timeline', 'game',
])

const PLACEHOLDER_ROLES = new Set(['title', 'subtitle', 'body', 'image', 'media', 'chart', 'footer', 'custom'])
const MAX_LAYOUT_MASTERS = 64
const MAX_MASTER_ELEMENTS = 128
const MAX_PLACEHOLDERS = 64
const MAX_OVERRIDES = 256

const isObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value)
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value)
const isId = (value) => typeof value === 'string' && value.length > 0 && value.length <= 200

function validGeometry(value) {
  return isObject(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y) &&
    isFiniteNumber(value.width) && value.width > 0 && isFiniteNumber(value.height) && value.height > 0
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function normalizeElement(element) {
  return validGeometry(element) && isId(element.id) && ELEMENT_TYPES.has(element.type) ? clone(element) : null
}

function normalizePlaceholder(placeholder) {
  if (!validGeometry(placeholder) || !isId(placeholder.id) || !ELEMENT_TYPES.has(placeholder.type) || !PLACEHOLDER_ROLES.has(placeholder.role)) return null
  const result = clone(placeholder)
  if (result.zIndex != null && !Number.isInteger(result.zIndex)) delete result.zIndex
  if (result.locked != null && typeof result.locked !== 'boolean') delete result.locked
  if (!isObject(result.contentPolicy)) delete result.contentPolicy
  return result
}

function normalizeLayoutMaster(master) {
  if (!isObject(master) || !isId(master.id) || typeof master.name !== 'string' || master.name.trim().length === 0 || master.name.length > 200) return null
  const fixedElements = Array.isArray(master.fixedElements) ? master.fixedElements.map(normalizeElement).filter(Boolean) : null
  const placeholders = Array.isArray(master.placeholders) ? master.placeholders.map(normalizePlaceholder).filter(Boolean) : null
  if (!fixedElements || !placeholders || fixedElements.length > MAX_MASTER_ELEMENTS || placeholders.length > MAX_PLACEHOLDERS) return null
  const ids = new Set()
  if ([...fixedElements, ...placeholders].some(({ id }) => ids.has(id) || !ids.add(id))) return null
  const result = { id: master.id, name: master.name.trim(), fixedElements, placeholders }
  if (master.system === true) result.system = true
  if (validGeometry(master.safeArea)) result.safeArea = clone(master.safeArea)
  if (isObject(master.tokens)) result.tokens = clone(master.tokens)
  return result
}

function normalizeLayoutMasters(layoutMasters) {
  if (!Array.isArray(layoutMasters) || layoutMasters.length > MAX_LAYOUT_MASTERS) return undefined
  const normalized = layoutMasters.map(normalizeLayoutMaster)
  if (normalized.some((master) => !master)) return undefined
  const ids = new Set()
  return normalized.some(({ id }) => ids.has(id) || !ids.add(id)) ? undefined : normalized
}

function normalizeLayoutOverrides(overrides) {
  if (!isObject(overrides)) return undefined
  const hiddenElementIds = Array.isArray(overrides.hiddenElementIds) && overrides.hiddenElementIds.length <= MAX_OVERRIDES
    ? [...new Set(overrides.hiddenElementIds.filter(isId))] : []
  const elementPatches = isObject(overrides.elementPatches)
    ? Object.fromEntries(Object.entries(overrides.elementPatches).slice(0, MAX_OVERRIDES).filter(([id, patch]) => isId(id) && isObject(patch)).map(([id, patch]) => [id, Object.fromEntries(Object.entries(patch).filter(([key]) => key !== 'id' && key !== 'type'))])) : {}
  const placeholderBindings = isObject(overrides.placeholderBindings)
    ? Object.fromEntries(Object.entries(overrides.placeholderBindings).slice(0, MAX_OVERRIDES).filter(([placeholderId, elementId]) => isId(placeholderId) && isId(elementId))) : {}
  return hiddenElementIds.length || Object.keys(elementPatches).length || Object.keys(placeholderBindings).length
    ? { ...(hiddenElementIds.length ? { hiddenElementIds } : {}), ...(Object.keys(elementPatches).length ? { elementPatches } : {}), ...(Object.keys(placeholderBindings).length ? { placeholderBindings } : {}) }
    : undefined
}

function normalizeSlideLayout(slide, layoutIds) {
  if (!isObject(slide)) return slide
  const layoutId = isId(slide.layoutId) && (!layoutIds || layoutIds.has(slide.layoutId)) ? slide.layoutId : undefined
  const layoutOverrides = normalizeLayoutOverrides(slide.layoutOverrides)
  if (!layoutId && !layoutOverrides) return slide
  return { ...slide, ...(layoutId ? { layoutId } : {}), ...(layoutOverrides ? { layoutOverrides } : {}) }
}

module.exports = {
  ELEMENT_TYPES, PLACEHOLDER_ROLES, MAX_LAYOUT_MASTERS, MAX_MASTER_ELEMENTS, MAX_PLACEHOLDERS, MAX_OVERRIDES,
  clone, isId, isObject, normalizeElement, normalizeLayoutMaster, normalizeLayoutMasters, normalizeLayoutOverrides, normalizeSlideLayout,
}

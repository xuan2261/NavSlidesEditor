const { mergeTokens } = require('./design-tokens.js')
const { clone, isId, isObject, normalizeLayoutMasters, normalizeLayoutOverrides } = require('./slide-layout-normalization.js')

const FIXED_ID_PREFIX = 'layout-fixed:'
const fixedId = (layoutId, elementId) => `${FIXED_ID_PREFIX}${layoutId}:${elementId}`
const position = (element, fallback) => Number.isFinite(element?.zIndex) ? element.zIndex : fallback
const safePatch = (patch) => Object.fromEntries(Object.entries(patch || {}).filter(([key]) => key !== 'id' && key !== 'type'))
const withoutLayout = ({ layoutId: _layoutId, layoutOverrides: _layoutOverrides, ...slide }) => slide

function findLayout(layoutMasters, layoutId) {
  return isId(layoutId) ? (normalizeLayoutMasters(layoutMasters) || []).find((layout) => layout.id === layoutId) : null
}

function classifyElement(element) {
  if (element.type === 'image') return 'image'
  if (element.type === 'video' || element.type === 'audio') return 'media'
  if (element.type === 'chart') return 'chart'
  if (element.type !== 'text') return 'custom'
  const content = String(element.content || '').toLowerCase()
  if (/<h1\b/.test(content)) return 'title'
  if (/<h2\b/.test(content)) return 'subtitle'
  if (/footer|copyright|page number/.test(content)) return 'footer'
  return 'body'
}

function createPlaceholderElement(placeholder, createId) {
  const defaults = isObject(placeholder.contentPolicy?.elementDefaults) ? clone(placeholder.contentPolicy.elementDefaults) : {}
  return { ...defaults, id: createId(), type: placeholder.type, x: placeholder.x, y: placeholder.y, width: placeholder.width, height: placeholder.height, ...(placeholder.zIndex != null ? { zIndex: placeholder.zIndex } : {}) }
}

function resolveEffectiveElements(slide, layoutMasters) {
  const owned = Array.isArray(slide?.elements) ? slide.elements : []
  const layout = findLayout(layoutMasters, slide?.layoutId)
  if (!layout) return { elements: owned.map(clone), warnings: slide?.layoutId ? ['Missing or malformed layout reference'] : [] }
  const overrides = normalizeLayoutOverrides(slide.layoutOverrides) || {}
  const hidden = new Set(overrides.hiddenElementIds || [])
  const patches = overrides.elementPatches || {}
  const ownedById = new Map(owned.filter((element) => isId(element?.id)).map((element) => [element.id, element]))
  const boundIds = new Set()
  const fixed = layout.fixedElements.filter((element) => !hidden.has(element.id) && !hidden.has(fixedId(layout.id, element.id))).map((element, index) => ({ ...clone(element), ...safePatch(patches[element.id] || patches[fixedId(layout.id, element.id)]), id: fixedId(layout.id, element.id), locked: true, __order: index }))
  const placeholders = layout.placeholders.flatMap((placeholder, index) => {
    const binding = overrides.placeholderBindings?.[placeholder.id]
    const ownedElement = ownedById.get(binding)
    if (!ownedElement || hidden.has(placeholder.id) || hidden.has(binding)) return []
    boundIds.add(binding)
    return [{ ...clone(placeholder), ...clone(ownedElement), id: binding, type: placeholder.type, x: placeholder.x, y: placeholder.y, width: placeholder.width, height: placeholder.height, ...(placeholder.zIndex != null ? { zIndex: placeholder.zIndex } : {}), __order: fixed.length + index }]
  })
  const remaining = owned.filter((element) => !boundIds.has(element?.id) && !hidden.has(element?.id)).map((element, index) => ({ ...clone(element), __order: fixed.length + placeholders.length + index }))
  return {
    elements: [...fixed, ...placeholders, ...remaining].sort((a, b) => position(a, a.__order) - position(b, b.__order) || a.__order - b.__order).map(({ __order, ...element }) => element),
    warnings: [],
  }
}

function resolveEffectiveSlide(slide, layoutMasters) {
  const layout = findLayout(layoutMasters, slide?.layoutId)
  const { elements, warnings } = resolveEffectiveElements(slide, layoutMasters)
  return { slide: { ...clone(slide || {}), elements, ...(layout?.tokens ? { designTokens: mergeTokens(layout.tokens, slide?.designTokens) } : {}) }, warnings }
}

function bindPlaceholders(elements, layout, createId) {
  const unused = new Set(elements.map((_, index) => index))
  const bindings = {}
  const nextElements = elements.map(clone)
  for (const placeholder of layout.placeholders) {
    const match = [...unused].find((index) => nextElements[index]?.type === placeholder.type && classifyElement(nextElements[index]) === placeholder.role)
    const index = match == null ? nextElements.push(createPlaceholderElement(placeholder, createId)) - 1 : match
    unused.delete(index)
    bindings[placeholder.id] = nextElements[index].id
  }
  return { elements: nextElements, placeholderBindings: bindings }
}

function applyLayout(slide, layoutMasters, layoutId, createId = () => crypto.randomUUID()) {
  const layout = findLayout(layoutMasters, layoutId)
  if (!layout) return { slide: clone(slide), warnings: ['Missing or malformed layout reference'] }
  const bound = bindPlaceholders(Array.isArray(slide?.elements) ? slide.elements : [], layout, createId)
  return { slide: { ...clone(slide || {}), elements: bound.elements, layoutId: layout.id, layoutOverrides: { placeholderBindings: bound.placeholderBindings } }, warnings: [] }
}

function changeLayout(slide, layoutMasters, layoutId, createId = () => crypto.randomUUID()) {
  return applyLayout(withoutLayout(slide || {}), layoutMasters, layoutId, createId)
}

function detachLayout(slide, layoutMasters, createId = () => crypto.randomUUID()) {
  const layout = findLayout(layoutMasters, slide?.layoutId)
  if (!layout) return { slide: withoutLayout(clone(slide || {})), warnings: slide?.layoutId ? ['Missing or malformed layout reference'] : [] }
  const { slide: effective, warnings } = resolveEffectiveSlide(slide, layoutMasters)
  const fixedIds = new Set(layout.fixedElements.map((element) => fixedId(layout.id, element.id)))
  const elements = effective.elements.map((element) => fixedIds.has(element.id) ? { ...element, id: createId() } : element)
  return { slide: { ...withoutLayout(effective), elements }, warnings }
}

module.exports = { FIXED_ID_PREFIX, fixedId, resolveEffectiveElements, resolveEffectiveSlide, applyLayout, changeLayout, detachLayout }

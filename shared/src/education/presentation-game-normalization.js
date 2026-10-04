const { normalizeGameElement } = require('./normalize-game-config')
const { stripElementGameFields, stripTransients } = require('./game-config-projection')
const { isGameSubtype } = require('./game-registry')
const { fixedId } = require('../slide-layouts')
const {
  isId,
  isObject,
  normalizeLayoutMasters,
  normalizeLayoutOverrides,
} = require('../slide-layout-normalization')
const { normalizePresentationInteractions } = require('./presentation-interaction-normalization.js')

function projectDraftFields(authored, normalized) {
  if (!isObject(authored) || !isObject(normalized)) return normalized
  return Object.fromEntries(
    Object.keys(authored)
      .filter((key) => Object.prototype.hasOwnProperty.call(normalized, key))
      .map((key) => [key, projectDraftFields(authored[key], normalized[key])])
  )
}

function normalizeOverrides(slide, layouts, policy) {
  const layout = isId(slide.layoutId)
    ? layouts.find((master) => master.id === slide.layoutId)
    : null
  const patches = normalizeLayoutOverrides(slide.layoutOverrides)?.elementPatches
  if (!layout || !patches) return slide.layoutOverrides
  const sanitized = { ...slide.layoutOverrides.elementPatches }
  for (const [id, patch] of Object.entries(patches)) {
    const target = layout.fixedElements.find(
      (element) => element.id === id || fixedId(layout.id, element.id) === id
    )
    if (target?.type !== 'game') continue
    // Layout resolution replaces nested blocks, rather than deep-merging them.
    const effective = normalizeGameElement({ ...target, ...patch }, policy)
    const authored = stripElementGameFields(patch)
    sanitized[id] = Object.fromEntries(
      Object.keys(authored).map((key) => [
        key,
        !policy.validate && isGameSubtype(key)
          ? projectDraftFields(stripTransients(authored[key], key), effective[key])
          : effective[key],
      ])
    )
  }
  return { ...slide.layoutOverrides, elementPatches: sanitized }
}

function normalizePresentationGames(presentation, { validate = true } = {}) {
  const policy = { validate }
  const normalizeElement = (element) =>
    element?.type === 'game' ? normalizeGameElement(element, policy) : element
  const normalizeElements = (elements) =>
    Array.isArray(elements) ? elements.map(normalizeElement) : elements
  const layoutMasters = Array.isArray(presentation.layoutMasters)
    ? presentation.layoutMasters.map((master) => ({
        ...master,
        fixedElements: normalizeElements(master.fixedElements),
      }))
    : presentation.layoutMasters
  const layouts = normalizeLayoutMasters(layoutMasters) || []
  const normalizeSlides = (slides) =>
    Array.isArray(slides)
      ? slides.map((slide) => ({
          ...slide,
          ...(Array.isArray(slide.elements) ? { elements: normalizeElements(slide.elements) } : {}),
          ...(slide.layoutOverrides
            ? { layoutOverrides: normalizeOverrides(slide, layouts, policy) }
            : {}),
          ...(Array.isArray(slide.children) ? { children: normalizeSlides(slide.children) } : {}),
        }))
      : slides
  return normalizePresentationInteractions(
    {
      ...presentation,
      ...(Array.isArray(presentation.slides)
        ? { slides: normalizeSlides(presentation.slides) }
        : {}),
      ...(Array.isArray(presentation.layoutMasters) ? { layoutMasters } : {}),
    },
    policy
  )
}

module.exports = { normalizePresentationGames }

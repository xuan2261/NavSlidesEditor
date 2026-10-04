import { clonePresetElements } from 'revealjs-shared/src/education/presets/clone.js'
import {
  remapInteractionReferences,
  remapInteractionSlideReferences,
} from 'revealjs-shared/src/education/interaction-references.js'
import { resolveEffectiveElements } from 'revealjs-shared'
import { isGameSubtype } from 'revealjs-shared/src/education/game-registry.js'

export function clampSlideIndex(index, slideCount) {
  if (slideCount <= 0) return 0
  return Math.min(Math.max(index, 0), slideCount - 1)
}

function uniqueSortedIndices(indices, maxLength) {
  return [...new Set(indices)]
    .filter((index) => Number.isInteger(index) && index >= 0 && index < maxLength)
    .sort((a, b) => a - b)
}

export function cloneSlideWithNewIds(
  slide,
  createId = () => crypto.randomUUID(),
  layoutMasters = [],
  warnings = []
) {
  const id = createId()
  const effective = resolveEffectiveElements(slide, layoutMasters).elements
  const byId = new Map(effective.map((element) => [element.id, element]))
  const sourceElements = (slide.elements || []).map((element) =>
    byId.get(element.id)?.action ? { ...element, action: byId.get(element.id).action } : element
  )
  const copied = sourceElements.length
    ? clonePresetElements(
        { elements: sourceElements },
        {
          createId,
          destinationElements: effective,
          preserveExternalTargets: true,
        }
      )
    : { elements: [], idMap: new Map() }
  const elementIds = copied.idMap
  const elements = copied.elements
  const overrides = slide.layoutOverrides
    ? {
        ...slide.layoutOverrides,
        ...(Array.isArray(slide.layoutOverrides.hiddenElementIds)
          ? { hiddenElementIds: [...slide.layoutOverrides.hiddenElementIds] }
          : {}),
        ...(slide.layoutOverrides.elementPatches
          ? { elementPatches: structuredClone(slide.layoutOverrides.elementPatches) }
          : {}),
        ...(slide.layoutOverrides.placeholderBindings
          ? {
              placeholderBindings: Object.fromEntries(
                Object.entries(slide.layoutOverrides.placeholderBindings).flatMap(
                  ([placeholderId, elementId]) =>
                    elementIds.has(elementId) ? [[placeholderId, elementIds.get(elementId)]] : []
                )
              ),
            }
          : {}),
      }
    : undefined
  const copy = {
    ...structuredClone(slide),
    id,
    elements,
    ...(overrides ? { layoutOverrides: overrides } : {}),
    children: (slide.children || []).map((child) =>
      cloneSlideWithNewIds(child, createId, layoutMasters, warnings)
    ),
  }
  const effectiveElements = (target) => resolveEffectiveElements(target, layoutMasters).elements
  if (copy.layoutOverrides?.elementPatches) {
    for (const [key, patch] of Object.entries(copy.layoutOverrides.elementPatches)) {
      let authored = patch
      if (Object.keys(patch).some(isGameSubtype)) {
        const { action, ...config } = patch
        const cloned = clonePresetElements(
          { elements: [{ ...config, id: `layout-override:${key}` }] },
          { createId, destinationElements: effectiveElements(copy), preserveExternalTargets: true }
        )
        const { id: _ownedId, ...ownedConfig } = cloned.elements[0]
        authored = { ...ownedConfig, ...(action ? { action } : {}) }
      }
      const remapped = remapInteractionReferences([{ ...authored, id: key }], elementIds, {
        destinationElements: effectiveElements(copy),
      })
      const { id: _patchId, ...next } = remapped.elements[0]
      copy.layoutOverrides.elementPatches[key] = next
      warnings.push(...remapped.warnings)
    }
  }
  const remapped = remapInteractionSlideReferences({ ...copy, children: undefined }, new Map(), {
    effectiveElements,
  })
  warnings.push(...remapped.warnings)
  return { ...remapped.slide, children: copy.children }
}

/**
 * @param {Object[]} slides
 * @param {number[]} indices
 * @param {() => string} [createId] - factory for new slide/element IDs (defaults to crypto.randomUUID)
 * @param {number} [currentSlideIndex] - for future undo/redo context tracking
 */
export function duplicateSlidesAtIndices(
  slides,
  indices,
  createId = () => crypto.randomUUID(),
  _currentSlideIndex = 0,
  layoutMasters = []
) {
  const selected = uniqueSortedIndices(indices, slides.length)
  const selectedSet = new Set(selected)
  const duplicatedIndices = []
  const nextSlides = []
  const warnings = []

  slides.forEach((slide, index) => {
    nextSlides.push(slide)
    if (selectedSet.has(index)) {
      nextSlides.push(cloneSlideWithNewIds(slide, createId, layoutMasters, warnings))
      duplicatedIndices.push(nextSlides.length - 1)
    }
  })

  return {
    slides: nextSlides,
    duplicatedIndices,
    warnings,
    currentSlideIndex:
      duplicatedIndices.length > 0 ? duplicatedIndices[duplicatedIndices.length - 1] : 0,
  }
}

export function deleteSlidesAtIndices(slides, indices, currentSlideIndex) {
  const selected = uniqueSortedIndices(indices, slides.length)
  if (!selected.length || slides.length - selected.length < 1) {
    return {
      slides,
      currentSlideIndex: clampSlideIndex(currentSlideIndex, slides.length),
    }
  }

  const selectedSet = new Set(selected)
  const nextSlides = slides.filter((_, index) => !selectedSet.has(index))
  const deletedBeforeOrAtCurrent = selected.filter((index) => index <= currentSlideIndex).length
  const nextIndex = clampSlideIndex(currentSlideIndex - deletedBeforeOrAtCurrent, nextSlides.length)

  return {
    slides: nextSlides,
    currentSlideIndex: nextIndex,
  }
}

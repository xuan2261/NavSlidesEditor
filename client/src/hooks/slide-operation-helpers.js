import { clonePresetElements } from 'revealjs-shared/src/education/presets/clone.js'
import {
  remapInteractionReferences,
  remapInteractionSlideReferences,
} from 'revealjs-shared/src/education/interaction-references.js'
import { resolveEffectiveElements } from 'revealjs-shared'
import { isGameSubtype } from 'revealjs-shared/src/education/game-registry.js'
import semanticDocument from 'revealjs-shared/src/pptx-semantic-document.js'
import timing from 'revealjs-shared/src/pptx-timing-document.js'
import { semanticInstances, semanticDefinitions, replaceSemanticRecords } from 'revealjs-shared/src/pptx-semantic-records.js'

function cloneSlideOccurrences(document, source, copy, createId) {
  if (!document) return document
  const slideIds = new Map()
  const occupied = new Set()
  for (const [id] of semanticInstances(document)) occupied.add(id)
  for (const [id] of semanticDefinitions(document)) occupied.add(id)
  function visit(original, cloned) {
    slideIds.set(original.id, cloned.id)
    for (const slide of [original, cloned]) {
      occupied.add(slide.id)
      for (const element of slide.elements || []) {
        occupied.add(element.id)
        if (element.groupId) occupied.add(element.groupId)
      }
    }
    for (const [index, child] of (original.children || []).entries())
      visit(child, cloned.children[index])
  }
  visit(source, copy)

  // Retain tombstoned groups too: copied ungroup/regroup history must not
  // point back into the source slide's authoring or retained paint scopes.
  const originals = []
  for (const [, instance] of semanticInstances(document)) {
    if (slideIds.has(instance.slideId)) originals.push(instance)
  }
  const instanceIds = new Map(originals.map((instance) => {
    const id = createId()
    if (typeof id !== 'string' || !id || occupied.has(id))
      throw new TypeError('Semantic slide duplication requires fresh occurrence IDs')
    occupied.add(id)
    return [instance.id, id]
  }))
  const remap = (id) => {
    if (!instanceIds.has(id)) throw new TypeError('Semantic slide reference leaves its occurrence subtree')
    return instanceIds.get(id)
  }
  const patchInstances = {}
  for (const original of originals) {
    const instance = structuredClone(original)
    instance.id = remap(original.id)
    instance.slideId = slideIds.get(original.slideId)
    instance.parentInstanceId = original.parentInstanceId === null ? null : remap(original.parentInstanceId)
    for (const binding of Object.values(instance.connectorBindings || {})) {
      if (binding && instanceIds.has(binding.targetInstanceId))
        binding.targetInstanceId = instanceIds.get(binding.targetInstanceId)
    }
    for (const component of Object.values(instance.overrides.components || {})) {
      const provider = component.geometryStyle?.fill?.gradientPatch?.stops?.provider
      if (!provider) continue
      if (instanceIds.has(provider.instanceId))
        provider.instanceId = instanceIds.get(provider.instanceId)
      const [sourceKey, stops] = JSON.parse(provider.declarationKey)
      const remapOrigin = (origin) =>
        origin && typeof origin === 'object'
          ? { ...origin, ...(instanceIds.has(origin.instanceId) ? { instanceId: instanceIds.get(origin.instanceId) } : {}) }
          : origin
      provider.declarationKey = JSON.stringify([
        sourceKey,
        stops.map(([origin, transforms]) => [remapOrigin(origin), transforms.map(remapOrigin)]),
      ])
    }
    if (instance.lineage) {
      if (instanceIds.has(instance.lineage.ungroupedFrom))
        instance.lineage.ungroupedFrom = remap(instance.lineage.ungroupedFrom)
      else delete instance.lineage.ungroupedFrom
      if (instanceIds.has(instance.lineage.ungroupHidden?.groupId))
        instance.lineage.ungroupHidden.groupId = remap(instance.lineage.ungroupHidden.groupId)
      else delete instance.lineage.ungroupHidden
    }
    // Source bindings and relationship chains remain byte-for-byte source
    // authority. Definitions, styles, fonts and sourceSlides stay shared.
    patchInstances[instance.id] = instance
  }
  function rebind(original, cloned) {
    cloned.sourceTimingDefinitionIds = timing.timingDefinitions(document, original).map(definition => definition.id)
    for (const [index, element] of (original.elements || []).entries()) {
      if (element.pptxInstanceId === undefined) continue
      cloned.elements[index].pptxInstanceId = remap(element.pptxInstanceId)
      if (instanceIds.has(element.groupId)) cloned.elements[index].groupId = remap(element.groupId)
    }
    if (cloned.sourceTiming) {
      cloned.sourceTiming.overrides = cloned.sourceTiming.overrides.map((override) =>
        instanceIds.has(override.targetInstanceId)
          ? { ...override, targetInstanceId: instanceIds.get(override.targetInstanceId) }
          : override
      )
    }
    for (const [index, child] of (original.children || []).entries())
      rebind(child, cloned.children[index])
  }
  rebind(source, copy)
  const nextDoc = replaceSemanticRecords(document, { instances: patchInstances })
  return semanticDocument.normalizePptxSemanticDocument(nextDoc)
}

export function withDeletedSlideOccurrences(presentation, slides) {
  if (!presentation.pptxSemantic) return { ...presentation, slides }
  const removed = new Set()
  function visit(items, add) {
    for (const slide of items) {
      if (add) removed.add(slide.id)
      else removed.delete(slide.id)
      visit(slide.children || [], add)
    }
  }
  visit(presentation.slides, true)
  visit(slides, false)
  const patchInstances = {}
  for (const [id, instance] of semanticInstances(presentation.pptxSemantic)) {
    if (!removed.has(instance.slideId) || instance.lineage?.tombstone) continue
    patchInstances[id] = { ...instance, lineage: {
      ...instance.lineage, tombstone: true, deleted: true,
      ...(instance.lineage?.paintOnly ? { paintOnly: false } : {}),
    } }
  }
  const document = semanticDocument.normalizePptxSemanticDocument(
    replaceSemanticRecords(presentation.pptxSemantic, { instances: patchInstances })
  )
  return { ...presentation, slides, pptxSemantic: document }
}
export function clampSlideIndex(index, slideCount) {
  if (slideCount <= 0) return 0
  return Math.min(Math.max(index, 0), slideCount - 1)
}

function uniqueSortedIndices(indices, maxLength) {
  return [...new Set(indices)]
    .filter((index) => Number.isInteger(index) && index >= 0 && index < maxLength)
    .sort((a, b) => a - b)
}

function cloneSlideTree(
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
      cloneSlideTree(child, createId, layoutMasters, warnings)
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

export function cloneSlideWithNewIds(
  slide,
  createId = () => crypto.randomUUID(),
  layoutMasters = [],
  warnings = [],
  pptxSemantic
) {
  const copy = cloneSlideTree(slide, createId, layoutMasters, warnings)
  const semantic = cloneSlideOccurrences(pptxSemantic, slide, copy, createId)
  if (semantic) {
    Object.defineProperty(copy, 'pptxSemantic', {
      value: semantic,
      writable: true,
      configurable: true,
      enumerable: false,
    })
  }
  Object.defineProperty(copy, 'slide', {
    value: copy,
    writable: true,
    configurable: true,
    enumerable: false,
  })
  return copy
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
  layoutMasters = [],
  pptxSemantic
) {
  const selected = uniqueSortedIndices(indices, slides.length)
  const selectedSet = new Set(selected)
  const duplicatedIndices = []
  const nextSlides = []
  const warnings = []
  let semantic = pptxSemantic

  slides.forEach((slide, index) => {
    nextSlides.push(slide)
    if (selectedSet.has(index)) {
      const cloned = cloneSlideWithNewIds(slide, createId, layoutMasters, warnings, semantic)
      nextSlides.push(cloned.slide)
      semantic = cloned.pptxSemantic
      duplicatedIndices.push(nextSlides.length - 1)
    }
  })

  return {
    slides: nextSlides,
    ...(semantic ? { pptxSemantic: semantic } : {}),
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

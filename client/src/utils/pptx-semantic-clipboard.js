import core from 'revealjs-shared/src/pptx-semantic-document.js'
import semantic from 'revealjs-shared/src/pptx-semantic-presentation.js'
import groups from 'revealjs-shared/src/pptx-semantic-groups.js'
import render from 'revealjs-shared/src/pptx-semantic-render-tree.js'
import geometryStyles from 'revealjs-shared/src/pptx-geometry-style-resolution.js'
import timing from 'revealjs-shared/src/pptx-timing-document.js'
import { clonePresetElements } from 'revealjs-shared/src/education/presets/clone.js'
import { semanticCompatibility } from './pptx-semantic-geometry-bridge.js'
import { semanticInstance, semanticDefinition, semanticStyle, semanticInstances, semanticDefinitions, semanticStyles, replaceSemanticRecords } from 'revealjs-shared/src/pptx-semantic-records.js'

const fail = (message) => {
  throw new TypeError(message)
}
const active = (i) => i && !i.lineage?.tombstone
const equal = (a, b) => {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  const keys = Object.keys(a)
  return (
    keys.length === Object.keys(b).length &&
    keys.every((k) => Object.hasOwn(b, k) && equal(a[k], b[k]))
  )
}
const slidesOf = (slides) => (slides || []).flatMap((s) => [s, ...slidesOf(s.children)])
function ancestors(document, instance) {
  const result = []
  for (
    let id = instance.parentInstanceId;
    id !== null && id !== undefined;
    id = semanticInstance(document, id)?.parentInstanceId
  ) {
    const inst = semanticInstance(document, id)
    if (!active(inst) || result.includes(id))
      fail('Invalid external ancestor context')
    result.push(id)
  }
  return result
}
function selection(document, slide, ids) {
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length || !ids.length)
    fail('Invalid semantic selection roots')
  for (const id of ids) {
    const i = semanticInstance(document, id)
    if (!active(i) || i.slideId !== slide.id || i.lineage?.paintOnly)
      fail('Invalid semantic selection root')
  }
  const roots = ids
    .filter((id) => !ancestors(document, semanticInstance(document, id)).some((p) => ids.includes(p)))
    .sort((a, b) => semanticInstance(document, a).paintIndex - semanticInstance(document, b).paintIndex)
  const closure = []
  for (const [, i] of semanticInstances(document)) {
    if (active(i) && (roots.includes(i.id) || ancestors(document, i).some((p) => roots.includes(p)))) {
      closure.push(i)
    }
  }
  return {
    rootInstanceIds: roots,
    instanceIds: [...roots, ...closure.map((i) => i.id).filter((id) => !roots.includes(id))],
  }
}

// Uses the live normalized document directly; suitable for availability without cloning its snapshot.
export function semanticClipboardSelection({ presentation, slide, selectedElementIds }) {
  const document = presentation?.pptxSemantic
  if (!document || !slide) return null
  const ids = selectedElementIds
    .map(
      (id) =>
        slide.elements?.find((e) => e.id === id)?.pptxInstanceId ||
        (semanticInstance(document, id) ? id : null)
    )
    .filter(Boolean)
  if (!ids.length) return null
  if (
    selectedElementIds.some(
      (id) => !semanticInstance(document, id) && !slide.elements?.some((e) => e.id === id)
    )
  )
    fail('Invalid clipboard selection')
  const result = selection(document, slide, [...new Set(ids)])
  const protectedIds = new Set(result.instanceIds)
  for (const id of result.rootInstanceIds)
    ancestors(document, semanticInstance(document, id)).forEach((p) => protectedIds.add(p))
  const blocked = [...protectedIds].some((id) => {
    const i = semanticInstance(document, id),
      content = semanticDefinition(document, i.definitionId)?.content
    return (
      (i.overrides.locked ?? i.locked ?? content.locked) ||
      (i.overrides.hidden ?? i.hidden ?? content.hidden) ||
      slide.elements?.some((e) => e.pptxInstanceId === id && (e.locked || e.hidden))
    )
  })
  return {
    ...result,
    blockedReason: slide.locked
      ? 'Slide is locked'
      : blocked
        ? 'Selection contains locked or hidden semantic content'
        : null,
  }
}

export function createSemanticClipboard({
  presentation,
  slide,
  selectedElementIds,
  effectiveElements = slide.elements,
}) {
  const selected = semanticClipboardSelection({ presentation, slide, selectedElementIds })
  if (!selected) return null
  if (typeof presentation.id !== 'string' || !presentation.id)
    fail('Clipboard requires presentation identity')
  const document = core.normalizePptxSemanticDocument(presentation.pptxSemantic)
  const elements = (slide.elements || [])
    .filter(
      (e) =>
        selected.instanceIds.includes(e.pptxInstanceId) ||
        (!e.pptxInstanceId && selectedElementIds.includes(e.id))
    )
    .map((e) => {
      const action = effectiveElements?.find((item) => item.id === e.id)?.action
      return structuredClone(action ? { ...e, action } : e)
    })
  return {
    kind: 'pptx-semantic-selection',
    version: 1,
    source: { presentationId: presentation.id, slideId: slide.id },
    document,
    rootInstanceIds: selected.rootInstanceIds,
    elements,
  }
}

export function pasteSemanticClipboard({ presentation, slideId, clipboard, pasteIndex = 0 }) {
  if (
    clipboard?.kind !== 'pptx-semantic-selection' ||
    clipboard.version !== 1 ||
    !clipboard.source?.slideId ||
    !clipboard.source.presentationId ||
    !presentation.pptxSemantic ||
    clipboard.source.presentationId !== presentation.id
  )
    fail('Unsupported cross-document semantic clipboard')
  if (!Number.isSafeInteger(pasteIndex) || pasteIndex < 0) fail('Invalid clipboard paste index')
  const destination = semantic.normalizeSemanticPresentation(presentation)
  const slide = slidesOf(destination.slides).find((s) => s.id === slideId)
  if (!slide) fail('Unknown semantic clipboard destination slide')
  if (slide.locked) fail('Slide is locked')
  const document = core.normalizePptxSemanticDocument(clipboard.document),
    live = destination.pptxSemantic
  const { rootInstanceIds: roots, instanceIds: ids } = selection(
    document,
    { id: clipboard.source.slideId },
    clipboard.rootInstanceIds
  )
  if (!equal(roots, clipboard.rootInstanceIds)) fail('Invalid overlapping semantic clipboard roots')
  for (const field of ['definitions', 'styles']) {
    const generator = field === 'definitions' ? semanticDefinitions(document) : semanticStyles(document)
    for (const [id, value] of generator) {
      const liveRecord = field === 'definitions' ? semanticDefinition(live, id) : semanticStyle(live, id)
      if (
        (field === 'definitions' ? value.origin !== 'project' : value.origin === 'source') &&
        !equal(value, liveRecord)
      )
        fail('Stale or forged clipboard source records')
    }
  }
  const patchDefinitions = {},
    definitionMap = new Map()
  const occupied = new Set([
    ...Array.from(semanticInstances(live), ([id]) => id),
    ...Array.from(semanticInstances(document), ([id]) => id),
    ...Array.from(semanticDefinitions(live), ([id]) => id),
    ...slidesOf(destination.slides).flatMap((s) => (s.elements || []).map((e) => e.id)),
    ...(clipboard.elements || []).map((e) => e.id),
  ])
  const allocate = () => {
    const id = globalThis.crypto.randomUUID()
    if (occupied.has(id)) fail('Clipboard ID allocation collision')
    occupied.add(id)
    return id
  }
  const instanceMap = new Map(ids.map((id) => [id, allocate()]))
  for (const id of ids) {
    const i = semanticInstance(document, id),
      definition = semanticDefinition(document, i.definitionId)
    if (
      definition.origin === 'project' &&
      !equal(definition, semanticDefinition(live, definition.id)) &&
      !definitionMap.has(definition.id)
    ) {
      const nextId = allocate()
      patchDefinitions[nextId] = { ...definition, id: nextId }
      definitionMap.set(definition.id, nextId)
    }
    if (document.schemaVersion === 2 && definition.origin !== 'project') {
      const liveInst = semanticInstance(live, id)
      if (
        liveInst &&
        ['definitionId', 'sourceBinding', 'relationshipChain'].some(
          (key) => !equal(i[key], liveInst[key])
        )
      )
        fail('Stale or forged source occurrence binding')
      const context = semanticStyle(live, i.sourceBinding?.contextId)
      let foundMatchingLive = Boolean(liveInst)
      if (!foundMatchingLive) {
        for (const [, original] of semanticInstances(live)) {
          if (
            original.definitionId === i.definitionId &&
            equal(original.relationshipChain, i.relationshipChain) &&
            equal(original.sourceBinding, i.sourceBinding)
          ) {
            foundMatchingLive = true
            break
          }
        }
      }
      if (
        context?.origin !== 'source' ||
        context.kind !==
          (definition.kind === 'group' ? 'group-fill-context' : 'geometry-context') ||
        context.payload.definitionId !== i.definitionId ||
        !equal(context.payload.relationshipChain, i.relationshipChain) ||
        !foundMatchingLive
      )
        fail('Unsupported source closure or forged clipboard binding')
      if (definition.kind !== 'group') {
        const frame = geometryStyles.geometryFillFrame(document, id)
        if (
          frame &&
          !ids.includes(frame.ownerInstanceId) &&
          (!active(semanticInstance(live, id)) || !equal(frame, geometryStyles.geometryFillFrame(live, id)))
        )
          fail('External ancestor paint context changed')
      }
    }
  }
  if (
    !Array.isArray(clipboard.elements) ||
    new Set(clipboard.elements.map((e) => e.id)).size !== clipboard.elements.length
  )
    fail('Invalid clipboard leaf identities')
  const links = clipboard.elements.filter((e) => e.pptxInstanceId).map((e) => e.pptxInstanceId)
  if (
    new Set(links).size !== links.length ||
    links.some(
      (id) =>
        !ids.includes(id) ||
        semanticDefinition(document, semanticInstance(document, id)?.definitionId)?.kind === 'group'
    ) ||
    ids.some(
      (id) => {
        const def = semanticDefinition(document, semanticInstance(document, id)?.definitionId)
        return (
          def?.kind !== 'group' &&
          !def?.content?.excludedObjects?.length &&
          !links.includes(id)
        )
      }
    )
  )
    fail('Invalid clipboard semantic leaf linkage')
  const sameScope = slideId === clipboard.source.slideId
  const groupCounts = new Map()
  for (const e of clipboard.elements)
    if (e.groupId) groupCounts.set(e.groupId, (groupCounts.get(e.groupId) || 0) + 1)
  const grouped = clipboard.elements.map((e) =>
    e.groupId && groupCounts.get(e.groupId) < 2 ? { ...e, groupId: undefined } : e
  )
  const cloned = clipboard.elements.length
    ? clonePresetElements(
        { elements: grouped },
        {
          createId: allocate,
          destinationElements: slide.elements || [],
          preserveExternalTargets: sameScope,
        }
      )
    : { elements: [], warnings: [], idMap: new Map() }
  const patchInstances = {},
    offset = 20 * (pasteIndex + 1),
    paint = new Map()
  for (const id of ids) {
    const original = semanticInstance(document, id),
      i = structuredClone(original)
    i.id = instanceMap.get(id)
    i.slideId = slideId
    i.definitionId = definitionMap.get(i.definitionId) || i.definitionId
    i.parentInstanceId = instanceMap.get(i.parentInstanceId) || i.parentInstanceId
    if (roots.includes(id)) {
      const ancestry = ancestors(document, original)
      if (!sameScope && ancestry.length)
        fail('Unsupported external ancestor paint dependency across slides')
      for (const parent of ancestry)
        if (!equal(semanticInstance(document, parent), semanticInstance(live, parent)))
          fail('External ancestor context changed')
      if (
        ancestry.some(
          (parent) => {
            const p = semanticInstance(live, parent)
            return p?.overrides?.locked || p?.locked
          }
        )
      )
        fail('External ancestor is locked')
      const delta = groups.pointerDeltaInParent(document, id, {
        x: offset / render.EMU_TO_CSS,
        y: offset / render.EMU_TO_CSS,
      })
      i.localTransform[4] += delta.x
      i.localTransform[5] += delta.y
      const parent = i.parentInstanceId
      if (!paint.has(parent)) {
        let maxPaint = -1
        for (const [, item] of semanticInstances(live)) {
          if (item.slideId === slideId && item.parentInstanceId === parent && active(item)) {
            if (item.paintIndex > maxPaint) maxPaint = item.paintIndex
          }
        }
        paint.set(parent, maxPaint)
      }
      i.paintIndex = paint.get(parent) + 1
      paint.set(parent, i.paintIndex)
    }
    for (const binding of Object.values(i.connectorBindings || {})) {
      if (!binding) continue
      const target = binding.targetInstanceId
      if (instanceMap.has(target)) binding.targetInstanceId = instanceMap.get(target)
      else if (
        !sameScope ||
        !active(semanticInstance(live, target)) ||
        ['definitionId', 'slideId', 'sourceBinding', 'relationshipChain'].some(
          (key) => !equal(semanticInstance(document, target)?.[key], semanticInstance(live, target)?.[key])
        )
      )
        fail('Unresolved external connector target or changed ownership')
    }
    for (const component of Object.values(i.overrides.components || {})) {
      const provider = component.geometryStyle?.fill?.gradientPatch?.stops?.provider
      if (provider) {
        if (instanceMap.has(provider.instanceId))
          provider.instanceId = instanceMap.get(provider.instanceId)
        const [sourceKey, stops] = JSON.parse(provider.declarationKey)
        const remapOrigin = (origin) =>
          origin && typeof origin === 'object'
            ? { ...origin, instanceId: instanceMap.get(origin.instanceId) ?? origin.instanceId }
            : origin
        provider.declarationKey = JSON.stringify([
          sourceKey,
          stops.map(([origin, transforms]) => [remapOrigin(origin), transforms.map(remapOrigin)]),
        ])
      }
    }
    if (i.lineage) {
      if (instanceMap.has(i.lineage.ungroupedFrom))
        i.lineage.ungroupedFrom = instanceMap.get(i.lineage.ungroupedFrom)
      else delete i.lineage.ungroupedFrom
      if (instanceMap.has(i.lineage.ungroupHidden?.groupId))
        i.lineage.ungroupHidden.groupId = instanceMap.get(i.lineage.ungroupHidden.groupId)
      else delete i.lineage.ungroupHidden
    }
    patchInstances[i.id] = i
  }
  const nextDoc = replaceSemanticRecords(live, {
    definitions: Object.keys(patchDefinitions).length ? patchDefinitions : undefined,
    instances: patchInstances,
  })
  const nextDocument = core.normalizePptxSemanticDocument(nextDoc)
  const elements = cloned.elements.map((e) =>
    e.pptxInstanceId
      ? { ...e, pptxInstanceId: instanceMap.get(e.pptxInstanceId) }
      : { ...e, x: (e.x || 0) + offset, y: (e.y || 0) + offset }
  )
  const replace = (slides) =>
    slides.map((s) =>
      s.id === slideId
        ? semanticCompatibility(
            nextDocument,
            timing.pinDuplicatedTimingTargets(
              live, s, nextDocument, { ...s, elements: [...(s.elements || []), ...elements] }
            ),
            live
          )
        : { ...s, ...(s.children ? { children: replace(s.children) } : {}) }
    )
  const result = semantic.normalizeSemanticPresentation({
    ...destination,
    pptxSemantic: nextDocument,
    slides: replace(destination.slides),
  })
  render.semanticRenderTree(
    result.pptxSemantic,
    slidesOf(result.slides).find((s) => s.id === slideId)
  )
  return {
    presentation: result,
    warnings: cloned.warnings,
    selectedIds: [
      ...roots.map((id) =>
        semanticDefinition(document, semanticInstance(document, id)?.definitionId)?.kind === 'group'
          ? instanceMap.get(id)
          : cloned.idMap.get(clipboard.elements.find((e) => e.pptxInstanceId === id)?.id)
      ),
      ...cloned.elements.filter((e) => !e.pptxInstanceId).map((e) => e.id),
    ],
  }
}

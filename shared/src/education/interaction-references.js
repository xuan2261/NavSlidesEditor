const VISIBILITY_KINDS = new Set(['show', 'hide', 'toggle'])
const mappedId = (id, idRemap) => {
  if (idRemap instanceof Map) return idRemap.has(id) ? idRemap.get(id) : id
  return idRemap && Object.hasOwn(idRemap, id) ? idRemap[id] : id
}

// Resolve only within a caller-supplied effective slide, never a deck-wide lookup.
function resolveInteractionTarget(elements, targetElementId, { idRemap, referenceError } = {}) {
  if (referenceError) return { element: null, error: referenceError }
  const id = mappedId(targetElementId, idRemap)
  const matches = (elements || []).filter((element) => element?.id === id && !element.hidden)
  if (matches.length !== 1)
    return {
      element: null,
      error: matches.length
        ? 'Target ID is ambiguous in this effective slide.'
        : 'Target is missing from this effective slide. Choose an existing, exported element.',
    }
  return { element: matches[0], error: '' }
}

// Reuse the clipboard/clone/detach caller's ID map for both sources and targets.
// An unresolved reference is retained for author repair, never redirected elsewhere.
function remapInteractionReferences(
  elements,
  idRemap,
  { destinationElements, preserveExternalTargets = true } = {}
) {
  const next = (elements || []).map((element) => ({
    ...element,
    id: mappedId(element.id, idRemap),
    ...(element.action ? { action: { ...element.action } } : {}),
  }))
  const destination = destinationElements || next
  const warnings = []
  for (const element of next) {
    if (!VISIBILITY_KINDS.has(element.action?.kind)) continue
    const previous = element.action.targetElementId
    const target = mappedId(previous, idRemap)
    const mapped = target !== previous
    element.action.targetElementId = target
    const resolved = resolveInteractionTarget(destination, target)
    const error =
      element.action.referenceError ||
      (!mapped && !preserveExternalTargets
        ? 'Target is outside its authored source scope. Choose an existing target on this destination slide.'
        : resolved.error)
    // Existing unresolved provenance requires an explicit author target choice.
    const diagnostic = error
    if (diagnostic) {
      element.action.referenceError = diagnostic
      warnings.push({ sourceElementId: element.id, targetElementId: target, error: diagnostic })
    } else delete element.action.referenceError
  }
  return { elements: next, warnings }
}

// Each vertical child is its own scope. Fixed layout IDs can remain unchanged;
// callers provide effective elements when master targets need to be retained.
function remapInteractionSlideReferences(slide, idRemap, { effectiveElements } = {}) {
  const own = remapInteractionReferences(slide.elements || [], idRemap, {
    destinationElements: effectiveElements?.(slide)?.map((element) => ({
      ...element,
      id: mappedId(element.id, idRemap),
    })),
  })
  const children = (slide.children || []).map((child) =>
    remapInteractionSlideReferences(child, idRemap, { effectiveElements })
  )
  return {
    slide: {
      ...slide,
      id: mappedId(slide.id, idRemap),
      elements: own.elements,
      ...(slide.children ? { children: children.map((result) => result.slide) } : {}),
    },
    warnings: [...own.warnings, ...children.flatMap((result) => result.warnings)],
  }
}

module.exports = {
  resolveInteractionTarget,
  remapInteractionReferences,
  remapInteractionSlideReferences,
}

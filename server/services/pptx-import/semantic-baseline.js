const { isDeepStrictEqual } = require('node:util')
const {
  normalizePptxSemanticDocument,
  PptxSemanticValidationError,
} = require('revealjs-shared/src/pptx-semantic-document.js')
const {
  semanticDefinition,
  semanticInstance,
  semanticStyle,
  semanticDefinitions,
  semanticInstances,
  semanticStyles,
} = require('revealjs-shared/src/pptx-semantic-records.js')

function assertSemanticBaseline(before, after) {
  if (before.pptxSemantic === undefined) return
  if (before.pptxSemantic === after.pptxSemantic) return
  const baseline = normalizePptxSemanticDocument(before.pptxSemantic)
  const next = normalizePptxSemanticDocument(after.pptxSemantic)
  if (baseline === next) return
  function fail() {
    throw new PptxSemanticValidationError('Imported semantic baseline is immutable')
  }
  if (
    (baseline.schemaVersion === 2 || baseline.schemaVersion === 3) &&
    next.schemaVersion !== baseline.schemaVersion
  )
    fail()
  if (!isDeepStrictEqual(baseline.sourceSlides, next.sourceSlides)) fail()
  for (const catalog of [
    'declarationScopes',
    'sourceParts',
    'sourceLocations',
    'textShapes',
    'textInventories',
    'sourceIdentities',
    'typedPropertyValues',
    'sourceRelationships',
    'fontDescriptors',
    'partUris',
  ]) {
    if (baseline[catalog] !== undefined && !isDeepStrictEqual(baseline[catalog], next[catalog])) fail()
  }
  for (const [id, definition] of semanticDefinitions(baseline)) {
    if (definition.origin === 'project') continue
    const nextDef = semanticDefinition(next, id)
    if (!isDeepStrictEqual(definition, nextDef)) fail()
  }
  for (const [id, definition] of semanticDefinitions(next)) {
    const baseDef = semanticDefinition(baseline, id)
    if (!baseDef && definition.origin !== 'project') fail()
    if (
      (baseline.schemaVersion === 2 || baseline.schemaVersion === 3) &&
      baseDef?.origin === 'project' &&
      definition.origin !== 'project'
    )
      fail()
  }
  for (const [id, instance] of semanticInstances(baseline)) {
    const baseDef = semanticDefinition(baseline, instance.definitionId)
    if (baseDef?.origin === 'project') continue
    const nextInst = semanticInstance(next, id)
    if (!nextInst || nextInst.definitionId !== instance.definitionId) fail()
    if (
      (baseline.schemaVersion === 2 || baseline.schemaVersion === 3) &&
      (!isDeepStrictEqual(instance.sourceBinding, nextInst.sourceBinding) ||
        !isDeepStrictEqual(instance.textSourceBinding, nextInst.textSourceBinding) ||
        !isDeepStrictEqual(instance.relationshipChain, nextInst.relationshipChain))
    )
      fail()
  }
  if (baseline.schemaVersion !== 2 && baseline.schemaVersion !== 3) return
  const sourceOccurrences = Array.from(semanticInstances(baseline), ([, inst]) => inst)
  for (const [id, style] of semanticStyles(baseline)) {
    if (style.origin === 'source' && !isDeepStrictEqual(style, semanticStyle(next, id))) fail()
  }
  for (const [id, style] of semanticStyles(next)) {
    if (style.origin === 'source' && !isDeepStrictEqual(style, semanticStyle(baseline, id))) fail()
  }
  for (const [id, instance] of semanticInstances(next)) {
    const nextDef = semanticDefinition(next, instance.definitionId)
    if (semanticInstance(baseline, id) || nextDef?.origin === 'project')
      continue
    const context = semanticStyle(baseline, instance.sourceBinding?.contextId)
    if (
      context?.origin !== 'source' ||
      context.kind !==
        (nextDef?.kind === 'group'
          ? 'group-fill-context'
          : 'geometry-context') ||
      context.payload.definitionId !== instance.definitionId ||
      !isDeepStrictEqual(context.payload.relationshipChain, instance.relationshipChain) ||
      !sourceOccurrences.some(
        (original) =>
          original.definitionId === instance.definitionId &&
          isDeepStrictEqual(original.relationshipChain, instance.relationshipChain) &&
          isDeepStrictEqual(original.textSourceBinding, instance.textSourceBinding) &&
          isDeepStrictEqual(original.sourceBinding, instance.sourceBinding)
      )
    )
      fail()
  }
}

module.exports = { assertSemanticBaseline }

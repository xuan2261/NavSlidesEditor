const { isDeepStrictEqual } = require('node:util')
const { SOURCE_CATALOGS, semanticSourceDomainPair } = require('./semantic-source-domain')
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
  const baseline = normalizePptxSemanticDocument(before.pptxSemantic)
  const next = normalizePptxSemanticDocument(after.pptxSemantic)
  if (baseline === next) return
  const pair = semanticSourceDomainPair(before, after)
  const equalDomain = (field) => pair
    ? pair.equal[field]
    : baseline[field] === next[field] || isDeepStrictEqual(baseline[field], next[field])
  function fail() {
    throw new PptxSemanticValidationError('Imported semantic baseline is immutable')
  }
  if (
    (baseline.schemaVersion === 2 || baseline.schemaVersion === 3) &&
    next.schemaVersion !== baseline.schemaVersion
  )
    fail()
  if (!equalDomain('sourceSlides')) fail()
  const catalogs = SOURCE_CATALOGS
  for (const catalog of catalogs) {
    if (baseline[catalog] !== undefined && !equalDomain(catalog)) fail()
  }
  if (!equalDomain('definitions')) {
    for (const [id, definition] of semanticDefinitions(baseline)) {
      if (definition.origin === 'project') continue
      const nextDef = semanticDefinition(next, id)
      if (definition !== nextDef && !isDeepStrictEqual(definition, nextDef)) fail()
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
  }
  // Wire identity has meaning only after successful canonical admission and in
  // the exact same decoding context. Raw/frozen client objects grant no trust.
  const identicalInstances = pair?.identicalInstances || new Set()
  const changedInstance = (wire) => !identicalInstances.has(wire)
  for (const [id, instance] of semanticInstances(baseline, changedInstance)) {
    const baseDef = semanticDefinition(baseline, instance.definitionId)
    if (baseDef?.origin === 'project') continue
    const nextInst = semanticInstance(next, id)
    if (!nextInst || nextInst.definitionId !== instance.definitionId) fail()
    if (instance === nextInst) continue
    if (
      (baseline.schemaVersion === 2 || baseline.schemaVersion === 3) &&
      (!isDeepStrictEqual(instance.sourceBinding, nextInst.sourceBinding) ||
        !isDeepStrictEqual(instance.textSourceBinding, nextInst.textSourceBinding) ||
        !isDeepStrictEqual(instance.relationshipChain, nextInst.relationshipChain))
    )
      fail()
  }
  if (baseline.schemaVersion !== 2 && baseline.schemaVersion !== 3) return
  let sourceOccurrences
  if (!equalDomain('styles')) {
    for (const [id, style] of semanticStyles(baseline)) {
      if (style.origin === 'source') {
        const nextStyle = semanticStyle(next, id)
        if (style !== nextStyle && !isDeepStrictEqual(style, nextStyle)) fail()
      }
    }
    for (const [id, style] of semanticStyles(next)) {
      if (style.origin === 'source') {
        const baseStyle = semanticStyle(baseline, id)
        if (style !== baseStyle && !isDeepStrictEqual(style, baseStyle)) fail()
      }
    }
  }
  for (const [id, instance] of semanticInstances(next, changedInstance)) {
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
      !(sourceOccurrences ||= Array.from(semanticInstances(baseline), ([, inst]) => inst)).some(
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

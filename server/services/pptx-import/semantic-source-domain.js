const { isDeepStrictEqual } = require('node:util')
const { reusableCanonicalSaveSnapshot } = require('./canonical-snapshot')
const { normalizePptxSemanticDocument } = require('revealjs-shared/src/pptx-semantic-document.js')

const SOURCE_CATALOGS = Object.freeze([
  'declarationScopes', 'sourceParts', 'sourceLocations', 'textShapes',
  'textInventories', 'sourceIdentities', 'typedPropertyValues',
  'sourceRelationships', 'fontDescriptors', 'partUris',
])
const DEPENDENCIES = ['definitions', 'styles', 'fonts', 'sourceSlides', ...SOURCE_CATALOGS]
const pairs = new WeakMap()

// This is a comparison receipt, not semantic admission or a save receipt. Both
// roots must already have passed all canonical budgets and be transitively sealed.
// Compare whole domains, including project records and decoding catalogs: a
// projected source-field comparison cannot establish a shared decoding context.
function semanticSourceDomainPair(before, after) {
  if (!reusableCanonicalSaveSnapshot(before) || !reusableCanonicalSaveSnapshot(after)) return null
  let successors = pairs.get(before)
  const cached = successors?.get(after)
  if (cached) return cached
  const baseline = normalizePptxSemanticDocument(before.pptxSemantic)
  const next = normalizePptxSemanticDocument(after.pptxSemantic)
  const equal = Object.create(null)
  for (const field of DEPENDENCIES) {
    equal[field] = baseline[field] === next[field] || isDeepStrictEqual(baseline[field], next[field])
  }
  const identicalInstances = new Set()
  if (baseline.schemaVersion === next.schemaVersion && DEPENDENCIES.every((field) => equal[field])) {
    for (const key of Object.keys(baseline.instances)) {
      const wire = baseline.instances[key]
      const nextWire = next.instances[key]
      if (wire === nextWire || isDeepStrictEqual(wire, nextWire)) {
        identicalInstances.add(wire)
        identicalInstances.add(nextWire)
      }
    }
  }
  const receipt = { equal, identicalInstances }
  if (!successors) pairs.set(before, successors = new WeakMap())
  successors.set(after, receipt)
  return receipt
}

module.exports = { SOURCE_CATALOGS, semanticSourceDomainPair }

const {
  FEATURE_TIERS, CanonicalFeatureMatrixValidationError, canonicalFeatureMatrixHash, canonicalMatrixBytes, parseCanonicalFeatureMatrix,
} = require('./canonical-feature-matrix-contract')
const { INVALID, isPlainRecord, ownData, ownKeys } = require('./own-plain-data')
const FEATURE_MATRIX_SCHEMA_VERSION = 1
const CANONICAL_FEATURE_MATRIX_VERSION = '1.0.0'
const CANONICAL_MATRIX_CATALOGS = Object.freeze({
  impactPolicies: [
    { id: 'ooxml-run-content-only' },
    { id: 'relationship-closure-preservation' },
    { id: 'workbook-cache-atomic-update' },
  ],
  transports: [{ id: 'server-snapshot-diff', schemaVersion: 1 }],
  eligibilityPolicies: [
    { id: 'preserve-only', version: 1 },
    { id: 'tiptap-single-plain-run', version: 1 },
  ],
  normalizationContracts: [
    { id: 'source-bytes-preservation', version: 1 },
    { id: 'tiptap-json-html-single-plain-run', version: 1 },
  ],
  adapters: [
    { id: 'native-chart-embedded-workbook', qualified: false },
    { id: 'native-image-replacement', qualified: false },
    { id: 'native-primitive-style', qualified: false },
    { id: 'native-primitive-transform', qualified: false },
    { id: 'native-slide-structure', qualified: false },
    { id: 'native-text-plain-run', qualified: true },
  ],
})
const BASE_ROW = Object.freeze({
  sourceAuthorityRule: 'authoritative-source-reference', adapterId: null,
  impactPolicyId: 'relationship-closure-preservation', transportId: 'server-snapshot-diff',
  transportSchemaVersion: 1, eligibilityPolicyId: 'preserve-only', eligibilityPolicyVersion: 1,
  normalizationContractId: 'source-bytes-preservation', normalizationContractVersion: 1,
  adapterQualified: false, transactionEligible: false, level4Promoted: false,
  claimCeiling: 'package-preservation', reason: 'Source content is retained without a promoted mutation path.',
})
function row(id, family, objectKind, tier, propertyIds, operationIds, overrides = {}) {
  return {
    ...BASE_ROW,
    id,
    family,
    objectKind,
    tier,
    scope: { propertyIds, operationIds },
    fixtureIds: [`fixture.${id}`],
    requiredTestIds: [`required-test.${id}`],
    ...overrides,
  }
}
const CANONICAL_FEATURE_MATRIX_ENVELOPE = parseCanonicalFeatureMatrix({
  schemaVersion: FEATURE_MATRIX_SCHEMA_VERSION,
  matrixVersion: CANONICAL_FEATURE_MATRIX_VERSION,
  ...CANONICAL_MATRIX_CATALOGS,
  rows: [
    row('primitive.text.run.plain-replacement', 'primitive', 'text-run', 'native-editable', ['text'], ['replace'], {
      sourceAuthorityRule: 'ooxml-run-fragment-authority',
      adapterId: 'native-text-plain-run',
      impactPolicyId: 'ooxml-run-content-only',
      eligibilityPolicyId: 'tiptap-single-plain-run',
      normalizationContractId: 'tiptap-json-html-single-plain-run',
      fixtureIds: ['pptx.primitive.text.single-plain-run'],
      requiredTestIds: ['primitive-roundtrip.text-single-plain-run'],
      adapterQualified: true,
      transactionEligible: true,
      claimCeiling: 'valid-edited-package',
      reason: 'G2 seed only; level-4 promotion remains unproven.',
    }),
    row('primitive.geometry.basic-transform', 'primitive', 'shape-transform', 'structured-partial',
      ['position-x', 'position-y', 'rotation', 'size-height', 'size-width'], ['set-transform'], {
        adapterId: 'native-primitive-transform', claimCeiling: 'feature-editability',
        reason: 'Candidate only; production transaction evidence is incomplete.',
      }),
    row('primitive.shape.solid-fill', 'primitive', 'shape-style', 'structured-partial',
      ['solid-fill'], ['set-style'], {
        adapterId: 'native-primitive-style', claimCeiling: 'feature-editability',
        reason: 'Candidate only; transaction and semantic postcondition evidence is incomplete.',
      }),
    row('primitive.shape.solid-fill-stroke', 'primitive', 'shape-style', 'structured-partial',
      ['solid-fill', 'solid-stroke'], ['set-style'], {
        adapterId: 'native-primitive-style', claimCeiling: 'feature-editability',
        reason: 'Candidate only; unsupported effects remain source-backed.',
      }),
    row('primitive.image.whole-replacement', 'primitive', 'image', 'replace-only-visual',
      ['media-source'], ['replace-whole-object'], {
        adapterId: 'native-image-replacement', claimCeiling: 'feature-editability',
        reason: 'Whole-image replacement is separately qualified from image internals.',
      }),
    row('primitive.image.crop', 'primitive', 'image', 'preserved-opaque',
      ['source-crop'], ['set-crop'], {
        reason: 'G2 excludes crop until one client/server canonical representation exists.',
      }),
    row('chart.bar-column.embedded-workbook.literal-range', 'chart', 'bar-column-chart', 'structured-partial',
      ['embedded-workbook-literal-range'], ['replace-data'], {
        sourceAuthorityRule: 'embedded-workbook-authority', adapterId: 'native-chart-embedded-workbook',
        impactPolicyId: 'workbook-cache-atomic-update', claimCeiling: 'feature-editability',
        reason: 'Candidate requires native re-import, closure, and transaction evidence.',
      }),
    row('complex.smartart.diagram', 'complex', 'smartart', 'preserved-opaque', ['diagram-data'], ['preserve'], { reason: 'SmartArt structure and fallback graphics are retained without semantic mutation.' }),
    row('complex.equation.ooxml', 'complex', 'equation', 'preserved-opaque', ['math-ooxml'], ['preserve'], { reason: 'Equation XML is retained without an editable semantic representation.' }),
    row('complex.ole.embedded-object', 'complex', 'ole-object', 'unsupported-blocking', ['embedded-object'], ['block-edited-export'], { reason: 'OLE content is original-recovery-only and never executed.' }),
    row('complex.activex.control', 'complex', 'activex-control', 'unsupported-blocking', ['control-binary'], ['block-edited-export'], {
      reason: 'ActiveX content is original-recovery-only and never executed.',
    }),
    row('complex.vba.macro', 'complex', 'vba-project', 'unsupported-blocking', ['vba-project'], ['block-edited-export'], {
      reason: 'Macro-enabled packages block edited export and retain original recovery.',
    }),
    row('complex.digital-signature', 'complex', 'digital-signature', 'unsupported-blocking', ['signature-part'], ['block-edited-export'], {
      reason: 'Signed packages block edited export to avoid signature invalidation.',
    }),
    row('complex.encrypted-protected-package', 'complex', 'package-protection', 'unsupported-blocking', ['protection'], ['block-edited-export'], {
      reason: 'Encrypted or protected packages are original-recovery-only.',
    }),
    row('complex.external-media-link', 'complex', 'external-media', 'preserved-opaque', ['external-target'], ['preserve'], {
      reason: 'External media targets are preserved without network access.',
    }),
    row('complex.vector.svg-emf-wmf', 'complex', 'vector-image', 'preserved-opaque', ['vector-media'], ['preserve'], {
      reason: 'Vector source bytes are retained without semantic editing.',
    }),
    row('complex.model-3d', 'complex', 'model-3d', 'preserved-opaque', ['model-relationship'], ['preserve'], {
      reason: '3D model parts and fallbacks are retained without mutation.',
    }),
    row('complex.unknown-content', 'complex', 'unknown-ooxml-content', 'unsupported-blocking',
      ['content-type-or-relationship'], ['block-unsafe-edit'], {
        reason: 'Unknown content blocks unsafe edited-package mutation.',
      }),
    row('presentation.slide.add', 'presentation', 'slide-structure', 'structured-partial', ['slide'], ['add'], {
      adapterId: 'native-slide-structure', claimCeiling: 'feature-editability',
      reason: 'Candidate requires authoritative structural transaction evidence.',
    }),
    row('presentation.slide.delete', 'presentation', 'slide-structure', 'structured-partial', ['slide'], ['delete'], {
      adapterId: 'native-slide-structure', claimCeiling: 'feature-editability',
      reason: 'Candidate requires reference repair and rollback evidence.',
    }),
    row('presentation.slide.duplicate', 'presentation', 'slide-structure', 'structured-partial', ['slide'], ['duplicate'], {
      adapterId: 'native-slide-structure', claimCeiling: 'feature-editability',
      reason: 'Candidate requires new source lineage and closure evidence.',
    }),
    row('presentation.slide.reorder', 'presentation', 'slide-structure', 'structured-partial', ['slide-order'], ['reorder'], {
      adapterId: 'native-slide-structure', claimCeiling: 'feature-editability',
      reason: 'Candidate requires identity-stable sequence evidence.',
    }),
    row('presentation.hidden-state', 'presentation', 'hidden-slide-state', 'preserved-opaque', ['hidden-state'], ['preserve'], {
      reason: 'Hidden-slide state is source-backed and uneditable in the first milestone.',
    }),
    row('presentation.notes.rich', 'presentation', 'speaker-notes', 'preserved-opaque', ['rich-notes'], ['preserve'], {
      reason: 'Rich notes are source-backed and uneditable in the first milestone.',
    }),
    row('presentation.comments', 'presentation', 'comments', 'preserved-opaque', ['comment-thread'], ['preserve'], {
      reason: 'Comments and authors remain source-backed without editing.',
    }),
    row('presentation.hyperlinks-actions', 'presentation', 'actions', 'preserved-opaque', ['hyperlink-action'], ['preserve'], {
      reason: 'Actions are preserved without execution or mutation.',
    }),
    row('presentation.transitions', 'presentation', 'transition', 'preserved-opaque', ['transition'], ['preserve'], {
      reason: 'Transition variants remain source-backed without editing.',
    }),
    row('presentation.timing-tree', 'presentation', 'timing-tree', 'preserved-opaque', ['timing-xml'], ['preserve'], {
      reason: 'Timing XML remains source-backed without semantic modeling.',
    }),
    row('presentation.media-behavior', 'presentation', 'media-behavior', 'preserved-opaque', ['playback-behavior'], ['preserve'], {
      reason: 'Media behavior remains source-backed without editing.',
    }),
    row('presentation.sections', 'presentation', 'sections', 'preserved-opaque', ['section-membership'], ['preserve'], {
      reason: 'Section metadata remains source-backed without editing.',
    }),
    row('presentation.custom-shows', 'presentation', 'custom-show', 'preserved-opaque', ['show-settings'], ['preserve'], {
      reason: 'Custom show settings remain source-backed without editing.',
    }),
    row('presentation.headers-footers', 'presentation', 'headers-footers', 'preserved-opaque', ['header-footer'], ['preserve'], {
      reason: 'Header and footer settings remain source-backed without editing.',
    }),
  ],
}, FEATURE_MATRIX_SCHEMA_VERSION)
const CANONICAL_FEATURE_MATRIX = CANONICAL_FEATURE_MATRIX_ENVELOPE.rows
const BINDING_FIELDS = Object.freeze(['transportId', 'transportSchemaVersion', 'eligibilityPolicyId', 'eligibilityPolicyVersion', 'normalizationContractId', 'normalizationContractVersion'])
function unsupportedBlockingVerdict(rowId, reason) {
  return Object.freeze({ type: 'feature-lookup-verdict', rowId, authorized: false,
    tier: 'unsupported-blocking', verdict: 'unsupported-blocking', reason })
}
function getFeatureRow(rowId) {
  return CANONICAL_FEATURE_MATRIX.find((candidate) => candidate.id === rowId) || null
}
function featureRow(rowId, lookup) {
  try {
    const row = getFeatureRow(rowId)
    if (!row) return unsupportedBlockingVerdict(rowId, 'unknown-row')
    if (!isPlainRecord(lookup)) return unsupportedBlockingVerdict(rowId, 'invalid-lookup')
    const allowed = new Set(['propertyId', 'operationId', ...BINDING_FIELDS])
    const keys = ownKeys(lookup)
    if (keys === null || keys.some((field) => !allowed.has(field))) {
      return unsupportedBlockingVerdict(rowId, 'invalid-lookup')
    }
    const propertyId = ownData(lookup, 'propertyId')
    const operationId = ownData(lookup, 'operationId')
    if (typeof propertyId !== 'string' || typeof operationId !== 'string') {
      return unsupportedBlockingVerdict(rowId, 'incomplete-scope')
    }
    if (!row.scope.propertyIds.includes(propertyId) || !row.scope.operationIds.includes(operationId)) {
      return unsupportedBlockingVerdict(rowId, 'unsupported-scope')
    }
    const bindings = BINDING_FIELDS.map((field) => ownData(lookup, field))
    if (bindings.some((value) => value === INVALID)) return unsupportedBlockingVerdict(rowId, 'incomplete-binding')
    if (bindings.some((value, index) => value !== row[BINDING_FIELDS[index]])) {
      return unsupportedBlockingVerdict(rowId, 'binding-mismatch')
    }
    return row
  } catch {
    return unsupportedBlockingVerdict(rowId, 'invalid-lookup')
  }
}
function featureMatrixHash(matrix = CANONICAL_FEATURE_MATRIX_ENVELOPE) {
  return canonicalFeatureMatrixHash(matrix, FEATURE_MATRIX_SCHEMA_VERSION)
}

function createMatrixDependency(matrix = CANONICAL_FEATURE_MATRIX_ENVELOPE) {
  const parsed = parseCanonicalFeatureMatrix(matrix, FEATURE_MATRIX_SCHEMA_VERSION)
  return Object.freeze({
    schemaVersion: parsed.schemaVersion,
    matrixVersion: parsed.matrixVersion,
    hash: featureMatrixHash(parsed),
  })
}

function validateMatrixDependency(dependency, matrix = CANONICAL_FEATURE_MATRIX_ENVELOPE) {
  if (!isPlainRecord(dependency)) return Object.freeze({ authorized: false, reasons: Object.freeze(['missing-matrix-subject']) })
  const keys = ownKeys(dependency)
  const expected = createMatrixDependency(matrix)
  if (keys === null || keys.length !== 3 || keys.some((key) => !['schemaVersion', 'matrixVersion', 'hash'].includes(key))) {
    return Object.freeze({ authorized: false, reasons: Object.freeze(['invalid-matrix-subject']) })
  }
  if (ownData(dependency, 'schemaVersion') !== expected.schemaVersion ||
    ownData(dependency, 'matrixVersion') !== expected.matrixVersion ||
    ownData(dependency, 'hash') !== expected.hash) {
    return Object.freeze({ authorized: false, reasons: Object.freeze(['stale-matrix-subject']) })
  }
  return Object.freeze({ authorized: true, reasons: Object.freeze([]) })
}

const MATRIX_AUTHORITY_TYPES = Object.freeze(['qualification', 'capability', 'journal', 'claim'])

function createMatrixAuthoritySubject(matrix = CANONICAL_FEATURE_MATRIX_ENVELOPE, evolutionEpoch = 1) {
  if (!Number.isSafeInteger(evolutionEpoch) || evolutionEpoch < 1) {
    throw new TypeError('Matrix authority evolution epoch must be a positive integer')
  }
  return Object.freeze({ ...createMatrixDependency(matrix), evolutionEpoch })
}

function validateMatrixAuthoritySubject(subject, matrix = CANONICAL_FEATURE_MATRIX_ENVELOPE,
  evolutionEpoch = 1) {
  if (!Number.isSafeInteger(evolutionEpoch) || evolutionEpoch < 1) {
    return Object.freeze({ authorized: false, reasons: Object.freeze(['invalid-matrix-authority-epoch']) })
  }
  if (!isPlainRecord(subject) || ownKeys(subject)?.length !== 4 ||
    !['schemaVersion', 'matrixVersion', 'hash', 'evolutionEpoch'].every((key) => ownData(subject, key) !== INVALID)) {
    return Object.freeze({ authorized: false, reasons: Object.freeze(['missing-matrix-authority-subject']) })
  }
  const dependency = validateMatrixDependency({
    schemaVersion: ownData(subject, 'schemaVersion'),
    matrixVersion: ownData(subject, 'matrixVersion'),
    hash: ownData(subject, 'hash'),
  }, matrix)
  if (!dependency.authorized) return dependency
  if (ownData(subject, 'evolutionEpoch') !== evolutionEpoch) {
    return Object.freeze({ authorized: false, reasons: Object.freeze(['stale-matrix-authority-epoch']) })
  }
  return Object.freeze({ authorized: true, reasons: Object.freeze([]) })
}

function createMatrixAuthoritySubjects(matrix = CANONICAL_FEATURE_MATRIX_ENVELOPE, evolutionEpoch = 1) {
  return Object.freeze(Object.fromEntries(
    MATRIX_AUTHORITY_TYPES.map((type) => [type, createMatrixAuthoritySubject(matrix, evolutionEpoch)])
  ))
}

function validateMatrixAuthoritySubjects(subjects, matrix = CANONICAL_FEATURE_MATRIX_ENVELOPE,
  evolutionEpoch = 1) {
  if (!isPlainRecord(subjects)) {
    return Object.freeze({
      authorized: false,
      reasons: Object.freeze(['missing-matrix-authority-subjects']),
    })
  }
  const reasons = []
  for (const type of MATRIX_AUTHORITY_TYPES) {
    const verdict = validateMatrixAuthoritySubject(ownData(subjects, type), matrix, evolutionEpoch)
    if (!verdict.authorized) {
      reasons.push(...verdict.reasons.map((reason) =>
        `${reason.replace('matrix-authority-', `${type}-matrix-authority-`).replace('matrix-subject', `${type}-matrix-subject`)}`))
    }
  }
  return Object.freeze({
    authorized: reasons.length === 0,
    reasons: Object.freeze([...new Set(reasons)].sort()),
  })
}

module.exports = {
  CANONICAL_MATRIX_CATALOGS,
  CANONICAL_FEATURE_MATRIX,
  CANONICAL_FEATURE_MATRIX_ENVELOPE,
  CANONICAL_FEATURE_MATRIX_VERSION,
  CanonicalFeatureMatrixValidationError,
  FEATURE_MATRIX_SCHEMA_VERSION,
  FEATURE_TIERS,
  canonicalMatrixBytes,
  canonicalFeatureMatrixHash,
  createMatrixAuthoritySubject,
  createMatrixAuthoritySubjects,
  createMatrixDependency,
  featureMatrixHash,
  featureRow,
  getFeatureRow,
  parseCanonicalFeatureMatrix,
  unsupportedBlockingVerdict,
  validateMatrixAuthoritySubject,
  validateMatrixAuthoritySubjects,
  validateMatrixDependency,
}

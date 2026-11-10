const { PPTX_FIT_INVALIDATING_KEYS, prunePptxFitMetadata } = require('revealjs-shared')
const { sanitizePptxImportMetadata } = require('./package-store/dto')
const { canonicalEditableSnapshot } = require('./canonical-snapshot')
const { hasOnlyOwnFields, isPlainRecord, ownData, INVALID } = require('./own-plain-data')
const { MUTATION_OPERATIONS } = require('./mutation-operation-scope')
const { hashRecord } = require('./package-store/schemas')
const {
  getProjectionCapabilitiesForInstances,
  SERIES_VALUES,
  GEOMETRY_EDIT,
  GROUP_FILL_EDIT,
  PICTURE_EDIT,
  MEDIA_EDIT,
  INHERITANCE_EDIT,
} = require('revealjs-shared/src/pptx-projection-capabilities.js')
const { FAMILY_OPERATION_TYPES } = require('revealjs-shared/src/pptx-family-operations.js')
const { CATALOGS } = require('revealjs-shared/src/pptx-semantic-records.js')

const ROOT_FIELDS = ['schemaVersion', 'originalRevisionId', 'elements', 'projection']
const ENTRY_FIELDS = ['slideId', 'elementId', 'type', 'metadata', 'fitBaseline']
const NUMBER_FIELDS = [
  'sourceFontSizePx',
  'fitFontSizePx',
  'textLength',
  '_pptxSharpen',
  '_pptxColorTemp',
]
const TEXT_BASELINE_FIELDS = new Set(['content', 'text', 'textHtml', 'fontFamily', 'textColor'])
const keyFor = (slideId, elementId, type) => JSON.stringify([slideId, elementId, type])
const finite = (value) => typeof value === 'number' && Number.isFinite(value)
const identity = (value) => typeof value === 'string' && value.length > 0 && value.length <= 1000
function invalid(detail) {
  throw Object.assign(new TypeError(`Invalid trusted import metadata: ${detail}`), {
    code: 'INVALID_TRUSTED_IMPORT_METADATA',
    status: 422,
  })
}
function record(value, fields, required = []) {
  if (
    !hasOnlyOwnFields(value, fields, required) ||
    Reflect.ownKeys(value).length !== Object.keys(value).length ||
    Object.keys(value).some((key) => ownData(value, key) === INVALID)
  )
    invalid('record fields')
}
function numberMap(value, fields, crop = false) {
  record(value, fields)
  if (
    !Object.keys(value).length ||
    Object.values(value).some((item) => !finite(item) || item < 0 || (crop && item > 1))
  )
    invalid('numeric metadata')
}
function validateMetadata(value) {
  record(value, [
    ...NUMBER_FIELDS,
    'version',
    'textFit',
    'textInsetsUnit',
    'sourceCrop',
    'textInsets',
    'cropData',
    'sourceBox',
  ])
  if (!Object.keys(value).length) invalid('empty metadata')
  for (const [key, item] of Object.entries(value)) {
    if (NUMBER_FIELDS.includes(key) && !finite(item)) invalid(key)
    if (key === 'version' && item !== 1) invalid(key)
    if (key === 'textFit' && item !== 'wrap') invalid(key)
    if (key === 'textInsetsUnit' && !['px', 'pt'].includes(item)) invalid(key)
    if (key === 'sourceCrop' && typeof item !== 'boolean') invalid(key)
    if (key === 'textInsets') numberMap(item, ['left', 'right', 'top', 'bottom'])
    if (key === 'cropData') numberMap(item, ['left', 'right', 'top', 'bottom'], true)
    if (key === 'sourceBox') numberMap(item, ['width', 'height'])
  }
}
function validateTrustedImportMetadata(value, originalRevisionId) {
  try {
    record(value, ROOT_FIELDS, ['schemaVersion', 'originalRevisionId', 'elements'])
    if (
      value.schemaVersion !== 1 ||
      !identity(originalRevisionId) ||
      value.originalRevisionId !== originalRevisionId
    )
      invalid('Original revision binding')
    if (
      !Array.isArray(value.elements) ||
      value.elements.length > 20000 ||
      Reflect.ownKeys(value.elements).length !== value.elements.length + 1
    )
      invalid('element budget')
    const seen = new Set()
    if (value.projection !== undefined) {
      const profile = value.projection
      const versionTwo = ownData(profile, 'modelVersion') === 2
      const versionThree = ownData(profile, 'modelVersion') === 3
      const isImmutable = versionTwo || versionThree
      const expectedVersion = versionThree ? 3 : versionTwo ? 2 : 1
      const hashField = isImmutable ? 'immutableSourceHash' : 'definitionsHash'
      record(
        profile,
        ['schemaVersion', 'modelVersion', hashField, 'operations'],
        ['schemaVersion', 'modelVersion', hashField, 'operations']
      )
      if (
        profile.schemaVersion !== expectedVersion ||
        profile.modelVersion !== expectedVersion ||
        typeof profile[hashField] !== 'string' ||
        !/^[a-f0-9]{64}$/.test(profile[hashField]) ||
        !Array.isArray(profile.operations) ||
        profile.operations.length > 20000 ||
        Reflect.ownKeys(profile.operations).length !== profile.operations.length + 1
      )
        invalid('projection profile')
      const instanceIds = new Set()
      const allowedOperations = [
        SERIES_VALUES,
        GEOMETRY_EDIT,
        PICTURE_EDIT,
        MEDIA_EDIT,
        ...FAMILY_OPERATION_TYPES,
        ...(isImmutable ? [GROUP_FILL_EDIT, INHERITANCE_EDIT] : []),
      ]
      for (let index = 0; index < profile.operations.length; index += 1) {
        const domain = ownData(profile.operations, String(index))
        record(domain, ['instanceId', 'operations'], ['instanceId', 'operations'])
        if (
          !identity(domain.instanceId) ||
          instanceIds.has(domain.instanceId) ||
          !Array.isArray(domain.operations) ||
          Reflect.ownKeys(domain.operations).length !== domain.operations.length + 1 ||
          !(
            (domain.operations.length === 1 &&
              allowedOperations.includes(ownData(domain.operations, '0'))) ||
            (isImmutable &&
              domain.operations.length === 2 &&
              ownData(domain.operations, '0') === GEOMETRY_EDIT &&
              ownData(domain.operations, '1') === INHERITANCE_EDIT)
          )
        )
          invalid('projection operation domain')
        instanceIds.add(domain.instanceId)
      }
    }
    for (let index = 0; index < value.elements.length; index += 1) {
      const entry = ownData(value.elements, String(index))
      record(entry, ENTRY_FIELDS, ENTRY_FIELDS)
      if (![entry.slideId, entry.elementId, entry.type].every(identity)) invalid('node identity')
      const key = keyFor(entry.slideId, entry.elementId, entry.type)
      if (seen.has(key)) invalid('duplicate node identity')
      seen.add(key)
      validateMetadata(entry.metadata)
      record(entry.fitBaseline, PPTX_FIT_INVALIDATING_KEYS)
      for (const [field, item] of Object.entries(entry.fitBaseline)) {
        if (TEXT_BASELINE_FIELDS.has(field) ? typeof item !== 'string' : !finite(item))
          invalid('fit baseline')
      }
    }
    return structuredClone(value)
  } catch (error) {
    if (error.code === 'INVALID_TRUSTED_IMPORT_METADATA') throw error
    invalid('unsafe sidecar data')
  }
}
function visitElements(elements, slideId, callback) {
  for (const element of elements || []) {
    callback(element, slideId)
    visitElements(element.elements || element.children, slideId, callback)
  }
}
function visitSlides(slides, callback) {
  for (const slide of slides || []) {
    visitElements(slide.elements, slide.id, callback)
    visitSlides(slide.children, callback)
  }
}
// Capture canonical content and detached metadata together before asynchronous
// package inventory work. The revision binder never retains mutable caller data.
function prepareTrustedImportProjection(projection, snapshotLimits) {
  const canonical = canonicalEditableSnapshot(projection, snapshotLimits)
  const baselines = new Map()
  visitSlides(canonical.slides, (element, slideId) => {
    baselines.set(
      keyFor(slideId, element.id, element.type),
      Object.fromEntries(
        PPTX_FIT_INVALIDATING_KEYS.filter((key) => Object.hasOwn(element, key)).map((key) => [
          key,
          element[key],
        ])
      )
    )
  })
  const elements = []
  visitSlides(projection.slides, (element, slideId) => {
    if (!Object.hasOwn(element, '_pptxImportMeta')) return
    if (!isPlainRecord(element._pptxImportMeta)) invalid('importer metadata')
    for (const key of Object.keys(element._pptxImportMeta)) {
      const value = ownData(element._pptxImportMeta, key)
      if (
        value === INVALID ||
        (NUMBER_FIELDS.includes(key) && value !== undefined && !finite(value))
      )
        invalid('importer metadata fields')
    }
    // Mapper-private diagnostics are not styling. Only the existing DTO allowlist is retained.
    const metadata = sanitizePptxImportMetadata(element._pptxImportMeta)
    if (!Object.keys(metadata).length) return
    elements.push({
      slideId,
      elementId: element.id,
      type: element.type,
      metadata,
      fitBaseline: baselines.get(keyFor(slideId, element.id, element.type)),
    })
  })
  const model = canonical.pptxSemantic
  const projectionProfile = model
    ? (() => {
        const modelVersion = model.schemaVersion
        const versionTwo = modelVersion === 2
        const versionThree = modelVersion === 3
        const isImmutable = versionTwo || versionThree
        const expectedVersion = versionThree ? 3 : versionTwo ? 2 : 1
        return {
          schemaVersion: expectedVersion,
          modelVersion: expectedVersion,
          ...(isImmutable
            ? {
                immutableSourceHash: hashRecord({
                  definitions: model.definitions,
                  styles: Object.fromEntries(
                    Object.entries(model.styles || {}).filter(([, style]) => style?.origin === 'source')
                  ),
                  ...(versionThree
                    ? Object.fromEntries(
                        CATALOGS.filter((catalog) => model[catalog] !== undefined).map((catalog) => [catalog, model[catalog]])
                      )
                    : {}),
                }),
              }
            : { definitionsHash: hashRecord(model.definitions) }),
          operations: getProjectionCapabilitiesForInstances(model),
        }
      })()
    : undefined
  return {
    canonicalProjection: canonical,
    collectTrustedImportMetadata(originalRevisionId) {
      return elements.length || projectionProfile
        ? validateTrustedImportMetadata(
            {
              schemaVersion: 1,
              originalRevisionId,
              elements,
              ...(projectionProfile ? { projection: projectionProfile } : {}),
            },
            originalRevisionId
          )
        : undefined
    },
  }
}
function collectTrustedImportMetadata(projection, originalRevisionId) {
  return prepareTrustedImportProjection(projection).collectTrustedImportMetadata(originalRevisionId)
}
function getTrustedImportMetadata(state, head) {
  const allowed = [
    MUTATION_OPERATIONS.PACKAGE_IMPORT,
    MUTATION_OPERATIONS.PROJECTION_SAVE,
    MUTATION_OPERATIONS.VALIDATED_EDITED_EXPORT,
  ]
  // Receipts retained for history/templates are not authority for a replacement.
  // Follow package-producing journal edges, not the sidecar's untrusted binding.
  const lineage = new Set([head.originalRevisionId, head.packageRevisionId])
  const results = state.mutationResults || []
  let expanded = true
  while (expanded) {
    expanded = false
    for (const result of results) {
      if (
        result.presentationId !== head.presentationId ||
        result.state !== 'committed' ||
        (result.operation !== undefined &&
          result.operation !== MUTATION_OPERATIONS.VALIDATED_EDITED_EXPORT) ||
        !lineage.has(result.packageRevisionId) ||
        !result.journal?.baseRevisionId ||
        lineage.has(result.journal.baseRevisionId)
      )
        continue
      lineage.add(result.journal.baseRevisionId)
      expanded = true
    }
  }
  for (let index = (state.mutationResults || []).length - 1; index >= 0; index -= 1) {
    const result = state.mutationResults[index]
    if (
      result.presentationId !== head.presentationId ||
      !lineage.has(result.packageRevisionId) ||
      result.trustedImportMetadata === undefined ||
      (result.operation !== undefined && !allowed.includes(result.operation))
    )
      continue
    return validateTrustedImportMetadata(result.trustedImportMetadata, head.originalRevisionId)
  }
  return undefined
}
function decorateTrustedImportMetadata(projection, sidecar) {
  if (sidecar === undefined) return projection
  const trusted = validateTrustedImportMetadata(sidecar, sidecar.originalRevisionId)
  if (!trusted?.elements?.length) return projection
  const result = structuredClone(projection)
  const entries = new Map(
    (trusted?.elements || []).map((entry) => [
      keyFor(entry.slideId, entry.elementId, entry.type),
      entry,
    ])
  )
  visitSlides(result.slides, (element, slideId) => {
    delete element._pptxImportMeta
    const entry = entries.get(keyFor(slideId, element.id, element.type))
    if (!entry) return
    const changed = PPTX_FIT_INVALIDATING_KEYS.some(
      (key) => !Object.is(element[key], entry.fitBaseline[key])
    )
    element._pptxImportMeta = changed
      ? prunePptxFitMetadata(entry.metadata)
      : structuredClone(entry.metadata)
  })
  return result
}
module.exports = {
  collectTrustedImportMetadata,
  prepareTrustedImportProjection,
  validateTrustedImportMetadata,
  getTrustedImportMetadata,
  decorateTrustedImportMetadata,
}

const { featureMatrixHash, getFeatureRow } = require('./canonical-feature-matrix')

const BLOCK = 'unsupported-blocking'
const PRESERVE = 'preserve-only'
const NATIVE = 'native-metadata'
const MATRIX_HASH = featureMatrixHash()

function tier(rowId, importMode, editedExport) {
  const row = getFeatureRow(rowId)
  if (!row) throw new Error(`Missing canonical complex-object row: ${rowId}`)
  return Object.freeze({
    rowId: row.id,
    tier: row.tier,
    claimCeiling: row.claimCeiling,
    matrixHash: MATRIX_HASH,
    import: importMode,
    editedExport,
    originalRecovery: 'exact',
  })
}

const COMPLEX_OBJECT_TIERS = Object.freeze({
  smartArt: tier('complex.smartart.diagram', PRESERVE, PRESERVE),
  equation: tier('complex.equation.ooxml', PRESERVE, PRESERVE),
  ole: tier('complex.ole.embedded-object', PRESERVE, BLOCK),
  activeX: tier('complex.activex.control', PRESERVE, BLOCK),
  macro: tier('complex.vba.macro', PRESERVE, BLOCK),
  signature: tier('complex.digital-signature', PRESERVE, BLOCK),
  encryption: tier('complex.encrypted-protected-package', BLOCK, BLOCK),
  protection: tier('complex.encrypted-protected-package', PRESERVE, BLOCK),
  externalMedia: tier('complex.external-media-link', NATIVE, PRESERVE),
  vector: tier('complex.vector.svg-emf-wmf', NATIVE, PRESERVE),
  '3d': tier('complex.model-3d', PRESERVE, PRESERVE),
  zoom: tier('presentation.zoom-navigation', PRESERVE, PRESERVE),
  comments: tier('presentation.comments', NATIVE, PRESERVE),
  ink: tier('complex.ink.annotations', PRESERVE, PRESERVE),
  icons: tier('complex.icons.asset', PRESERVE, PRESERVE),
  custom: tier('complex.custom-xml.data', PRESERVE, PRESERVE),
  unknown: tier('complex.unknown-content', BLOCK, BLOCK),
})

const FLAG_KIND = {
  macro: 'macro',
  ole: 'ole',
  activeX: 'activeX',
  signature: 'signature',
  'encrypted-entry': 'encryption',
  'protected-content': 'protection',
}

const REL_KIND = [
  [/\/diagram(?:Data|Layout|QuickStyle|Colors)?$/i, 'smartArt'],
  [/\/(?:video|audio|media)$/i, 'externalMedia'],
  [/\/comments?$/i, 'comments'],
  [/\/ink$/i, 'ink'],
  [/\/zoom$/i, 'zoom'],
]

function relationshipKind(type) {
  const kind = REL_KIND.find(([pattern]) => pattern.test(type || ''))?.[1]
  if (kind) return kind
  if (/\/(?:officeDocument|slide|slideLayout|slideMaster|theme|notesSlide|notesMaster|image|hyperlink|chart|package|styles|presProps|viewProps|tableStyles|core-properties|extended-properties)$/i.test(type || '')) {
    return null
  }
  return 'unknown'
}

function partKind(part) {
  if (COMPLEX_OBJECT_TIERS[part.classification]) return part.classification
  const path = part.path || ''
  if (/^ppt\/diagrams\//i.test(path)) return 'smartArt'
  if (/\/(?:equation|math)|\.mml$/i.test(path)) return 'equation'
  if (/\.(?:emf|wmf|svg)$/i.test(path)) return 'vector'
  if (/^ppt\/(?:ink|drawings)\//i.test(path)) return 'ink'
  if (/^ppt\/icons\//i.test(path)) return 'icons'
  if (/^ppt\/customXml\/|^customXml\//i.test(path)) return 'custom'
  if (/^ppt\/3dmodels\//i.test(path)) return '3d'
  return null
}

function descriptor(kind, source) {
  return {
    kind,
    ...COMPLEX_OBJECT_TIERS[kind],
    source,
    preview: { embeddedFallbackOnly: true, available: false },
  }
}

function describeComplexObjects(manifest) {
  if (manifest?.safetyVerdict !== 'safe') {
    throw new Error('Raw ZIP/XML safety verdict is required before complex object inspection')
  }
  const objects = []
  for (const part of manifest.parts || []) {
    const kind = partKind(part)
    if (kind) objects.push(descriptor(kind, { partPath: part.path }))
  }
  for (const flag of manifest.securityFlags || []) {
    const kind = FLAG_KIND[flag]
    if (kind && !objects.some((item) => item.kind === kind)) {
      objects.push(descriptor(kind, { securityFlag: flag }))
    }
  }
  for (const relationship of manifest.relationships || []) {
    const kind = relationshipKind(relationship.type)
    if (!kind) continue
    const source = {
      relationshipSource: relationship.source,
      relationshipType: relationship.type,
    }
    if (relationship.external) source.externalTarget = relationship.target
    objects.push(descriptor(kind, source))
  }
  const hasUnsafeImpact = objects.some((item) => item.editedExport === BLOCK)
  return {
    objects,
    editedExport: hasUnsafeImpact ? BLOCK : PRESERVE,
    originalRecovery: 'exact',
    hasUnsafeImpact,
  }
}

function toSafeCapabilitySummary(value) {
  return {
    editedExport: value.editedExport,
    originalRecovery: value.originalRecovery,
    hasUnsupportedObjects: value.objects.length > 0,
    hasUnsafeImpact: value.hasUnsafeImpact,
    kinds: [...new Set(value.objects.map((item) => item.kind))].sort(),
    rowIds: [...new Set(value.objects.map((item) => item.rowId))].sort(),
    tiers: [...new Set(value.objects.map((item) => item.tier))].sort(),
    matrixHash: MATRIX_HASH,
  }
}

module.exports = { COMPLEX_OBJECT_TIERS, describeComplexObjects, toSafeCapabilitySummary }

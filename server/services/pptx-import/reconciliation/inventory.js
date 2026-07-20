const INVENTORY_VERSION = 1
const SOURCES = new Set(['native', 'officecli'])

function string(value, label, optional = false) {
  if (optional && value == null) return null
  if (typeof value !== 'string' || !value) throw new TypeError(`Invalid ${label}`)
  return value
}

function array(value, label) {
  if (!Array.isArray(value)) throw new TypeError(`Invalid ${label}`)
  return structuredClone(value)
}

function normalizeObject(input, source, slidePart, index) {
  if (!input || typeof input !== 'object') throw new TypeError('Invalid inventory object')
  const lineage = input.lineage || {}
  const transform = input.transform == null ? null : structuredClone(input.transform)
  return {
    key: input.key || `${slidePart}#${input.nativeId || `z${index}`}`,
    slidePart,
    kind: string(input.kind, 'object kind'),
    nativeId: string(input.nativeId, 'native id', true),
    name: string(input.name, 'object name', true),
    ancestry: array(input.ancestry || [], 'object ancestry').map(String),
    zOrder: Number.isSafeInteger(input.zOrder) ? input.zOrder : index,
    transform,
    rawTransform: input.rawTransform == null ? null : structuredClone(input.rawTransform),
    text: input.text == null ? null : structuredClone(input.text),
    style: input.style == null ? null : structuredClone(input.style),
    placeholder: input.placeholder == null ? null : structuredClone(input.placeholder),
    relationships: array(input.relationships || [], 'relationships'),
    dependentParts: array(input.dependentParts || [], 'dependent parts'),
    unknown: input.unknown == null ? null : structuredClone(input.unknown),
    editabilityTier: input.editabilityTier || 'preserve',
    lineage: {
      source,
      method: lineage.method || (source === 'native' ? 'scene-graph' : 'typed-gateway'),
      confidence: Number.isFinite(lineage.confidence) ? lineage.confidence : 1,
      warnings: array(lineage.warnings || [], 'lineage warnings'),
      evidence: array(lineage.evidence || [], 'lineage evidence'),
    },
  }
}

function normalizeSlide(slide, source) {
  const part = string(slide?.part, 'slide part')
  return {
    part,
    index: Number.isSafeInteger(slide.index) ? slide.index : 0,
    size: slide.size == null ? null : structuredClone(slide.size),
    inheritance: slide.inheritance == null ? null : structuredClone(slide.inheritance),
    relationships: array(slide.relationships || [], 'slide relationships'),
    objects: array(slide.objects || [], 'slide objects')
      .map((object, index) => normalizeObject(object, source, part, index)),
  }
}

function createInventory(input) {
  if (!SOURCES.has(input?.source)) throw new TypeError('Invalid inventory source')
  const inventory = {
    schemaVersion: INVENTORY_VERSION,
    source: input.source,
    revisionId: input.revisionId || null,
    package: {
      size: input.package?.size || null,
      layoutParts: array(input.package?.layoutParts || [], 'layout parts'),
      masterParts: array(input.package?.masterParts || [], 'master parts'),
      themeParts: array(input.package?.themeParts || [], 'theme parts'),
      dependentParts: array(input.package?.dependentParts || [], 'package dependent parts'),
    },
    slides: array(input.slides || [], 'slides').map((slide) => normalizeSlide(slide, input.source)),
    capability: input.capability == null ? null : structuredClone(input.capability),
    warnings: array(input.warnings || [], 'inventory warnings'),
  }
  return Object.freeze(inventory)
}

module.exports = { INVENTORY_VERSION, createInventory }

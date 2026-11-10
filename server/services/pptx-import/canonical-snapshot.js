const { sanitizePptxGeometryMetadata } = require('revealjs-shared/src/shared-pptx-core.js')
const {
  normalizeSemanticPresentation,
} = require('revealjs-shared/src/pptx-semantic-presentation.js')
const { normalizePptxSemanticDocument } = require('revealjs-shared/src/pptx-semantic-document.js')
const { normalizeChartDocument } = require('revealjs-shared/src/pptx-chart-document.js')
const { normalizeOmmlDocument } = require('revealjs-shared/src/pptx-omml-document.js')
const { normalizeTableDocument } = require('revealjs-shared/src/pptx-table-document.js')
const { normalizeSmartArtDocument } = require('revealjs-shared/src/pptx-smartart-document.js')
const {
  semanticDefinition,
  semanticInstance,
} = require('revealjs-shared/src/pptx-semantic-records.js')
const { isDeepStrictEqual } = require('node:util')

const INTERNAL_KEYS = new Set([
  'sourceRef',
  'sourceMap',
  'sourceMapRevisionId',
  'packageRevisionId',
  'journal',
  'journalRevisionId',
  'pendingJournalHash',
  'originalPath',
  'packagePath',
  'pptxOriginal',
  'pptxAggregateHead',
  'aggregateGeneration',
  'idempotencyKey',
  'trustedImportMetadata',
])
const DEFAULTS = Object.freeze({
  maxSlides: 500,
  maxElements: 20000,
  maxDepth: 16,
  maxObjectKeys: 100000,
  maxStringBytes: 8 * 1024 * 1024,
  maxSnapshotBytes: 50 * 1024 * 1024,
})

function budgetError(message) {
  const error = new RangeError(`Snapshot budget exceeded: ${message}`)
  error.code = 'SNAPSHOT_BUDGET_EXCEEDED'
  return error
}

function assertSnapshotBudget(snapshot, limits = {}) {
  return checkSnapshotBudget(snapshot, limits, normalizePptxSemanticDocument)
}

function checkSnapshotBudget(snapshot, limits, normalizeSemantic) {
  const budget = { ...DEFAULTS, ...limits }
  let elements = 0
  let stringBytes = 0
  let objectKeys = 0
  let semantic
  const visit = (value, depth, key, typedSemantic = false, role = '', slideId, typedGraph = false) => {
    if (!typedSemantic && depth > budget.maxDepth) throw budgetError('nesting')
    if (typeof value === 'string') {
      stringBytes += Buffer.byteLength(value)
      if (stringBytes > budget.maxStringBytes) throw budgetError('strings')
      return
    }
    if (!value || typeof value !== 'object') return
    if (!typedGraph) {
      objectKeys += Object.keys(value).length
      if (objectKeys > budget.maxObjectKeys) throw budgetError('passthrough properties')
    }
    if (key === 'elements') {
      elements += Array.isArray(value) ? value.length : 0
      if (elements > budget.maxElements) throw budgetError('elements')
    }
    for (const [childKey, child] of Object.entries(value)) {
      if (depth === 0 && childKey === 'pptxSemantic' && child !== undefined) {
        // Schema three structural complexity is bounded by its validated graph
        // contract, not the passthrough key budget. Strings, elements and final
        // encoded bytes still include it; legacy schemas retain key accounting.
        visit(semantic, depth + 1, childKey, true, '', undefined, semantic.schemaVersion === 3)
      } else {
        const isChartChild = childKey === 'chartDocument' && role === 'element' && Boolean(value?.pptxInstanceId)
        const isOmmlChild = childKey === 'ommlDocument' && role === 'element' && Boolean(value?.pptxInstanceId)
        const isTableChild = childKey === 'tableDocument' && role === 'element' && Boolean(value?.pptxInstanceId)
        const isSmartArtChild = childKey === 'smartArtDocument' && role === 'element' && Boolean(value?.pptxInstanceId)
        const instance = isChartChild || isOmmlChild || isTableChild || isSmartArtChild
          ? semanticInstance(semantic, value.pptxInstanceId)
          : null
        const definition = instance ? semanticDefinition(semantic, instance.definitionId) : null
        if (instance && instance.slideId !== slideId) {
          throw new TypeError('Semantic element occurrence references another slide')
        }
        if (
          childKey === 'chartDocument' &&
          instance &&
          instance?.slideId === slideId &&
          definition?.kind === 'chart' &&
          definition?.origin !== 'project' &&
          definition?.content?.chartDocument
        ) {
          const chart = normalizeChartDocument(child)
          if (!isDeepStrictEqual(chart.source, definition.content.chartDocument.source))
            throw new TypeError('Chart compatibility source differs from its semantic owner')
          // This generated copy has the chart contract's structural bounds.
          // Count its raw contents, not a replacement or a sanitized projection.
          visit(child, depth + 1, childKey, true)
        } else if (
          childKey === 'ommlDocument' &&
          instance &&
          instance?.slideId === slideId &&
          definition?.kind === 'equation' &&
          definition?.content?.ommlDocument
        ) {
          normalizeOmmlDocument(child)
          visit(child, depth + 1, childKey, true)
        } else if (
          childKey === 'tableDocument' &&
          instance &&
          instance?.slideId === slideId &&
          definition?.kind === 'table' &&
          definition?.content?.tableDocument &&
          child?.componentId === definition.content.tableDocument.componentId
        ) {
          normalizeTableDocument(child)
          visit(child, depth + 1, childKey, true)
        } else if (
          childKey === 'smartArtDocument' &&
          instance &&
          instance?.slideId === slideId &&
          definition?.kind === 'diagram' &&
          definition?.content?.smartArtDocument &&
          child?.componentId === definition.content.smartArtDocument.componentId
        ) {
          normalizeSmartArtDocument(child)
          visit(child, depth + 1, childKey, true)
        } else {
          const nextRole =
            (role === 'root' && childKey === 'slides') ||
            (role === 'slide' && childKey === 'children')
              ? 'slides'
              : role === 'slides' && Array.isArray(value)
                ? 'slide'
                : role === 'slide' && childKey === 'elements'
                  ? 'elements'
                  : role === 'elements' && Array.isArray(value)
                    ? 'element'
                    : ''
          visit(
            child,
            depth + 1,
            childKey,
            typedSemantic,
            nextRole,
            role === 'slide' ? value.id : slideId,
            typedGraph
          )
        }
      }
    }
  }
  if (!Array.isArray(snapshot?.slides)) throw new TypeError('Editable snapshot requires slides')
  if (snapshot.slides.length > budget.maxSlides) throw budgetError('slides')
  // Validate authority once before inspecting any derived slide copies,
  // regardless of the envelope's property order.
  if (snapshot.pptxSemantic !== undefined) semantic = normalizeSemantic(snapshot.pptxSemantic)
  // Publication retains root publication properties even when the caller hides them.
  // Keep raw metadata charged while accounting retained publication properties once.
  const slidesHidden = !Object.prototype.propertyIsEnumerable.call(snapshot, 'slides')
  const semanticHidden = Boolean(
    semantic && !Object.prototype.propertyIsEnumerable.call(snapshot, 'pptxSemantic')
  )
  const accountedSnapshot =
    slidesHidden || semanticHidden
      ? {
          ...snapshot,
          ...(slidesHidden ? { slides: snapshot.slides } : {}),
          ...(semanticHidden ? { pptxSemantic: semantic } : {}),
        }
      : snapshot
  visit(accountedSnapshot, 0, '', false, 'root')
  const encodedBytes = Buffer.byteLength(JSON.stringify(accountedSnapshot))
  if (encodedBytes > budget.maxSnapshotBytes) throw budgetError('aggregate bytes')
  return encodedBytes
}

function isInternal(key) {
  return (
    /^_pptx/i.test(key) ||
    INTERNAL_KEYS.has(key) ||
    /^(?:source|package|journal)(?:Authority|Path)$/.test(key)
  )
}

function sanitize(value, isRoot = true) {
  if (Array.isArray(value)) return value.map((child) => sanitize(child, false))
  if (!value || typeof value !== 'object') return value
  const entries = []
  for (const [key, child] of Object.entries(value)) {
    if (key === 'pptxSemantic' && isRoot) {
      entries.push([key, child])
    } else if (key === '_pptxMeta') {
      const metadata = sanitizePptxGeometryMetadata(child)
      // Legacy projections excluded import metadata; retain their hash when the editor echoes it.
      if (metadata.geometryPolicy === 'native-aspect-v1') entries.push([key, metadata])
    } else if (child !== undefined && !isInternal(key)) {
      entries.push([key, sanitize(child, false)])
    }
  }
  return Object.fromEntries(entries)
}

function buildCanonicalSnapshot(snapshot, limits) {
  let normalized = snapshot
  checkSnapshotBudget(snapshot, limits, () => {
    normalized = normalizeSemanticPresentation(snapshot)
    return normalized.pptxSemantic
  })
  const root = structuredClone(
    normalized === snapshot ? normalizeSemanticPresentation(snapshot) : normalized
  )
  for (const key of ['createdAt', 'updatedAt', 'deletedAt']) delete root[key]
  return { snapshot: sanitize(root), semantic: normalized.pptxSemantic }
}

function canonicalEditableSnapshot(snapshot, limits) {
  return buildCanonicalSnapshot(snapshot, limits).snapshot
}

class CanonicalOutputBudgetError extends Error {
  constructor(cause) {
    super(cause.message, { cause })
  }
}

function canonicalEditableSnapshotWithOutputBudget(snapshot, limits) {
  const built = buildCanonicalSnapshot(snapshot, limits)
  // The semantic output is an exact isolated clone of this certified graph.
  // Reuse its validation only synchronously, before the mutable output escapes;
  // all materialized output bytes, depth and element budgets are still charged.
  try {
    checkSnapshotBudget(built.snapshot, limits, () => built.semantic)
  } catch (error) {
    throw new CanonicalOutputBudgetError(error)
  }
  return built.snapshot
}

module.exports = {
  assertSnapshotBudget,
  canonicalEditableSnapshot,
  canonicalEditableSnapshotWithOutputBudget,
  CanonicalOutputBudgetError,
}

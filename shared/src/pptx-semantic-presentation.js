const {
  normalizePptxSemanticDocument,
  PptxSemanticValidationError,
} = require('./pptx-semantic-document.js')
const { assertProjectionChartBinding } = require('./pptx-projection-capabilities.js')
const { geometryCompatibilityElement, materializeGeometry } = require('./pptx-geometry-style-resolution.js')
const { familyCompatibilityElement } = require('./pptx-family-operations.js')
const { pictureCompatibilityElement } = require('./pptx-picture-operations.js')
const { mediaCompatibilityElement } = require('./pptx-media-document.js')
const { normalizeSourceTiming, validateTimingDefinition, timingDefinitions } = require('./pptx-timing-document.js')
const { pictureAsset, occurrencePictureReplacement } = require('./pptx-picture-replacement.js')
const {
  geometryEffectOverlayCompatibilityElement,
} = require('./pptx-geometry-effect-overlay-assets.js')
const {
  semanticDefinition,
  semanticDefinitions,
  semanticInstance,
  semanticInstances,
} = require('./pptx-semantic-records.js')

function normalizeSemanticPresentation(presentation) {
  if (presentation.pptxSemantic === undefined) return presentation
  const document = normalizePptxSemanticDocument(presentation.pptxSemantic)
  for (const [, definition] of semanticDefinitions(document)) validateTimingDefinition(definition)
  // checks every slide/occurrence before publication.
  if (presentation.slides === undefined) return { ...presentation, pptxSemantic: document }
  const slides = new Set()
  const linked = new Set()
  function fail(message) {
    throw new PptxSemanticValidationError(message)
  }
  function visit(items) {
    for (const slide of items) {
      if (!slide.id || slides.has(slide.id)) fail('Invalid semantic slide identity')
      slides.add(slide.id)
      for (const element of slide.elements || []) {
        if (element.pptxInstanceId === undefined) continue
        const instance = semanticInstance(document, element.pptxInstanceId)
        if (
          !instance ||
          instance.slideId !== slide.id ||
          linked.has(instance.id) ||
          instance.lineage?.tombstone === true ||
          semanticDefinition(document, instance.definitionId)?.kind === 'group'
        )
          fail('Invalid semantic element occurrence')
        const definition = semanticDefinition(document, instance.definitionId)
        if (definition?.kind === 'chart' && definition.content.chartProjection !== undefined) {
          try {
            assertProjectionChartBinding(document, element)
          } catch (error) {
            fail(error.message)
          }
        }
        const replacement = definition.content.pictureDocument
          ? occurrencePictureReplacement(definition, instance) : null
        // Partial PUT bodies may omit id; the publication boundary supplies the
        // authoritative route identity before uploaded-byte authorization.
        if (replacement && presentation.id !== undefined && replacement.presentationId !== presentation.id)
          fail('Picture replacement belongs to another presentation')
        const media = definition.content.pictureDocument
          ? pictureAsset(definition, instance) : instance.overrides.media ?? definition.content.media
        if (
          definition.kind === 'image' &&
          media &&
          (typeof media.src !== 'string' || !media.src.length || element.src !== media.src)
        )
          fail('Semantic image media binding differs from its projection')
        linked.add(instance.id)
      }
      visit(slide.children || [])
    }
  }
  visit(presentation.slides)
  for (const [, instance] of semanticInstances(document)) {
    if (instance.lineage?.tombstone === true) continue
    if (!slides.has(instance.slideId)) fail('Semantic occurrence references an unknown slide')
    if (instance.parentInstanceId !== null) {
      const parent = semanticInstance(document, instance.parentInstanceId)
      if (
        !parent ||
        parent.lineage?.tombstone === true ||
        semanticDefinition(document, parent.definitionId)?.kind !== 'group'
      )
        fail('Invalid semantic container parent')
    }
    const definition = semanticDefinition(document, instance.definitionId)
    const preserved =
      definition?.kind === 'opaque' &&
      Array.isArray(definition.content.excludedObjects) &&
      definition.content.excludedObjects.length > 0
    if (definition?.kind !== 'group' && !preserved && !linked.has(instance.id))
      fail('Missing semantic element occurrence')
  }
  function project(items) {
    return items.map((slide) => ({
      ...slide,
      ...(slide.sourceTimingDefinitionIds !== undefined
        ? { sourceTimingDefinitionIds: timingDefinitions(document, slide).map(definition => definition.id) }
        : {}),
      ...(slide.sourceTiming !== undefined
        ? { sourceTiming: normalizeSourceTiming(document, slide) }
        : {}),
      elements: (slide.elements || []).map((element) => {
        const geometry = document.schemaVersion === 2 && element.pptxInstanceId
          ? materializeGeometry(document, element.pptxInstanceId) : undefined
        return mediaCompatibilityElement(document, pictureCompatibilityElement(
          document,
          familyCompatibilityElement(
            document,
            document.schemaVersion === 2
              ? geometryEffectOverlayCompatibilityElement(
                  document,
                  geometryCompatibilityElement(document, element, geometry),
                  geometry
                )
              : element
          )
        ))
      }),
      ...(slide.children ? { children: project(slide.children) } : {}),
    }))
  }
  return {
    ...presentation,
    slides: project(presentation.slides),
    pptxSemantic: document,
  }
}

module.exports = { normalizeSemanticPresentation }

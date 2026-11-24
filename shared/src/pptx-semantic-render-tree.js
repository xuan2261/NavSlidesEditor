const {
  semanticDefinition,
  semanticInstance,
  semanticStyle,
  isCertifiedSemanticDocument,
} = require('./pptx-semantic-records.js')

const { createSemanticInstanceReader } = require('./pptx-semantic-groups.js')
const { transformPoint, multiply, IDENTITY } = require('./pptx-affine.js')
const { semanticGroupPaint } = require('./pptx-semantic-paint.js')
const { familyDescriptor, familyCompatibilityElement } = require('./pptx-family-operations.js')
const { pictureCompatibilityElement } = require('./pptx-picture-operations.js')
const { mediaCompatibilityElement } = require('./pptx-media-document.js')
const { geometryStrokePaint, geometryFillPaint } = require('./pptx-geometry-document.js')
const { deriveConnectorGeometry } = require('./pptx-semantic-connectors.js')
const { geometryProvider } = require('./pptx-geometry-style-records.js')
const {
  geometryEffectOverlayCompatibilityElement,
} = require('./pptx-geometry-effect-overlay-assets.js')
const {
  materializeGeometry,
  geometryLocalExtent,
  geometryFillFrame,
} = require('./pptx-geometry-style-resolution.js')
const { materializeTextDocument, materializeTextTheme } = require('./pptx-text-materialization.js')

const EMU_TO_CSS = 96 / 914400
function semanticCssMatrix(matrix) {
  transformPoint(matrix, { x: 0, y: 0 })
  return `matrix(${[...matrix.slice(0, 4), matrix[4] * EMU_TO_CSS, matrix[5] * EMU_TO_CSS].join(',')})`
}
const { slideProjections, projectionEnvelope, sameEnvelope, ownImmutable } = require('./pptx-slide-projection-cache.js')
function renderTree(input, slide, fieldContext, immutable) {
  const reader = createSemanticInstanceReader(input)
  const document = reader.document
  // Normalization (and its budget/validation receipts) always precedes lookup.
  // Raw or shallow-frozen inputs cannot admit a render-cache entry.
  const envelope = isCertifiedSemanticDocument(input)
    ? projectionEnvelope(document, slide, fieldContext) : null
  // Admission and projection must consume the same values. A proxy can expose
  // different descriptor and get views; never render/cache its live get view.
  if (envelope) slide = envelope.snapshot
  const previous = envelope && slideProjections.get(slide.id)
  if (previous && sameEnvelope(previous.envelope, envelope))
    return immutable ? previous.result : structuredClone(previous.result)
  const elements = new Map()
  const legacy = []
  for (const element of slide.elements || []) {
    if (!element.pptxInstanceId) {
      legacy.push({ element, children: [], paintIndex: element.zIndex || 0 })
      continue
    }
    const instance = semanticInstance(document, element.pptxInstanceId) ?? document.instances?.[element.pptxInstanceId]
    if (!instance || instance.slideId !== slide.id || elements.has(instance.id))
      throw new TypeError('Invalid or duplicate semantic render occurrence')
    elements.set(instance.id, element)
  }
  const consumed = new Set()
  function project(node, parentTransform = IDENTITY) {
    const worldTransform = multiply(parentTransform, node.localTransform)
    const instance = semanticInstance(document, node.instanceId) ?? document.instances?.[node.instanceId]
    const definition = semanticDefinition(document, node.definitionId) ?? document.definitions?.[node.definitionId]
    const element = elements.get(node.instanceId)
    const family = familyDescriptor(definition)
    const textDocument = materializeTextDocument(document, instance.id, fieldContext)
    const textTheme = textDocument?.paragraphs.some((p) => p.runs.some((r) => r.kind === 'equation'))
      ? materializeTextTheme(document, instance.id) : undefined
    const preserved =
      node.kind === 'opaque' &&
      Array.isArray(definition.content.excludedObjects) &&
      definition.content.excludedObjects.length > 0
    if (node.kind !== 'group' && node.children.length)
      throw new TypeError('Non-container semantic instance has descendants')
    if (node.kind !== 'group' && !preserved && !element)
      throw new TypeError('Missing semantic render leaf')
    if (element) consumed.add(node.instanceId)
    const hidden =
      instance.overrides.hidden ??
      instance.hidden ??
      definition.content.hidden ??
      element?.hidden ??
      false
    const baseline = geometryProvider(document, instance).geometry
    const geometry =
      baseline?.connector !== undefined
        ? deriveConnectorGeometry(document, instance.id)
        : materializeGeometry(document, instance.id)
    const fillFrame =
      (document.schemaVersion === 2 || document.schemaVersion === 3) && geometry
        ? geometryFillFrame(document, instance.id)
        : undefined
    const blipBindingId = geometry?.style?.fill?.blip?.bindingId
    const blipStyle = blipBindingId
      ? semanticStyle(document, blipBindingId) ?? document.styles?.[blipBindingId]
      : undefined
    return {
      ...node,
      paintOnly: instance.lineage?.paintOnly === true,
      opacity: node.kind === 'group' ? semanticGroupPaint(definition, instance).opacity : 1,
      hidden: preserved || hidden,
      family: family ? { name: family[0], extent: definition.content.extent } : null,
      element:
        element && definition.content.pictureDocument
          ? {
              ...pictureCompatibilityElement(document, element),
              width: geometry.width * EMU_TO_CSS,
              height: geometry.height * EMU_TO_CSS,
            }
          : element && family
            ? familyCompatibilityElement(document, element)
            : element && definition.kind === 'shape' && geometry?.schemaVersion === 1
              ? {
                  ...geometryEffectOverlayCompatibilityElement(document, element, geometry),
                  ...((document.schemaVersion === 2 || document.schemaVersion === 3)
                    ? {
                        width: geometryLocalExtent(document, instance.id).cx * EMU_TO_CSS,
                        height: geometryLocalExtent(document, instance.id).cy * EMU_TO_CSS,
                      }
                    : {}),
                  ...geometryStrokePaint(geometry),
                  ...geometryFillPaint(geometry),
                  pptxGeometry: geometry,
                  ...(fillFrame ? { pptxFillFrame: fillFrame } : {}),
                  ...(geometry.style?.fill?.blip
                    ? {
                        pptxBlipAsset: blipStyle?.payload?.asset,
                        ...(blipStyle?.payload?.derivedAssets
                          ? { pptxBlipDerivedAssets: blipStyle.payload.derivedAssets }
                          : {}),
                      }
                    : {}),
                  ...(textDocument ? { pptxTextDocument: textDocument,
                    ...(textTheme ? { pptxTextTheme: textTheme } : {}) } : {}),
                  pptxOccurrenceMatrix: worldTransform,
                  ...(instance.connectorBindings
                    ? { pptxConnectorBindings: instance.connectorBindings }
                    : {}),
                }
              : element && textDocument
                ? { ...element, pptxTextDocument: textDocument,
                  ...(textTheme ? { pptxTextTheme: textTheme } : {}) }
                : element && mediaCompatibilityElement(document, element),
      transform: semanticCssMatrix(node.localTransform),
      children: node.children.map((child) => project(child, worldTransform)),
    }
  }
  const roots = reader.semanticInstanceTree(slide.id).map((node) => project(node))
  for (const id of elements.keys()) {
    const inst = semanticInstance(document, id) ?? document.instances?.[id]
    if (!consumed.has(id) && inst?.lineage?.tombstone !== true)
      throw new TypeError('Unrendered semantic occurrence')
  }
  const result = [...roots, ...legacy].sort((left, right) => left.paintIndex - right.paintIndex)
  if (envelope) {
    // Only an owned clone is frozen; never freeze caller slide/legacy values.
    const owned = ownImmutable(result)
    slideProjections.delete(slide.id)
    slideProjections.set(slide.id, { envelope, result: owned })
    if (slideProjections.size > 128) slideProjections.delete(slideProjections.keys().next().value)
    return immutable ? owned : structuredClone(owned)
  }
  return immutable ? ownImmutable(result) : result
}
// Public API retains caller-owned mutable outputs. Internal consumers explicitly
// opt into recursively frozen owned values, never mutable-input identity reuse.
function semanticRenderTree(input, slide, fieldContext) {
  return renderTree(input, slide, fieldContext, false)
}
function immutableSemanticRenderTree(input, slide, fieldContext) {
  return renderTree(input, slide, fieldContext, true)
}
function semanticLocalElement(element) {
  return { ...element, x: 0, y: 0, rotation: 0, flipH: false, flipV: false }
}
module.exports = { EMU_TO_CSS, semanticCssMatrix, semanticRenderTree, immutableSemanticRenderTree, semanticLocalElement }

const { cloneTextData } = require('./pptx-text-document')
const { materializeTextDocument, materializeTextTheme } = require('./pptx-text-materialization')
const { materializeGeometry, geometryLocalExtent } = require('./pptx-geometry-style-resolution')
const { shapeLabelSvgString } = require('./pptx-shape-label')
const {
  semanticDefinition,
  semanticInstance,
} = require('./pptx-semantic-records')

// Text labels use the existing semantic output lifecycle, but mount inside the
// already painted SVG. This never replaces a shape's paths, paint or transform.
function createTextOutputMount(element, slide, fieldContext) {
  const mount = { instanceId: element.pptxInstanceId, slideId: slide.id, kind: 'text', type: element.type }
  if (fieldContext) {
    const context = Object.fromEntries(Object.entries(fieldContext)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value]))
    if (Object.keys(context).length) mount.fieldContext = cloneTextData(context)
  }
  return mount
}

function renderSemanticTextOutput(semantic, mount, fontRuntime, hyperlinkPresentation) {
  const instance = semanticInstance(semantic, mount.instanceId)
  const definition = semanticDefinition(semantic, instance?.definitionId)
  const location = { instanceId: mount.instanceId, slideId: mount.slideId,
    componentId: definition?.content?.textDocument?.componentId,
    part: definition?.source?.partUri, path: 'content.textDocument' }
  const fail = (code) => Object.assign(new TypeError(`Canonical text output unavailable: ${code}`), { code, ...location })
  if (mount.kind !== 'text' || !['text', 'shape'].includes(mount.type) ||
      instance?.slideId !== mount.slideId || instance.lineage?.tombstone || !definition?.content?.textDocument)
    throw fail('semantic-output-text-mount')
  if (!fontRuntime) throw fail('browser-measurement-required')
  try {
    const extent = geometryLocalExtent(semantic, instance.id)
    if (!extent || ![extent.cx, extent.cy].every((value) => Number.isSafeInteger(value) && value > 0))
      throw fail('semantic-output-text-frame')
    const element = { width: extent.cx / 9525, height: extent.cy / 9525,
      pptxTextDocument: materializeTextDocument(semantic, instance.id, mount.fieldContext),
      ...(mount.type === 'shape' ? { pptxGeometry: materializeGeometry(semantic, instance.id) } : {}) }
    // No HTML/font fallback can be reported ready by a generated presentation.
    // Exact browser measurement is still not independent native qualification.
    return shapeLabelSvgString(element, { fontRuntime, hyperlinkPresentation, requireMeasuredText: true,
      theme: materializeTextTheme(semantic, instance.id) })
  } catch (error) {
    for (const [key, value] of Object.entries(location)) if (error[key] === undefined) error[key] = value
    throw error
  }
}
module.exports = { createTextOutputMount, renderSemanticTextOutput }

const { readGraphicFrame, finishFrame } = require('./semantic-frame-adapter')
const { readSemanticSmartArt } = require('./ooxml-semantic-smartart')
const D = new Set([
  'http://schemas.openxmlformats.org/drawingml/2006/diagram',
  'http://purl.oclc.org/ooxml/drawingml/diagram',
])

async function projectSmartArtFrame(context) {
  const s = readGraphicFrame(context)
  if (!D.has(s.attrs(s.payload, ['uri']).uri)) s.fail(s.payload, 'wrong diagram payload URI')
  s.children(s.payload, [[D, 'relIds']])
  const result = await readSemanticSmartArt(context)
  return {
    kind: 'diagram',
    content: {
      smartArtDocument: result.smartArtDocument,
      ...(result.drawingFallback ? { drawingFallback: result.drawingFallback } : {}),
      layoutStatus: result.layoutStatus,
      frameProperties: s.frameProperties,
      extent: s.extent,
    },
    components: [...result.components, ...s.metadata],
    extent: s.extent,
    sourceTransform: s.sourceTransform,
    localTransform: s.localTransform,
    compatibility: { type: 'diagram' },
    mappedDefinitionIds: finishFrame(s, result.mappedDefinitionIds),
  }
}
module.exports = { projectSmartArtFrame }

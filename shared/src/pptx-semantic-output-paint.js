const { familyDescriptor, materializeFamilyDocument } = require('./pptx-family-operations')
const { renderSemanticTable } = require('./pptx-table-renderer')
const { projectChartRender } = require('./pptx-chart-render')
const { renderSmartArtSvg } = require('./pptx-smartart-render')
const { createOmmlRuntime } = require('./pptx-omml-runtime')
const { materializeOmmlFrame } = require('./pptx-omml-source-style')
const { outputFailure } = require('./pptx-semantic-output-resources')
const { expandTextContext } = require('./pptx-semantic-text-context-codec')
const { renderSemanticTextOutput } = require('./pptx-text-output')
const {
  semanticDefinition,
  semanticInstance,
  semanticStyle,
} = require('./pptx-semantic-records')

function prepareSemanticOutputPaint(document, semantic, mounts, fontRuntime, hyperlinkPresentation) {
  const nodes = [...document.querySelectorAll('[data-pptx-semantic-mount]')]
  if (nodes.length !== mounts.length)
    throw outputFailure('semantic-output-mount', 'mount count changed')
  const painted = new Map()
  return nodes.map((node, index) => {
    const { instanceId, slideId } = mounts[index]
    const instance = semanticInstance(semantic, instanceId)
    const definition = semanticDefinition(semantic, instance?.definitionId)
    const descriptor = familyDescriptor(definition)
    const textMount = mounts[index].kind === 'text'
    const location = {
      instanceId,
      slideId,
      componentId: definition?.id,
      part: definition?.source?.partUri,
      path: 'content',
    }
    if (
      node.getAttribute('data-pptx-semantic-mount') !== instanceId ||
      node.getAttribute('data-pptx-semantic-slide') !== slideId ||
      instance?.slideId !== slideId ||
      (!descriptor && !textMount) ||
      instance.lineage?.tombstone
    )
      throw outputFailure('semantic-output-mount', 'invalid canonical mount', location)
    if (textMount) return { node, svg: renderSemanticTextOutput(
      semantic, mounts[index], fontRuntime, hyperlinkPresentation
    ) }
    if (!painted.has(instanceId)) {
      try {
        const extent = definition.content.extent
        if (!extent || extent.cx <= 0 || extent.cy <= 0)
          throw outputFailure('semantic-output-frame', 'source frame extent unavailable')
        const effective = materializeFamilyDocument(definition, instance)
        const contextStyle = instance.textSourceBinding?.contextId
          ? semanticStyle(semantic, instance.textSourceBinding.contextId)
          : undefined
        const payload = contextStyle?.payload
        const textContext = payload && (payload.schemaVersion === 1 ? payload : expandTextContext(payload, { styles: semantic.styles }))
        const theme = textContext?.theme
        const options = { ...fontRuntime, theme, hyperlinkPresentation }
        let svg
        switch (descriptor[0]) {
          case 'table':
            svg = renderSemanticTable(effective, options)
            break
          case 'chart': {
            const result = projectChartRender(effective, {
              width: extent.cx / 9525,
              height: extent.cy / 9525,
              fontRuntime,
              theme,
            })
            if (!result.supported || !result.svg)
              throw outputFailure('semantic-output-chart', 'source SVG chart unavailable', {
                issues: result.issues,
                detail: result.reasons,
              })
            svg = result.svg
            break
          }
          case 'smartart':
            svg = renderSmartArtSvg(
              effective,
              {
                x: 0,
                y: 0,
                width: extent.cx,
                height: extent.cy,
              },
              options
            )
            break
          case 'omml':
            svg = createOmmlRuntime({
              document,
              fontRuntime,
              theme,
              sourceStyle: true,
              mathFrame: materializeOmmlFrame(definition.content.mathFrame, textContext),
            }).render(effective).svg
            break
        }
        painted.set(instanceId, svg)
      } catch (error) {
        Object.assign(
          error,
          Object.fromEntries(Object.entries(location).filter(([key]) => error[key] === undefined))
        )
        throw error
      }
    }
    return { node, svg: painted.get(instanceId) }
  })
}
module.exports = { prepareSemanticOutputPaint }

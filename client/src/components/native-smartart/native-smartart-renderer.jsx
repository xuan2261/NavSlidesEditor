import smartArtRender from 'revealjs-shared/src/pptx-smartart-render.js'
import { usePptxSourceFonts } from '../../hooks/use-pptx-source-fonts'

const { createSmartArtRenderModel, renderSmartArtSvg } = smartArtRender

export function smartArtFailureMessage(error) {
  const location = error.sourceLocation
  return [error.message, error.componentId,
    location?.partUri, location?.path ? JSON.stringify(location.path) : '']
    .filter(Boolean).join(' - ')
}

// The native painter receives authored EMU bounds. A legacy renderNode caller
// owns its coordinate/paint contract and does not establish native fidelity.
export function NativeSmartArtRenderer({ document, bounds, renderNode, fontRuntime }) {
  const sourceFonts = usePptxSourceFonts()
  let model, nodes, svg
  try {
    if (typeof renderNode !== 'function') {
      svg = renderSmartArtSvg(document, bounds, fontRuntime ?? sourceFonts.fontRuntime ?? {})
    } else {
      model = createSmartArtRenderModel(document, bounds)
      nodes = model.nodes.map((node) => ({ node, content: renderNode(node, model) }))
    }
  } catch (error) {
    return <div role="alert" data-smartart-layout="unsupported">{smartArtFailureMessage(error)}</div>
  }
  if (svg !== undefined) return <div data-smartart-source-painter="native"
    style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: svg }} />
  return (
    <div role="group" aria-label="SmartArt" data-smartart-layout={model.layoutStatus}
      data-smartart-root={model.graphComponentId}
      style={{ position: 'relative', width: '100%', height: '100%' }}>
      {nodes.map(({ node, content }) => (
        <div key={node.componentId} data-smartart-point={node.componentId}
          data-smartart-model={node.modelId} data-smartart-shape={node.shapeType}
          data-smartart-style={node.styleLabel}
          style={{ position: 'absolute',
            left: `${((node.x - bounds.x) / bounds.width) * 100}%`,
            top: `${((node.y - bounds.y) / bounds.height) * 100}%`,
            width: `${(node.width / bounds.width) * 100}%`,
            height: `${(node.height / bounds.height) * 100}%` }}>
          {content}
        </div>
      ))}
    </div>
  )
}

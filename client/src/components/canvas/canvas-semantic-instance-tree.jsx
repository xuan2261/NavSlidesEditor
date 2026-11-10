import renderTree from 'revealjs-shared/src/pptx-semantic-render-tree.js'
import { semanticElement } from '../../utils/pptx-semantic-geometry-bridge'
import { semanticInstance, replaceSemanticRecords } from 'revealjs-shared/src/pptx-semantic-records.js'

export default function CanvasSemanticInstanceTree({ document, slide, preview, fieldContext, renderElement }) {
  if (!document)
    return (slide.elements || [])
      .filter((e) => !e.hidden)
      .slice()
      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
      .map(renderElement)
  let tree
  try {
    let previewPatch = null
    for (const element of slide.elements || []) {
      const transform = preview[element.id]?.semanticLocalTransform
      if (transform) {
        const inst = semanticInstance(document, element.pptxInstanceId)
        if (inst) {
          previewPatch ??= {}
          previewPatch[element.pptxInstanceId] = {
            ...inst,
            localTransform: transform,
          }
        }
      }
    }
    for (const [id, update] of Object.entries(preview)) {
      if (update.semanticLocalTransform) {
        const inst = semanticInstance(document, id)
        if (inst) {
          previewPatch ??= {}
          previewPatch[id] = { ...inst, localTransform: update.semanticLocalTransform }
        }
      }
    }
    const renderDoc = previewPatch ? replaceSemanticRecords(document, { instances: previewPatch }) : document
    tree = renderTree.semanticRenderTree(
      renderDoc, slide, fieldContext
    )
  } catch (error) {
    return <div role="alert">Cannot render semantic slide: {error.message}</div>
  }
  const render = (node) => {
    if (node.hidden) return null
    if (!node.instanceId) return renderElement(node.element)
    const element = semanticElement(document, node.instanceId, node.element)
    return (
      <div
        key={node.instanceId}
        data-semantic-instance-id={node.instanceId}
        data-semantic-kind={node.kind}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transform: node.transform,
          transformOrigin: '0 0',
          overflow: 'visible',
          zIndex: node.paintIndex,
          ...(node.kind === 'group' ? { opacity: node.opacity } : {}),
        }}
      >
        {!node.paintOnly && renderElement(element)}
        {node.children.map(render)}
      </div>
    )
  }
  return tree.map(render)
}

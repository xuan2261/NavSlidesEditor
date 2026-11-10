const {
  LAYOUT_ATTRIBUTES,
  LAYOUT_CHILDREN,
  normalizeSmartArtLayout,
  layoutFailure,
} = require('../../../shared/src/pptx-smartart-layout-declarations')
const D_URIS = new Set([
  'http://schemas.openxmlformats.org/drawingml/2006/diagram',
  'http://purl.oclc.org/ooxml/drawingml/diagram',
])
function readSmartArtLayout(s) {
  const declarations = []
  function visit(node, parentId) {
    const source = s.location(node)
    const d = { componentId: '', type: node.local, attributes: {}, children: [], source }
    if (!D_URIS.has(node.uri) || !Object.hasOwn(LAYOUT_ATTRIBUTES, node.local))
      layoutFailure(d, `construct/namespace ${node.local}`)
    const kind = {
      layoutNode: 'diagram-layout',
      alg: 'diagram-algorithm',
      constr: 'diagram-constraint',
    }[node.local]
    d.componentId = kind ? s.bind(node, kind, parentId, 'property') : s.component(node, 'property')
    let attrs
    try {
      attrs = s.attrs(node, Object.keys(LAYOUT_ATTRIBUTES[node.local]))
      if (node.local === 'layoutDef') {
        s.children(
          node,
          ['title', 'desc', 'layoutNode'],
          ['layoutNode'],
          D_URIS
        )
        for (const child of node.children.filter((n) => n.local !== 'layoutNode')) {
          s.attrs(child, ['lang', 'val'])
          s.children(child)
        }
      } else {
        s.children(
          node,
          LAYOUT_CHILDREN[node.local],
          ['forEach', 'layoutNode', 'constr', 'param', 'if'],
          D_URIS
        )
      }
    } catch (error) {
      if (error.code !== 'PPTX_SEMANTIC_ADMISSION_FAILED') throw error
      // Preserve the child's exact locator for a namespace/construct failure.
      error.code = 'PPTX_SMARTART_LAYOUT_UNSUPPORTED'
      throw error
    }
    for (const [key, value] of Object.entries(attrs)) {
      if (LAYOUT_ATTRIBUTES[node.local][key] === 'number') {
        if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value))
          layoutFailure(d, `number ${key}`)
        d.attributes[key] = Number(value)
      } else d.attributes[key] = value
    }
    declarations.push(d)
    const activeChildren = node.local === 'layoutDef'
      ? node.children.filter((child) => child.local === 'layoutNode')
      : node.children
    d.children = activeChildren.map((child) =>
      visit(child, kind ? d.componentId : parentId)
    )
    return d.componentId
  }
  const rootId = visit(s.roots[0], null)
  const source = { partUri: s.partUri, preconditionHash: s.hash }
  // Validate only after every declaration has its source-ordered child IDs.
  const layout = normalizeSmartArtLayout({ schemaVersion: 1, source, rootId, declarations }, source)
  s.finish()
  return layout
}
module.exports = { readSmartArtLayout }

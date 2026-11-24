const { A_URIS, decodeXml, textContent } = require('./ooxml-text-run-xml')
const D = new Set(['http://schemas.openxmlformats.org/drawingml/2006/diagram', 'http://purl.oclc.org/ooxml/drawingml/diagram'])

// Lossless, located source declarations. These are not resolved paint output.
function readSourceStyleTree(part, root, consume = () => {}) {
  const definitions = new Map(part.definitions.map(d => [part.nodes.get(d.id), d]))
  let count = 0
  function read(node, depth) {
    if (++count > 100000 || depth > 128 || !(A_URIS.has(node.uri) || (node === root && D.has(node.uri))))
      part.fail(node, 'unsupported style source namespace or budget')
    const declaration = definitions.get(node)
    if (declaration) consume(declaration, node)
    const attributes = node.attrs.filter(a => a.name !== 'xmlns' && !a.name.startsWith('xmlns:')).map(a => {
      const [prefix, local] = a.name.split(':')
      const namespaceUri = local ? prefix === 'xml' ? 'http://www.w3.org/XML/1998/namespace' : node.namespaces[prefix] : ''
      if (namespaceUri === undefined) part.fail(node, 'unbound style attribute namespace')
      return { namespaceUri, name: local || prefix, value: decodeXml(a.value) }
    })
    if (!node.selfClosing && node.children.length) {
      let cursor = node.end + 1
      for (const child of node.children) {
        if (part.xml.slice(cursor, child.start).trim()) part.fail(node, 'unsupported mixed style content')
        cursor = child.closeEnd + 1
      }
      if (part.xml.slice(cursor, node.closeStart).trim()) part.fail(node, 'unsupported mixed style content')
    }
    return { type: node.local, namespaceUri: node.uri, source: part.location(node), attributes,
      ...(declaration ? { definitionId: declaration.id, definitionKind: declaration.kind } : {}),
      children: node.children.map(child => read(child, depth + 1)),
      ...(!node.children.length && !node.selfClosing ? { text: textContent(part.xml, node) } : {}) }
  }
  return read(root, 0)
}
module.exports = { readSourceStyleTree }

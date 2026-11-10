const A = new Set(['http://schemas.openxmlformats.org/drawingml/2006/main', 'http://purl.oclc.org/ooxml/drawingml/main'])
const D = new Set(['http://schemas.openxmlformats.org/drawingml/2006/diagram', 'http://purl.oclc.org/ooxml/drawingml/diagram'])
const fail = () => { throw new TypeError('Invalid located OOXML style source') }
function validateSourceStyleTree(tree, expected) {
  let count = 0
  function visit(node, path, depth) {
    const source = node?.source
    if (!node || ++count > 100000 || depth > 128 ||
        Object.keys(node).some(key => !['type', 'namespaceUri', 'source', 'attributes', 'children', 'text', 'definitionId', 'definitionKind'].includes(key)) ||
        typeof node.type !== 'string' || !/^[A-Za-z][A-Za-z0-9]*$/.test(node.type) ||
        !(A.has(node.namespaceUri) || (depth === 0 && D.has(node.namespaceUri))) ||
        !source || source.partUri !== expected.partUri || source.preconditionHash !== expected.preconditionHash ||
        Object.keys(source).some(key => !['partUri', 'preconditionHash', 'path'].includes(key)) ||
        !Array.isArray(source.path) || !source.path.length || source.path.some(n => !Number.isSafeInteger(n) || n < 0) ||
        (path && JSON.stringify(source.path) !== JSON.stringify(path)) ||
        !Array.isArray(node.children) || !Array.isArray(node.attributes)) fail()
    if (node.definitionId !== undefined && (typeof node.definitionKind !== 'string' ||
        node.definitionId !== `${source.partUri}#${node.definitionKind}:${source.path.join('.')}`)) fail()
    if ((node.definitionId === undefined) !== (node.definitionKind === undefined)) fail()
    const names = new Set()
    for (const attribute of node.attributes) {
      if (!attribute || Object.keys(attribute).some(key => !['namespaceUri', 'name', 'value'].includes(key)) ||
          typeof attribute.namespaceUri !== 'string' || typeof attribute.name !== 'string' ||
          !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(attribute.name) || typeof attribute.value !== 'string') fail()
      const name = `${attribute.namespaceUri}|${attribute.name}`
      if (names.has(name)) fail()
      names.add(name)
    }
    if (node.text !== undefined && (typeof node.text !== 'string' || node.children.length)) fail()
    node.children.forEach((child, index) => visit(child, [...source.path, index], depth + 1))
  }
  if (!expected || !/^[a-f0-9]{64}$/.test(expected.preconditionHash)) fail()
  visit(tree, expected.path, 0)
}
module.exports = { validateSourceStyleTree }

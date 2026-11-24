const { validateSourceStyleTree } = require('./pptx-source-style-tree')
const fail = () => { throw new TypeError('Invalid source-bound table style reference') }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
function validateTableStyleReference(definition, safePartUri) {
  const value = definition.content.tableStyleReference
  const document = definition.content.tableDocument
  if (value === undefined) {
    if (document?.properties.tableStyleId !== undefined) fail()
    return
  }
  if (definition.kind !== 'table' || !document || value.ownerDefinitionId !== definition.id ||
      value.styleId !== document.properties.tableStyleId || value.fidelityStatus !== 'source-style-uninterpreted' ||
      Object.keys(value).some(key => !['ownerDefinitionId', 'styleId', 'declaration', 'relationship', 'style', 'catalog', 'fidelityStatus'].includes(key))) fail()
  function location(source) {
    if (!source || !safePartUri(source.partUri) || !/^[a-f0-9]{64}$/.test(source.preconditionHash) ||
        !Array.isArray(source.path) || !source.path.length || source.path.some(n => !Number.isSafeInteger(n) || n < 0) ||
        Object.keys(source).some(key => !['partUri', 'preconditionHash', 'path'].includes(key))) fail()
  }
  for (const source of [value.declaration, value.relationship?.source, value.style?.source, value.catalog?.source]) location(source)
  const root = definition.components.find(c => c.id === document.componentId)?.locator?.path
  if (!root || value.declaration.partUri !== definition.source.partUri ||
      value.declaration.preconditionHash !== definition.source.preconditionHash ||
      value.declaration.path.length <= root.length || !root.every((n, i) => value.declaration.path[i] === n) ||
      value.relationship.source.partUri !== 'ppt/_rels/presentation.xml.rels' ||
      !['http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles',
        'http://purl.oclc.org/ooxml/officeDocument/relationships/tableStyles'].includes(value.relationship.relationshipType) ||
      typeof value.relationship.relationshipId !== 'string' || !value.relationship.relationshipId ||
      Object.keys(value.relationship).some(key => !['relationshipId', 'relationshipType', 'source'].includes(key)) ||
      Object.keys(value.style).some(key => key !== 'source') || value.catalog.type !== 'tblStyleLst' ||
      !same(value.catalog.source.path, [0])) fail()
  validateSourceStyleTree(value.catalog, value.catalog.source)
  const matches = value.catalog.children.filter(node => same(node.source, value.style.source))
  const style = matches[0]
  if (matches.length !== 1 || style.type !== 'tblStyle' ||
      style.attributes.find(a => a.namespaceUri === '' && a.name === 'styleId')?.value.toLowerCase() !== value.styleId.toLowerCase()) fail()
}
module.exports = { validateTableStyleReference }

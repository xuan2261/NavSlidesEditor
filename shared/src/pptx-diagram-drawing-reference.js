const TYPE = 'http://schemas.microsoft.com/office/2007/relationships/diagramDrawing'
const fail = () => { throw new TypeError('Invalid semantic diagram drawing reference') }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const within = (a, b) => a.length > b.length && b.every((n, i) => a[i] === n)

// This validates immutable import provenance, not editability or native fidelity.
// Package membership and byte digests are authenticated by the source reader;
// the trusted semantic baseline protects this declaration on later saves.
function validateDiagramDrawingReference(definition, safePartUri) {
  const value = definition.content.drawingFallback
  if (value === undefined) return
  const document = definition.content.smartArtDocument
  if (definition.kind !== 'diagram' || !document || value.ownerDefinitionId !== definition.id ||
      value.role !== 'native-visual-cache' ||
      Object.keys(value).some(key => !['ownerDefinitionId', 'role', 'dataModel', 'declaration',
        'extensionUri', 'minimumVersion', 'relationship', 'drawing', 'constituents'].includes(key))) fail()
  function location(source) {
    if (!source || !safePartUri(source.partUri) || !/^[a-f0-9]{64}$/.test(source.preconditionHash) ||
        !Array.isArray(source.path) || !source.path.length || source.path.length > 257 ||
        source.path.some(n => !Number.isSafeInteger(n) || n < 0) ||
        Object.keys(source).some(key => !['partUri', 'preconditionHash', 'path'].includes(key))) fail()
  }
  for (const source of [value.dataModel, value.declaration, value.drawing, value.relationship?.source]) location(source)
  const data = document.relationships.find(relation => relation.role === 'data')
  if (!data || value.dataModel.partUri !== data.partUri || value.dataModel.preconditionHash !== data.preconditionHash ||
      !same(value.dataModel.path, [0]) || value.declaration.partUri !== data.partUri ||
      value.declaration.preconditionHash !== data.preconditionHash ||
      !within(value.declaration.path, value.dataModel.path) ||
      value.relationship.relationshipType !== TYPE ||
      typeof value.relationship.relationshipId !== 'string' || !value.relationship.relationshipId ||
      value.relationship.relationshipId.length > 1024 ||
      Object.keys(value.relationship).some(key => !['relationshipId', 'relationshipType', 'source'].includes(key)) ||
      value.relationship.source.partUri !== data.partUri.replace(/([^/]+)$/, '_rels/$1.rels') ||
      !same(value.drawing.path, [0]) ||
      value.drawing.partUri === data.partUri ||
      value.drawing.partUri === value.relationship.source.partUri ||
      typeof value.extensionUri !== 'string' || !value.extensionUri || value.extensionUri.length > 1024 ||
      (value.minimumVersion !== undefined && (typeof value.minimumVersion !== 'string' || value.minimumVersion.length > 1024)) ||
      !Array.isArray(value.constituents) || !value.constituents.length || value.constituents.length > 100000) fail()
  const identities = new Set()
  let declaration = false, root = false
  for (const item of value.constituents) {
    location(item.source)
    if (Object.keys(item).some(key => !['id', 'kind', 'source'].includes(key)) ||
        typeof item.kind !== 'string' || !/^[a-z-]+$/.test(item.kind) ||
        item.id !== `${item.source.partUri}#${item.kind}:${item.source.path.join('.')}` ||
        identities.has(item.id) || definition.components.some(component => component.id === item.id)) fail()
    identities.add(item.id)
    if (same(item.source, value.declaration)) declaration = true
    else if (item.source.partUri !== value.drawing.partUri ||
        item.source.preconditionHash !== value.drawing.preconditionHash ||
        !(same(item.source.path, value.drawing.path) || within(item.source.path, value.drawing.path))) fail()
    if (same(item.source, value.drawing)) root = true
  }
  if (!declaration || !root) fail()
}
module.exports = { validateDiagramDrawingReference }

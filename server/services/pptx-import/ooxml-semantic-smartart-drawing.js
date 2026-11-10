const { A_URIS } = require('./ooxml-text-run-xml')
const { relationshipPart } = require('./slide-order')
const { resolveTarget } = require('./package-store/raw-zip')
const DSP = 'http://schemas.microsoft.com/office/drawing/2008/diagram'
const TYPE = 'http://schemas.microsoft.com/office/2007/relationships/diagramDrawing'
const OPC = new Set(['http://schemas.openxmlformats.org/package/2006/relationships'])

// A native drawing is a cache reference, never an editable diagram document.
// Inventory identities are retained here rather than admitted as editing components.
async function readSmartArtDrawing(source, data, ownerDefinitionId, extensions) {
  if (!extensions) return undefined
  data.attrs(extensions)
  data.children(extensions, ['ext'], [], A_URIS)
  if (extensions.children.length !== 1) data.fail(extensions, 'ambiguous drawing extension')
  const extension = extensions.children[0]
  const attributes = data.attrs(extension, ['uri'])
  if (!attributes.uri) data.fail(extension, 'missing drawing extension URI')
  data.children(extension, ['dataModelExt'], [], new Set([DSP]))
  const declaration = data.required(extension, 'dataModelExt', new Set([DSP]))
  const a = data.attrs(declaration, ['relId', 'minVer'])
  data.children(declaration)
  if (!a.relId) data.fail(declaration, 'missing drawing relationship identity')
  const rels = await source.load(relationshipPart(data.partUri))
  const root = rels.roots[0]
  if (root.local !== 'Relationships' || !OPC.has(root.uri)) rels.fail(root, 'drawing relationship namespace')
  rels.attrs(root)
  rels.children(root, ['Relationship'], ['Relationship'], OPC)
  const ids = new Set()
  let binding
  for (const node of root.children) {
    const r = rels.attrs(node, ['Id', 'Type', 'Target', 'TargetMode'])
    rels.children(node)
    if (!r.Id || !r.Type || !r.Target || ids.has(r.Id)) rels.fail(node, 'ambiguous drawing relationship')
    ids.add(r.Id)
    if (r.Id === a.relId) binding = { node, ...r }
  }
  if (!binding || binding.Type !== TYPE || ![undefined, 'Internal'].includes(binding.TargetMode))
    data.fail(declaration, 'wrong/missing drawing relationship')
  let partUri
  try { partUri = resolveTarget(data.partUri, binding.Target) }
  catch { rels.fail(binding.node, 'unsafe drawing relationship target') }
  const drawing = await source.load(partUri)
  const drawingRoot = drawing.roots[0]
  if (drawingRoot.uri !== DSP || drawingRoot.local !== 'drawing') drawing.fail(drawingRoot, 'foreign drawing root')
  drawing.attrs(drawingRoot)
  drawing.children(drawingRoot, ['spTree'], [], new Set([DSP]))
  drawing.required(drawingRoot, 'spTree', new Set([DSP]))
  const constituents = []
  function retain(part, definition) {
    const node = part.nodes.get(definition.id)
    const location = node && part.location(node)
    if (definition.nativeId !== null) part.fail(node, 'native drawing cache cannot own editable shapes')
    if (!location || source.consumed.has(definition.id) || definition.preconditionHash !== part.hash ||
        definition.componentLocators.length !== 1 ||
        JSON.stringify(definition.componentLocators[0].path) !== JSON.stringify(location.path))
      part.fail(node, 'stale/ambiguous drawing cache constituent')
    source.consumed.add(definition.id)
    constituents.push({ id: definition.id, kind: definition.kind, source: location })
  }
  // Only this exact known extension is accepted; unknown siblings still fail.
  const extensionDefinitions = data.definitions.filter(d => data.nodes.get(d.id) === declaration)
  if (extensionDefinitions.length !== 1) data.fail(declaration, 'missing drawing extension inventory')
  retain(data, extensionDefinitions[0])
  for (const definition of drawing.definitions) retain(drawing, definition)
  drawing.finish()
  return {
    ownerDefinitionId,
    role: 'native-visual-cache',
    dataModel: data.location(data.roots[0]),
    declaration: data.location(declaration),
    extensionUri: attributes.uri,
    ...(a.minVer === undefined ? {} : { minimumVersion: a.minVer }),
    relationship: { relationshipId: a.relId, relationshipType: TYPE, source: rels.location(binding.node) },
    drawing: drawing.location(drawingRoot),
    constituents,
  }
}
module.exports = { readSmartArtDrawing }

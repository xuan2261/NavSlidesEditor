const { A_URIS, attr, decodeXml, descendants } = require('./ooxml-text-run-xml')
const { smartArtSource } = require('./ooxml-semantic-smartart-source')
const { readSourceStyleTree } = require('./ooxml-semantic-source-style-tree')
const { resolveTarget } = require('./package-store/raw-zip')
const R = ['http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'http://purl.oclc.org/ooxml/officeDocument/relationships']

async function readTableStyleReference(context, tableDocument) {
  const styleId = tableDocument.properties.tableStyleId
  if (styleId === undefined) return undefined
  const source = smartArtSource(context)
  const rels = await source.load('ppt/_rels/presentation.xml.rels')
  const relationships = rels.roots[0]
  const matches = relationships.children.filter(node => R.some(uri => decodeXml(attr(node, 'Type') ?? '') === `${uri}/tableStyles`))
  if (relationships.uri !== 'http://schemas.openxmlformats.org/package/2006/relationships' ||
      relationships.local !== 'Relationships' || matches.length !== 1)
    rels.fail(relationships, 'missing/ambiguous table style relationship')
  const relationship = matches[0]
  const binding = rels.attrs(relationship, ['Id', 'Type', 'Target', 'TargetMode'])
  if (!binding.Id || !binding.Target || ![undefined, 'Internal'].includes(binding.TargetMode))
    rels.fail(relationship, 'external/invalid table style relationship')
  let partUri
  try { partUri = resolveTarget('ppt/presentation.xml', binding.Target) }
  catch { rels.fail(relationship, 'unsafe table style target') }
  const part = await source.load(partUri), root = part.roots[0]
  if (!A_URIS.has(root.uri) || root.local !== 'tblStyleLst') part.fail(root, 'foreign table style part')
  part.attrs(root, ['def'])
  part.children(root, ['tblStyle'], ['tblStyle'])
  const styles = root.children.filter(node => decodeXml(attr(node, 'styleId') ?? '').toLowerCase() === styleId.toLowerCase())
  if (styles.length !== 1) part.fail(root, 'missing/ambiguous table style definition')
  const paths = new Map()
  function walk(node, path) { paths.set(node, path); node.children.forEach((child, index) => walk(child, [...path, index])) }
  walk(context.node, context.source.componentLocators[0].path)
  const declarations = descendants(context.node, node => A_URIS.has(node.uri) && node.local === 'tableStyleId')
  if (declarations.length !== 1) part.fail(root, 'missing/ambiguous table style declaration')
  const catalog = readSourceStyleTree(part, root, (definition, node) => {
    if (source.consumed.has(definition.id)) part.fail(node, 'ambiguous table style constituent')
    source.consumed.add(definition.id)
  })
  part.finish()
  return {
    reference: { ownerDefinitionId: context.source.id, styleId,
      declaration: { partUri: context.source.partUri, preconditionHash: context.source.preconditionHash, path: paths.get(declarations[0]) },
      relationship: { relationshipId: binding.Id, relationshipType: binding.Type, source: rels.location(relationship) },
      style: { source: part.location(styles[0]) },
      catalog, fidelityStatus: 'source-style-uninterpreted' },
    mappedDefinitionIds: [...source.consumed],
  }
}
module.exports = { readTableStyleReference }

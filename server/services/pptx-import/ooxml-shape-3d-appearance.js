const { A_URIS, P_URIS } = require('./ooxml-text-run-xml')
const { child } = require('./ooxml-native-text-style-source')
const { tableSource } = require('./ooxml-semantic-table-source')
const { readTableColor } = require('./ooxml-semantic-table-properties')
const { SHAPE_3D_GRAMMAR, CHILD_FIELDS } = require('../../../shared/src/pptx-shape-3d-appearance')

// Read only declarations owned by this native object's spPr. These values are
// retained source data, not geometry, a browser effect, or native export support.
function readShape3dAppearance(context) {
  const { source, node } = context
  if (!['shape', 'connector', 'picture'].includes(source.kind)) return null
  const spPr = child(node, 'spPr', P_URIS)
  const roots = spPr?.children.filter((n) => ['scene3d', 'sp3d'].includes(n.local)) || []
  if (!roots.length) return null
  const reader = tableSource(context), paths = new Map()
  function locate(n, path) {
    paths.set(n, path)
    n.children.forEach((c, i) => locate(c, [...path, i]))
  }
  locate(node, source.componentLocators[0].path)
  const wrap = (n, value) => ({ source: { partUri: source.partUri,
    preconditionHash: source.preconditionHash,
    componentLocator: { path: paths.get(n), preconditionHash: source.preconditionHash } }, value })
  function parse(n) {
    if (!A_URIS.has(n.uri) || !Object.hasOwn(SHAPE_3D_GRAMMAR, n.local))
      reader.fail(n, 'unsupported 3D appearance declaration')
    const grammar = SHAPE_3D_GRAMMAR[n.local]
    const attributes = reader.attrs(n, Object.keys(grammar.attributes))
    const value = { kind: n.local }
    for (const required of grammar.required)
      if (!Object.hasOwn(attributes, required)) reader.fail(n, `missing 3D appearance ${required}`)
    for (const [name, raw] of Object.entries(attributes)) {
      const check = grammar.attributes[name]
      if (check(raw)) value[name] = raw
      else if (/^-?\d+$/.test(raw) && check(Number(raw))) value[name] = Number(raw)
      else reader.fail(n, `unsupported/malformed 3D appearance ${name}`)
    }
    const color = ['extrusionClr', 'contourClr'].includes(n.local)
    reader.children(n, color ? ['srgbClr', 'schemeClr', 'prstClr'] : grammar.children)
    if (color) {
      if (n.children.length !== 1) reader.fail(n, 'missing/ambiguous 3D appearance color')
      value.color = readTableColor(n.children[0], reader)
    } else {
      let previous = -1
      for (const nested of n.children) {
        const index = grammar.children.indexOf(nested.local)
        if (index <= previous) reader.fail(nested, 'out-of-order 3D appearance declaration')
        previous = index
        value[CHILD_FIELDS[nested.local]] = parse(nested)
      }
      for (const required of grammar.requiredChildren)
        if (!value[CHILD_FIELDS[required]]) reader.fail(n, `missing 3D appearance ${required}`)
    }
    return wrap(n, value)
  }
  const appearance = { schemaVersion: 1 }, warnings = []
  let previous = -1
  for (const root of roots) {
    const index = ['scene3d', 'sp3d'].indexOf(root.local)
    if (index <= previous) reader.fail(root, 'duplicate/out-of-order 3D appearance root')
    previous = index
    const field = root.local === 'scene3d' ? 'scene' : 'shape'
    const entry = parse(root)
    entry.componentId = reader.bind(root, 'property', source.id, 'property')
    appearance[field] = entry
    warnings.push({ type: '3d-appearance-preserved-unrendered', definitionId: source.id,
      componentId: entry.componentId, partUri: source.partUri,
      message: `Source ${root.local} appearance is preserved but not rendered; 3D camera, lighting, bevel and material effects are not visually qualified.` })
  }
  return { appearance, warnings }
}
module.exports = { readShape3dAppearance }

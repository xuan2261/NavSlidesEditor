const { A_URIS } = require('./ooxml-text-run-xml')
const { tableSource } = require('./ooxml-semantic-table-source')
const { readTableColor } = require('./ooxml-semantic-table-properties')
const { SHAPE_3D_GRAMMAR, CHILD_FIELDS } = require('../../../shared/src/pptx-shape-3d-appearance')

const one = (...values) => (v) => values.includes(v)

// Theme format scheme (fmtScheme) allows standard DrawingML 3D scene and shape
// appearances under effectStyle (index 2 in Office theme fmtScheme).
// STTre_Duc uses rig="threePt" for the theme lightRig.
const THEME_3D_GRAMMAR = Object.freeze({
  ...SHAPE_3D_GRAMMAR,
  lightRig: Object.freeze({
    ...SHAPE_3D_GRAMMAR.lightRig,
    attributes: Object.freeze({
      ...SHAPE_3D_GRAMMAR.lightRig.attributes,
      rig: one('soft', 'threePt'),
    }),
  }),
})

function parse3dNode(node, reader, paths, source, grammar = THEME_3D_GRAMMAR) {
  if (!A_URIS.has(node.uri) || !Object.hasOwn(grammar, node.local)) {
    reader.fail(node, 'unsupported 3D appearance declaration')
  }
  const spec = grammar[node.local]
  const attributes = reader.attrs(node, Object.keys(spec.attributes))
  const value = { kind: node.local }
  for (const required of spec.required) {
    if (!Object.hasOwn(attributes, required)) {
      reader.fail(node, `missing 3D appearance ${required}`)
    }
  }
  for (const [name, raw] of Object.entries(attributes)) {
    const check = spec.attributes[name]
    if (check(raw)) {
      value[name] = raw
    } else if (/^-?\d+$/.test(raw) && check(Number(raw))) {
      value[name] = Number(raw)
    } else {
      reader.fail(node, `unsupported/malformed 3D appearance ${name}`)
    }
  }
  const isColor = ['extrusionClr', 'contourClr'].includes(node.local)
  reader.children(node, isColor ? ['srgbClr', 'schemeClr', 'prstClr'] : spec.children)
  if (isColor) {
    if (node.children.length !== 1) {
      reader.fail(node, 'missing/ambiguous 3D appearance color')
    }
    value.color = readTableColor(node.children[0], reader)
  } else {
    let previous = -1
    for (const nested of node.children) {
      const index = spec.children.indexOf(nested.local)
      if (index <= previous) {
        reader.fail(nested, 'out-of-order 3D appearance declaration')
      }
      previous = index
      value[CHILD_FIELDS[nested.local]] = parse3dNode(nested, reader, paths, source, grammar)
    }
    for (const required of spec.requiredChildren) {
      if (!value[CHILD_FIELDS[required]]) {
        reader.fail(node, `missing 3D appearance ${required}`)
      }
    }
  }
  const locatorPath = paths.get(node)
  return {
    source: {
      partUri: source.partUri,
      preconditionHash: source.preconditionHash,
      componentLocator: { path: locatorPath, preconditionHash: source.preconditionHash },
    },
    value,
  }
}

/**
 * Reads 3D appearance declarations (scene3d, sp3d) defined in a theme's format scheme (fmtScheme).
 * Retains exact source provenance with strict malformed rejection and no render/native claims.
 */
function readTheme3dAppearance({ partUri, xml, roots, preconditionHash, components = [], nodes = new Map() }) {
  const root = roots?.[0]
  if (!root || !A_URIS.has(root.uri) || root.local !== 'theme') return null

  const paths = new Map()
  function locate(n, path) {
    paths.set(n, path)
    n.children.forEach((c, i) => locate(c, [...path, i]))
  }
  locate(root, [0])

  const source = {
    id: `${partUri}#theme:0`,
    partUri,
    preconditionHash,
    componentLocators: [{ path: [0], preconditionHash }],
  }
  if (!nodes.has(source.id)) {
    nodes.set(source.id, root)
  }

  const reader = tableSource({ source, node: root, xml, components, nodes })

  const themeElements = root.children.find((c) => A_URIS.has(c.uri) && c.local === 'themeElements')
  if (!themeElements) return null

  const fmtScheme = themeElements.children.find((c) => A_URIS.has(c.uri) && c.local === 'fmtScheme')
  if (!fmtScheme) return null

  const effectStyleLst = fmtScheme.children.find((c) => A_URIS.has(c.uri) && c.local === 'effectStyleLst')
  if (!effectStyleLst) return null

  const appearances = []
  const warnings = []

  effectStyleLst.children.forEach((effectStyle, effectIndex) => {
    if (!A_URIS.has(effectStyle.uri) || effectStyle.local !== 'effectStyle') {
      reader.fail(effectStyle, 'unsupported effect style in theme')
    }

    // Effect style sequence in DrawingML CT_EffectStyle:
    // (effectLst | effectDag)?, scene3d?, sp3d?
    const roots3d = effectStyle.children.filter((n) => ['scene3d', 'sp3d'].includes(n.local))
    if (!roots3d.length) return

    let previous = -1
    const appearance = {
      schemaVersion: 1,
      partUri,
      effectStyleIndex: effectIndex,
      effectStyleLocator: { path: paths.get(effectStyle), preconditionHash },
    }

    for (const node3d of roots3d) {
      const index = ['scene3d', 'sp3d'].indexOf(node3d.local)
      if (index <= previous) {
        reader.fail(node3d, 'duplicate/out-of-order theme 3D appearance root')
      }
      previous = index

      const field = node3d.local === 'scene3d' ? 'scene' : 'shape'
      const entry = parse3dNode(node3d, reader, paths, source, THEME_3D_GRAMMAR)
      const locatorPath = paths.get(node3d)
      entry.componentId = `${partUri}#property:${locatorPath.join('.')}`
      appearance[field] = entry

      warnings.push({
        type: '3d-appearance-preserved-unrendered',
        definitionId: entry.componentId,
        componentId: entry.componentId,
        partUri,
        message: `Source theme ${node3d.local} appearance is preserved but not rendered; 3D camera, lighting, bevel and material effects are not visually qualified.`,
      })
    }

    appearances.push(appearance)
  })

  return { appearances, warnings }
}

/**
 * Integration hook for projector to map theme 3D appearance definitions and register dispositions.
 */
function projectTheme3dAppearance({ inventory, parts, nodes, dispositions, fail, warnings = [] }) {
  const mappedAppearances = []

  for (const part of inventory.parts) {
    if (!part.partUri.includes('theme')) continue
    const partData = parts.get(part.partUri)
    if (!partData?.roots?.length) continue

    const themeDefComponents = inventory.definitions.filter(
      (d) => d.partUri === part.partUri && ['scene3d', 'sp3d'].includes(d.localName)
    )

    const parsed = readTheme3dAppearance({
      partUri: part.partUri,
      xml: partData.xml,
      roots: partData.roots,
      preconditionHash: part.preconditionHash,
      components: themeDefComponents,
      nodes,
    })

    if (!parsed) continue

    for (const app of parsed.appearances) {
      mappedAppearances.push(app)
      for (const field of ['scene', 'shape']) {
        const root = app[field]
        if (!root) continue
        const defId = root.componentId
        const inventoryEntry = inventory.definitions.find((d) => d.id === defId)
        if (inventoryEntry) {
          if (dispositions.has(defId)) {
            fail(inventoryEntry, 'duplicate theme 3D disposition')
          }
          dispositions.set(defId, {
            definitionId: defId,
            partUri: part.partUri,
            locator: inventoryEntry.componentLocators[0],
            disposition: 'semantically-mapped',
          })
        }
      }
    }

    warnings.push(...parsed.warnings)
  }

  return { mappedAppearances, warnings }
}

module.exports = {
  THEME_3D_GRAMMAR,
  parse3dNode,
  readTheme3dAppearance,
  projectTheme3dAppearance,
}

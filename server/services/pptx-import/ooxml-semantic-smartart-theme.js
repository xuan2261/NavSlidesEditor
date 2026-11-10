const { relationshipPart } = require('./slide-order')
const { resolveTarget } = require('./package-store/raw-zip')
const { A_URIS, P_URIS } = require('./ooxml-text-run-xml')
const { readTableColor } = require('./ooxml-semantic-table-properties')
const { resolveRgbPaint, resolveProperty } = require('../../../shared/src/pptx-style-resolution')
const R = ['http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  'http://purl.oclc.org/ooxml/officeDocument/relationships']

async function readSmartArtTheme(source, ownerPart) {
  let current = ownerPart
  const seen = new Set(), colorMap = {}
  while (!seen.has(current)) {
    seen.add(current)
    const part = await source.load(current)
    const map = part.roots[0].children.find((n) => P_URIS.has(n.uri) && n.local === 'clrMap')
    if (map) Object.assign(colorMap, part.attrs(map,
      ['bg1', 'tx1', 'bg2', 'tx2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink']))
    // Overrides cannot be silently ignored in this source paint lane.
    const override = part.roots[0].children.find((n) => P_URIS.has(n.uri) && n.local === 'clrMapOvr')
    if (override && !override.children.every((n) => A_URIS.has(n.uri) && n.local === 'masterClrMapping'))
      part.fail(override, 'SmartArt color-map override unsupported')
    const rel = await source.load(relationshipPart(current))
    const candidates = rel.roots[0].children.map((n) => ({ node: n,
      attrs: rel.attrs(n, ['Id', 'Type', 'Target', 'TargetMode']) }))
    const overrideRelationship = candidates.find((r) => R.some((ns) => r.attrs.Type === `${ns}/themeOverride`))
    if (overrideRelationship) rel.fail(overrideRelationship.node, 'SmartArt theme override unsupported')
    let selected
    for (const role of ['theme', 'slideLayout', 'slideMaster']) {
      const matches = candidates.filter((r) => R.some((ns) => r.attrs.Type === `${ns}/${role}`))
      if (matches.length > 1) rel.fail(matches[1].node, 'ambiguous SmartArt theme ancestry')
      if (matches.length) { selected = { ...matches[0], role }; break }
    }
    if (!selected || (selected.attrs.TargetMode && selected.attrs.TargetMode !== 'Internal'))
      rel.fail(rel.roots[0], 'missing/internal SmartArt theme ancestry')
    current = resolveTarget(current, selected.attrs.Target)
    if (selected.role !== 'theme') continue
    const theme = await source.load(current), root = theme.roots[0]
    if (!A_URIS.has(root.uri) || root.local !== 'theme') theme.fail(root, 'wrong theme root')
    const elements = theme.required(root, 'themeElements')
    return { part: theme, elements, colorMap }
  }
  const cycle = await source.load(current)
  cycle.fail(cycle.roots[0], 'cyclic SmartArt theme ancestry')
}

function themeColor(node, s, theme, placeholder) {
  const attrs = s.attrs(node, ['val'])
  let color
  if (node.local === 'schemeClr' && attrs.val === 'phClr') {
    if (!placeholder) s.fail(node, 'unresolved SmartArt placeholder color')
    // Validate transforms using a concrete color, retaining authored transform order.
    const concrete = { ...node, attrs: node.attrs.map((a) => a.name === 'val' ? { ...a, value: placeholder.value } : a), local: 'srgbClr' }
    color = readTableColor(concrete, s)
    color.transforms = [...(placeholder.transforms ?? []), ...(color.transforms ?? [])]
  } else color = readTableColor(node, s)
  if (color.kind === 'scheme') {
    const name = theme.colorMap[color.value] ?? color.value
    const scheme = theme.part.required(theme.elements, 'clrScheme')
    const entry = theme.part.required(scheme, name)
    theme.part.children(entry, ['srgbClr', 'sysClr'])
    if (entry.children.length !== 1) theme.part.fail(entry, 'ambiguous scheme color')
    const value = entry.children[0]
    theme.part.children(value)
    const a = theme.part.attrs(value, value.local === 'sysClr' ? ['val', 'lastClr'] : ['val'])
    const rgb = value.local === 'sysClr' ? a.lastClr : a.val
    if (!/^[a-f0-9]{6}$/i.test(rgb ?? '')) theme.part.fail(value, 'unresolved scheme color')
    color = { ...color, kind: 'srgb', value: rgb }
  }
  return color
}
function resolvedColor(color, text = false) {
  const resolved = text ? resolveProperty({ property: 'color', scope: 'run', layers: {
    target: {}, entries: [{ id: 'smartart-text-color', kind: 'run',
      source: { part: 'smartart', path: 'textColor' }, properties: { color } }],
  } }).resolved : resolveRgbPaint(color)
  return { kind: 'srgb', value: resolved.rgb,
    ...(resolved.alpha !== 1 ? { transforms: [{ kind: 'alpha', value: Math.round(resolved.alpha * 100000) }] } : {}) }
}
module.exports = { readSmartArtTheme, themeColor, resolvedColor }

const { isNode, attr, decodeXml, A_URIS, P_URIS } = require('./ooxml-text-run-xml')

const child = (node, local, uris = A_URIS) => node?.children.find((item) => isNode(item, uris, local))
const value = (node, name) => node ? attr(node, name) : null
const decoded = (node, name) => { const raw = value(node, name); return raw === null ? null : decodeXml(raw) }

function colorMap(context) {
  for (const part of [context.slide, context.layout]) {
    const override = child(part?.children[0], 'clrMapOvr', P_URIS)
    if (!override) continue
    if (child(override, 'masterClrMapping')) break
    return child(override, 'overrideClrMapping') || null
  }
  return child(context.master?.children[0], 'clrMap', P_URIS)
}

// Project only explicit, untransformed source values. The general theme parser's
// default palette and tx/bg aliases are deliberately not authoritative here.
function nativeTheme(context) {
  const elements = child(context.theme?.children[0], 'themeElements')
  const fontScheme = child(elements, 'fontScheme')
  const fonts = Object.fromEntries(['major', 'minor'].map((kind) => {
    const raw = decoded(child(child(fontScheme, `${kind}Font`), 'latin'), 'typeface')
    return [kind, raw && !raw.startsWith('+') ? raw : null]
  }))
  const scheme = {}
  const colors = child(elements, 'clrScheme')
  for (const entry of colors?.children || []) {
    if (!A_URIS.has(entry.uri)) continue
    const source = child(entry, 'srgbClr') || child(entry, 'sysClr')
    if (!source || source.children.length) continue
    const raw = value(source, source.local === 'srgbClr' ? 'val' : 'lastClr')
    if (raw && /^[\da-fA-F]{6}$/u.test(raw)) scheme[entry.local] = `#${raw.toUpperCase()}`
  }
  const map = colorMap(context)
  return { fonts, schemeColor(name) {
    if (map === null) return null
    return scheme[value(map, name) || name] || null
  } }
}

module.exports = { nativeTheme }

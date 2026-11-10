const { readSmartArtTheme, themeColor, resolvedColor } = require('./ooxml-semantic-smartart-theme')
const { A_URIS } = require('./ooxml-text-run-xml')
const { readTableText } = require('./ooxml-semantic-table-text')
const D = new Set(['http://schemas.openxmlformats.org/drawingml/2006/diagram',
  'http://purl.oclc.org/ooxml/drawingml/diagram'])

async function readSmartArtStyles(source, bound, ownerPart) {
  const s = bound.style, c = bound.colors
  for (const part of [s, c]) {
    part.attrs(part.roots[0], ['uniqueId', 'minVer'])
    part.children(part.roots[0], ['title', 'desc', 'styleLbl'], ['title', 'desc', 'styleLbl'], D)
    for (const metadata of part.roots[0].children.filter((n) => n.local !== 'styleLbl')) {
      part.attrs(metadata, ['lang', 'val'])
      part.children(metadata)
    }
  }
  const styleNodes = s.roots[0].children.filter((n) => n.local === 'styleLbl')
  const colorNodes = c.roots[0].children.filter((n) => n.local === 'styleLbl')
  if (!styleNodes.length && !colorNodes.length) return undefined
  const theme = await readSmartArtTheme(source, ownerPart), t = theme.part
  const fmt = t.required(theme.elements, 'fmtScheme')
  const colorLabels = new Map()
  for (const label of colorNodes) {
    const { name } = c.attrs(label, ['name'])
    if (!name || colorLabels.has(name)) c.fail(label, 'duplicate/missing color style label')
    c.children(label, ['fillClrLst', 'linClrLst', 'txFillClrLst'], [], D)
    const lists = {}
    for (const list of label.children) {
      const a = c.attrs(list, ['meth', 'hueDir'])
      if ((a.meth ?? 'span') !== 'repeat' || a.hueDir !== undefined)
        c.fail(list, 'SmartArt color interpolation unsupported')
      c.children(list, ['srgbClr', 'schemeClr'], ['srgbClr', 'schemeClr'])
      if (!list.children.length) c.fail(list, 'empty SmartArt palette')
      lists[list.local] = list.children.map((n) => resolvedColor(themeColor(n, c, theme), list.local === 'txFillClrLst'))
    }
    colorLabels.set(name, lists)
  }
  const names = new Set()
  const labels = styleNodes.map((node) => {
    const { name } = s.attrs(node, ['name'])
    if (!name || names.has(name)) s.fail(node, 'duplicate/missing quick style label')
    names.add(name)
    s.children(node, ['style', 'txPr'], [], D)
    const style = s.required(node, 'style', D)
    s.attrs(style)
    s.children(style, ['lnRef', 'fillRef', 'effectRef', 'fontRef'])
    const palette = colorLabels.get(name)
    if (!palette) s.fail(node, 'missing matching color style label')
    const ref = (kind) => {
      const n = s.required(style, kind), a = s.attrs(n, ['idx'])
      s.children(n, ['srgbClr', 'schemeClr'])
      if (n.children.length !== 1) s.fail(n, 'missing/ambiguous style reference color')
      return { node: n, index: kind === 'fontRef' ? a.idx : s.number(n, a.idx, 0), color: n.children[0] }
    }
    const fill = ref('fillRef'), line = ref('lnRef'), effect = ref('effectRef'), font = ref('fontRef')
    if (effect.index !== 0) {
      const list = t.required(fmt, 'effectStyleLst'), entry = list.children[effect.index - 1]
      if (!entry) s.fail(effect.node, 'missing theme effect style')
      if (!A_URIS.has(entry.uri) || entry.local !== 'effectStyle') t.fail(entry, 'wrong theme effect namespace')
      t.attrs(entry); t.children(entry, ['effectLst'])
      const effects = t.required(entry, 'effectLst'); t.attrs(effects); t.children(effects)
    }
    const paint = (reference, listName, paletteName, isLine = false) => {
      if (reference.index === 0) return { colors: [{ kind: 'none' }], width: 0 }
      const list = t.required(fmt, listName), entry = list.children[reference.index - 1]
      if (!entry) s.fail(reference.node, 'missing theme paint style')
      if (!A_URIS.has(entry.uri) || (isLine && entry.local !== 'ln')) t.fail(entry, 'wrong theme paint namespace')
      const colors = palette[paletteName]
      if (!colors) s.fail(reference.node, 'missing source color list')
      let fillNode = entry, width = 0, join
      if (isLine) {
        const a = t.attrs(entry, ['w', 'cap', 'cmpd', 'algn'])
        if ((a.cmpd && a.cmpd !== 'sng') || (a.algn && a.algn !== 'ctr') || (a.cap && a.cap !== 'flat'))
          t.fail(entry, 'unsupported SmartArt line geometry')
        width = t.number(entry, a.w, 0, 20116800)
        t.children(entry, ['solidFill', 'noFill', 'prstDash', 'miter', 'round', 'bevel'])
        const joins = entry.children.filter((n) => ['miter', 'round', 'bevel'].includes(n.local))
        if (joins.length > 1) t.fail(entry, 'conflicting line join')
        if (joins.length) {
          const n = joins[0]; t.children(n)
          const a = t.attrs(n, n.local === 'miter' ? ['lim'] : [])
          join = { kind: n.local, ...(n.local === 'miter' ? { limit: t.number(n, a.lim, 0) } : {}) }
        }
        const dash = entry.children.find((n) => n.local === 'prstDash')
        if (dash) { t.children(dash); if (t.attrs(dash, ['val']).val !== 'solid') t.fail(dash, 'SmartArt line dash unsupported') }
        const fills = entry.children.filter((n) => ['solidFill', 'noFill'].includes(n.local))
        if (fills.length !== 1) t.fail(entry, 'missing/ambiguous line fill')
        fillNode = fills[0]
      }
      t.attrs(fillNode)
      if (fillNode.local === 'noFill') { t.children(fillNode); return { colors: [{ kind: 'none' }], width, join } }
      if (fillNode.local !== 'solidFill') t.fail(fillNode, 'SmartArt theme fill unsupported')
      t.children(fillNode, ['srgbClr', 'schemeClr'])
      if (fillNode.children.length !== 1) t.fail(fillNode, 'missing/ambiguous theme fill color')
      return { width, join, colors: colors.map((color) => resolvedColor(themeColor(fillNode.children[0], t, theme, themeColor(reference.color, s, theme, color)))) }
    }
    const fillPaint = paint(fill, 'fillStyleLst', 'fillClrLst')
    const linePaint = paint(line, 'lnStyleLst', 'linClrLst', true)
    if (!['major', 'minor', 'none'].includes(font.index)) s.fail(font.node, 'unsupported font reference')
    const run = {}
    if (font.index !== 'none') {
      const fonts = t.required(t.required(theme.elements, 'fontScheme'), `${font.index}Font`)
      for (const [native, key] of [['latin', 'fontLatin'], ['ea', 'fontEastAsian'], ['cs', 'fontComplexScript']]) {
        const n = t.required(fonts, native); t.children(n)
        const face = t.attrs(n, ['typeface', 'panose', 'pitchFamily', 'charset']).typeface
        if (face?.startsWith('+')) t.fail(n, 'recursive theme font')
        if (face) run[key] = { typeface: face }
      }
    }
    if (!palette.txFillClrLst) s.fail(font.node, 'missing text color list')
    const textColors = palette.txFillClrLst.map((color) => resolvedColor(themeColor(font.color, s, theme, color), true))
    const textDefaults = { run }
    const txPr = node.children.find((n) => n.local === 'txPr')
    let textStyleDocument
    if (txPr) {
      const text = readTableText(txPr, null, s), p = text.paragraphs[0]
      if (text.paragraphs.length !== 1 || p.runs.length || p.endRunProperties)
        s.fail(txPr, 'SmartArt style text must contain one empty default paragraph')
      textDefaults.body = text.body
      textDefaults.paragraph = p.properties ?? {}
      textDefaults.run = { ...run, ...p.defaultRunProperties }
      textStyleDocument = text
    }
    return { name, componentId: s.component(node, 'property'), source: s.location(node),
      fillColors: fillPaint.colors, lineColors: linePaint.colors, lineWidthEmu: linePaint.width,
      ...(linePaint.join ? { lineJoin: linePaint.join } : {}),
      textColors, textDefaults, ...(textStyleDocument ? { textStyleDocument } : {}) }
  })
  if ([...colorLabels.keys()].some((name) => !names.has(name))) c.fail(c.roots[0], 'unmatched color style label')
  s.finish(); c.finish()
  return { schemaVersion: 1, styleSource: s.location(s.roots[0]), colorSource: c.location(c.roots[0]),
    themeSource: t.location(t.roots[0]), labels }
}
module.exports = { readSmartArtStyles }

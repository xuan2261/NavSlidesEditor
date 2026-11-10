const { P_URIS, A_URIS } = require('./ooxml-text-run-xml')
const { readSemanticTextListStyle } = require('./ooxml-semantic-text-list-style')
const { listParagraphProperties } = require('./ooxml-semantic-text-list-style-properties')
const { runProperties } = require('./ooxml-semantic-table-text-properties')
const { readSemanticTextBody } = require('./ooxml-semantic-text-body')
const { readTableColor } = require('./ooxml-semantic-table-properties')

function placeholder(p, shape) {
  const nv = p.one(shape, 'nvSpPr', P_URIS),
    props = p.one(nv, 'nvPr', P_URIS)
  const ph = p.one(props, 'ph', P_URIS)
  if (!ph) return undefined
  const a = p.attrs(ph, ['type', 'idx', 'orient', 'sz', 'hasCustomPrompt'])
  if (
    a.type !== undefined &&
    ![
      'title',
      'body',
      'ctrTitle',
      'subTitle',
      'dt',
      'sldNum',
      'ftr',
      'hdr',
      'obj',
      'chart',
      'tbl',
      'clipArt',
      'dgm',
      'media',
      'sldImg',
      'pic',
    ].includes(a.type)
  )
    p.fail(ph, 'unsupported placeholder type')
  p.children(ph)
  if (a.orient && a.orient !== 'horz') p.fail(ph, 'unsupported placeholder orientation')
  if (a.sz !== undefined && !['full', 'half', 'quarter'].includes(a.sz))
    p.fail(ph, 'unsupported placeholder size')
  if (a.hasCustomPrompt !== undefined) p.boolean(ph, a.hasCustomPrompt)
  return {
    ...(a.type !== undefined ? { type: a.type } : {}),
    ...(a.idx !== undefined ? { index: p.number(ph, a.idx, 0, 4294967295) } : {}),
  }
}
function matchPlaceholder(p, target, byType = false) {
  if (!target) return null
  const candidates = p.definitions
    .filter((d) => d.kind === 'shape')
    .filter((d) => {
      const ph = placeholder(p, p.nodes.get(d.id))
      if (!ph) return false
      const type = target.type ?? 'obj',
        candidate = ph.type ?? 'obj'
      return byType
        ? type === candidate || (type === 'obj' && candidate === 'body')
        : (ph.index ?? 0) === (target.index ?? 0)
    })
  if (candidates.length > 1) p.fail(p.root, 'ambiguous placeholder binding')
  return candidates[0] || null
}
function entry(p, node, kind, properties, extra = {}, id) {
  return { id: p.receipt(node, id), kind, source: p.location(node), properties, ...extra }
}
function declarations(p, list, kind, extra = {}) {
  if (!list) return { paragraph: [], run: [] }
  p.attrs(list)
  p.children(list, ['defPPr', ...Array.from({ length: 9 }, (_, i) => `lvl${i + 1}pPr`)])
  const result = { paragraph: [], run: [] }
  for (const n of list.children) {
    const parsed = listParagraphProperties(n, p)
    const metadata = {
      ...extra,
      ...(n.local !== 'defPPr' ? { level: Number(n.local[3]) - 1 } : {}),
    }
    result.paragraph.push(entry(p, n, kind, parsed.properties, metadata))
    result.run.push(entry(p, n, kind, parsed.defaultRunProperties || {}, metadata))
  }
  return result
}
function paragraphDeclaration(p, paragraph, kind, extra = {}) {
  const n = p.one(paragraph, 'pPr')
  const parsed = n ? listParagraphProperties(n, p) : { properties: {} }
  return {
    paragraph: entry(p, n || paragraph, kind, parsed.properties, extra),
    run: entry(p, n || paragraph, kind, parsed.defaultRunProperties || {}, extra),
  }
}
function shapeLayers(p, source, prefix = '') {
  const node = p.nodes.get(source.id),
    ph = placeholder(p, node)
  const body = p.one(node, 'txBody', P_URIS)
  if (!body) p.fail(node, 'shape has no native text body')
  const extra = ph ? { placeholder: ph } : {}
  const list = readSemanticTextListStyle({
    source,
    node,
    xml: p.xml,
    nodes: p.nodes,
    components: p.definitions.filter((d) => d.id !== source.id),
  })
  const lists = { paragraph: [], run: [] }
  for (const e of list?.listStyle.entries || []) {
    const n = [...p.paths.keys()].find((n) => p.paths.get(n).join('.') === e.source.path)
    const metadata = { ...extra, ...(e.level !== undefined ? { level: e.level } : {}) }
    lists.paragraph.push(
      entry(p, n, prefix ? `${prefix}List` : 'shapeList', e.properties, metadata, e.componentId)
    )
    lists.run.push(
      entry(
        p,
        n,
        prefix ? `${prefix}List` : 'shapeList',
        e.defaultRunProperties || {},
        metadata,
        e.componentId
      )
    )
  }
  const bodyProps = readSemanticTextBody(
    body,
    { source, node, nodes: p.nodes, xml: p.xml },
    (_, detail) => p.fail(body, detail)
  )
  const bodyEntry = entry(
    p,
    p.one(body, 'bodyPr') || body,
    prefix ? `${prefix}Body` : 'body',
    bodyProps || {},
    extra
  )
  const style = p.one(node, 'style', P_URIS),
    ref = p.one(style, 'fontRef')
  let fontReference
  if (ref) {
    const attrs = p.attrs(ref, ['idx'])
    if (!['major', 'minor', 'none'].includes(attrs.idx)) p.fail(ref, 'font reference index')
    p.children(ref, ['srgbClr', 'schemeClr', 'prstClr'])
    if (ref.children.length > 1) p.fail(ref, 'font reference color')
    const props = {}
    if (attrs.idx !== 'none')
      for (const [key, script] of [
        ['fontLatin', 'lt'],
        ['fontEastAsian', 'ea'],
        ['fontComplexScript', 'cs'],
      ])
        props[key] = { typeface: `+${attrs.idx === 'major' ? 'mj' : 'mn'}-${script}` }
    if (ref.children.length) props.color = readTableColor(ref.children[0], p)
    fontReference = entry(p, ref, prefix ? `${prefix}FontReference` : 'fontReference', props, extra)
  }
  const paragraphs = body.children.filter((n) => A_URIS.has(n.uri) && n.local === 'p')
  return { p, source, node, ph, body: bodyEntry, lists, fontReference, paragraphs }
}
function runDeclaration(p, run) {
  const n = p.one(run, 'rPr')
  let properties = {}
  if (n) {
    const matches = p.definitions.filter((d) => p.nodes.get(d.id) === run)
    if (matches.length > 1) p.fail(run, 'ambiguous source component')
    properties = runProperties(n, p, true, matches[0]?.id).properties
  }
  // Source run actions are validated above but never inherited visual properties.
  return entry(p, n || run, 'run', properties)
}
module.exports = {
  placeholder,
  matchPlaceholder,
  entry,
  declarations,
  paragraphDeclaration,
  shapeLayers,
  runDeclaration,
}

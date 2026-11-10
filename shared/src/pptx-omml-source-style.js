const { normalizeOmmlDocument } = require('./pptx-omml-document')
const { token } = require('./pptx-omml-document-grammar')
const { runStyle, controlStyle, resolveOmmlFontFamily } = require('./pptx-omml-render-properties')
const { resolveProperty } = require('./pptx-style-resolution')
const { expandTextContext } = require('./pptx-semantic-text-context-codec')

const metricNodes = new Set([
  'f',
  'sSub',
  'sSup',
  'sSubSup',
  'sPre',
  'limLow',
  'limUpp',
  'nary',
  'rad',
  'd',
  'm',
  'eqArr',
  'acc',
  'bar',
  'borderBox',
  'groupChr',
])
function sourceFailure(node, detail, path) {
  const error = new TypeError(`Cannot render OMML ${node ? token(node) : 'source'}: ${detail}`)
  Object.assign(error, {
    code: 'PPTX_OMML_RENDER_UNSUPPORTED',
    componentId: node?.componentId,
    path,
  })
  throw error
}
function materializeOmmlFrame(mathFrame, textContext) {
  if (!textContext) return mathFrame
  // Derived compatibility data only; the canonical frame and source layers stay immutable.
  return { ...mathFrame, textContext: expandTextContext(textContext) }
}
function resolveOmmlSourceStyle(
  { mathFrame, textDefaults, theme, deferPaint = false } = {},
  fail = (detail) => sourceFailure(null, detail),
  fontInventory = false
) {
  // The paragraph default is a declaration; endParaRPr formats the paragraph mark,
  // not preceding equation runs. Occurrence defaults must already be source-resolved.
  const context = mathFrame?.textContext
  theme = context?.theme ?? theme
  const props = {},
    sourceProperties = {}
  if (context && context.paragraphs.length !== 1) fail('ambiguous containing paragraph')
  for (const property of ['fontLatin', 'fontSizePt', 'bold', 'italic', 'color']) {
    if (context) {
      const resolved = resolveProperty({
        layers: context.paragraphs[0].run,
        theme,
        scope: 'run',
        property,
      })
      sourceProperties[property] = resolved
      if (
        resolved.unsupportedReason &&
        !['property-not-defined', 'missing-theme-font'].includes(resolved.unsupportedReason) &&
        !(property === 'color' && (fontInventory || deferPaint))
      )
        fail(resolved.unsupportedReason)
      if (resolved.authored === null) continue
      // Keep unresolved font tokens until a glyph/control actually needs them:
      // a direct OMML run may shadow this inherited declaration completely.
      if (property === 'fontLatin')
        props.fontLatin = { typeface: resolved.resolved ?? resolved.authored.typeface }
      else if (property === 'color') {
        if (!fontInventory) {
          // A direct math run/control may shadow this paint. Unresolved inherited
          // color stays absent until an actual glyph or line consumes it.
          if (resolved.resolved?.alpha === 1)
            props.color = { kind: 'srgb', value: resolved.resolved.rgb }
          else if (!deferPaint) fail('unresolved source color')
        }
      } else {
        if (resolved.unsupportedReason) fail(resolved.unsupportedReason)
        props[property] = resolved.resolved
      }
    } else {
      const direct = mathFrame?.paragraph?.defaultRunProperties
      if (Object.hasOwn(direct ?? {}, property)) props[property] = direct[property]
      else if (Object.hasOwn(textDefaults?.run ?? {}, property))
        props[property] = textDefaults.run[property]
    }
  }
  const style = {
    fontFamily: props.fontLatin?.typeface,
    fontSize: props.fontSizePt === undefined ? undefined : (props.fontSizePt * 4) / 3,
    bold: props.bold ?? false,
    italic: props.italic ?? true,
    ...(context ? { sourceProperties } : {}),
  }
  if (props.color && !fontInventory) {
    const c = props.color
    if (c.transforms?.length && !deferPaint) fail('unsupported source color transforms')
    const hex = c.transforms?.length
      ? null
      : c.kind === 'srgb'
        ? c.value
        : c.kind === 'scheme'
          ? theme?.colors?.[theme?.colorMap?.[c.value] ?? c.value]
          : null
    if (/^[a-f0-9]{6}$/i.test(hex)) style.color = `#${hex}`
    else if (!deferPaint) fail('unresolved source color')
  }
  return style
}
function collectOmmlFontRequests(input, source = {}) {
  const document = normalizeOmmlDocument(input),
    paths = new Map(),
    requests = []
  function locate(node, path) {
    paths.set(node.componentId, path)
    node.children.forEach((child, i) => locate(child, [...path, i]))
  }
  locate(document.root, [])
  const theme = source.mathFrame?.textContext?.theme ?? source.theme
  const context = {
    options: { theme },
    fontInventory: true,
    fail: (node, detail) => sourceFailure(node, detail, paths.get(node.componentId)),
  }
  const initial = resolveOmmlSourceStyle(
    source,
    (detail) => context.fail(document.root, detail),
    true
  )
  function request(node, style) {
    const fontFamily = resolveOmmlFontFamily(style.fontFamily, theme, (detail) =>
      context.fail(node, detail)
    )
    if (typeof fontFamily !== 'string' || !fontFamily)
      context.fail(node, 'missing source font declaration')
    requests.push({
      componentId: node.componentId,
      path: paths.get(node.componentId),
      fontFamily,
      bold: Boolean(style.bold),
      italic: Boolean(style.italic),
    })
  }
  function visit(node, inherited) {
    const style = node.type === 'r' ? runStyle(node, inherited, context) : inherited
    if (node.type === 't') {
      if (node.text) request(node, style)
      return
    }
    if (metricNodes.has(node.type)) request(node, controlStyle(node, style, context))
    for (const child of node.children.filter((n) => !n.type.endsWith('Pr')))
      visit(child, child.type === 'fName' ? { ...style, italic: false } : style)
  }
  visit(document.root, initial)
  return requests
}
module.exports = {
  materializeOmmlFrame,
  resolveOmmlSourceStyle,
  resolveOmmlFontFamily,
  collectOmmlFontRequests,
  metricNodes,
}

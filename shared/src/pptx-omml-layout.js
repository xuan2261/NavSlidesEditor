const { normalizeOmmlDocument } = require('./pptx-omml-document')
const { token } = require('./pptx-omml-document-grammar')
const { row, glyph, validPaint } = require('./pptx-omml-layout-boxes')
const { readProperties, runStyle, controlStyle, value } = require('./pptx-omml-render-properties')
const { scripts, limits, nary, fraction } = require('./pptx-omml-layout-scripts')
const { radical, delimiter, decoration } = require('./pptx-omml-layout-decorations')
const { matrix, stack } = require('./pptx-omml-layout-matrix')
const { metricNodes } = require('./pptx-omml-source-style')

const metricNames = [
  'axisHeight',
  'ruleThickness',
  'scriptScale',
  'scriptShiftUp',
  'scriptShiftDown',
  'scriptGap',
  'fractionGap',
  'limitGap',
  'radicalGap',
  'radicalDegreeRaise',
  'delimiterGap',
  'columnGap',
  'rowGap',
  'accentGap',
]
function layoutOmmlDocument(input, options = {}) {
  const document = normalizeOmmlDocument(input),
    paths = new Map()
  function locate(node, path) {
    paths.set(node.componentId, path)
    node.children.forEach((child, index) => locate(child, [...path, index]))
  }
  locate(document.root, [])
  function fail(node, detail, code = 'PPTX_OMML_RENDER_UNSUPPORTED') {
    const error = new TypeError(`Cannot render OMML ${token(node)}: ${detail}`)
    Object.assign(error, { code, componentId: node.componentId, path: paths.get(node.componentId) })
    throw error
  }
  if (
    typeof options.measureText !== 'function' ||
    typeof options.getMathMetrics !== 'function' ||
    (!options.sourceStyle &&
      (typeof options.fontFamily !== 'string' ||
        !options.fontFamily ||
        !Number.isFinite(options.fontSize) ||
        options.fontSize <= 0 ||
        !validPaint(options.color)))
  )
    fail(document.root, 'font, RGB color, measureText and getMathMetrics are required')
  const context = { options, fail }
  function metrics(style, node) {
    let m
    try {
      m = options.getMathMetrics({ ...style })
    } catch (error) {
      fail(node, `math measurement failed: ${error.message}`, 'PPTX_OMML_MEASUREMENT_FAILED')
    }
    if (
      !m ||
      (options.sourceStyle
        ? metricNames.filter(
            (key) =>
              !['radicalDegreeRaise', 'delimiterGap', 'columnGap', 'rowGap', 'accentGap'].includes(
                key
              ) ||
              {
                radicalDegreeRaise: ['rad'],
                delimiterGap: ['d', 'nary'],
                columnGap: ['m'],
                rowGap: ['m', 'eqArr'],
                accentGap: ['acc', 'bar', 'borderBox', 'groupChr'],
              }[key].includes(node.type)
          )
        : metricNames
      ).some((key) => !Number.isFinite(m[key]) || m[key] < 0) ||
      m.scriptScale <= 0 ||
      m.scriptScale >= 1 ||
      m.ruleThickness <= 0
    )
      fail(node, 'invalid math metrics', 'PPTX_OMML_MEASUREMENT_FAILED')
    return m
  }
  function visit(node, inherited) {
    let style = inherited
    const argPr = node.children.find((n) => token(n) === 'm:argPr')
    if (argPr) {
      const size = Number(value(argPr.children[0]) ?? 0)
      style = { ...style, fontSize: style.fontSize * metrics(style, node).scriptScale ** -size }
    }
    if (node.type === 'r') style = runStyle(node, style, context)
    if (node.type === 't') return glyph(node, node.text, style, context)
    const props = node.type === 'r' ? {} : readProperties(node, context)
    const control = controlStyle(node, style, context),
      m = !options.sourceStyle || metricNodes.has(node.type) ? metrics(control, node) : null
    const args = node.children
      .filter((n) => !n.type.endsWith('Pr'))
      .map((child) => {
        const reduced = ['sub', 'sup', 'deg', 'lim'].includes(child.type)
        const childStyle = reduced ? { ...style, fontSize: style.fontSize * m.scriptScale } : style
        return visit(child, child.type === 'fName' ? { ...childStyle, italic: false } : childStyle)
      })
    let result
    switch (node.type) {
      case 'oMath':
      case 'e':
      case 'num':
      case 'den':
      case 'deg':
      case 'sub':
      case 'sup':
      case 'fName':
      case 'lim':
      case 'mr':
      case 'func':
        result = row(node, args)
        break
      case 'r':
        args.forEach((a) => {
          a.y = (style.offset || 0) - (style.baseline || 0) * style.fontSize
        })
        result = row(node, args)
        break
      case 'oMathPara':
        if (props.jc === 'centerGroup')
          fail(node.children[0], 'centerGroup alignment requires paragraph context')
        if (args.length !== 1)
          fail(node, 'multiple equations require paragraph line-layout context')
        result = row(node, args)
        result.justification = props.jc ?? 'center'
        break
      case 'f':
        result = fraction(node, args, props, control, m, context)
        break
      case 'sSub':
      case 'sSup':
      case 'sSubSup':
      case 'sPre':
        result = scripts(node, args, m, node.type === 'sPre')
        break
      case 'limLow':
      case 'limUpp':
        result = limits(
          node,
          args[0],
          node.type === 'limLow' ? args[1] : null,
          node.type === 'limUpp' ? args[1] : null,
          m,
          args
        )
        break
      case 'nary':
        result = nary(node, args, props, control, m, context)
        break
      case 'rad':
        result = radical(node, args, props, control, m, context)
        break
      case 'd':
        result = delimiter(node, args, props, control, m, context)
        break
      case 'm':
        result = matrix(node, args, props, m)
        break
      case 'eqArr':
        result = stack(node, args, props, m)
        break
      case 'acc':
      case 'bar':
      case 'box':
      case 'borderBox':
      case 'groupChr':
      case 'phant':
        result = decoration(node, args[0], props, control, m, context)
        break
      default:
        fail(node, 'unsupported layout node')
    }
    if (result.primitives.some((p) => p.kind === 'line' && !validPaint(p.color)))
      fail(node, 'source RGB color declaration required')
    if (![result.width, result.ascent, result.descent].every((n) => Number.isFinite(n) && n >= 0))
      fail(node, 'non-finite layout', 'PPTX_OMML_MEASUREMENT_FAILED')
    return result
  }
  const style = {
    fontFamily: options.fontFamily,
    fontSize: options.fontSize,
    color: options.color,
    bold: options.bold ?? false,
    italic: options.italic ?? true,
  }
  const layout = visit(document.root, style)
  return { document, layout }
}
module.exports = { layoutOmmlDocument }

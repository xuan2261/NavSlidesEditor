const { box, fit, row, glyph, hidden } = require('./pptx-omml-layout-boxes')
const { on } = require('./pptx-omml-render-properties')

const occupied = (b) => b && !b.hidden && (b.width > 0 || b.ascent > 0 || b.descent > 0)
function scripts(node, args, metrics, before = false) {
  const base = args.find((a) => a.type === 'e')
  const sub = args.find((a) => a.type === 'sub' && occupied(a))
  const sup = args.find((a) => a.type === 'sup' && occupied(a))
  if (sup) sup.y = -Math.max(metrics.scriptShiftUp, base.ascent - metrics.axisHeight)
  if (sub) sub.y = Math.max(metrics.scriptShiftDown, base.descent + metrics.scriptGap)
  if (sub && sup) {
    const missing = metrics.scriptGap - (sub.y - sub.ascent - sup.y - sup.descent)
    if (missing > 0) {
      sub.y += missing / 2
      sup.y -= missing / 2
    }
  }
  const width = Math.max(sub?.width || 0, sup?.width || 0)
  if (before) {
    base.x = width
    if (sub) sub.x = width - sub.width
    if (sup) sup.x = width - sup.width
  } else {
    if (sub) sub.x = base.width
    if (sup) sup.x = base.width
  }
  return fit(box(node, args))
}
function limits(node, base, lower, upper, metrics, children) {
  const width = Math.max(base.width, lower?.width || 0, upper?.width || 0)
  base.x = (width - base.width) / 2
  if (occupied(lower)) {
    lower.x = (width - lower.width) / 2
    lower.y = base.descent + metrics.limitGap + lower.ascent
  }
  if (occupied(upper)) {
    upper.x = (width - upper.width) / 2
    upper.y = -base.ascent - metrics.limitGap - upper.descent
  }
  return fit(box(node, children || [base, lower, upper].filter(Boolean)))
}
function nary(node, args, props, style, metrics, context) {
  const [sub, sup, body] = args
  if (props.subHide !== undefined && on(props.subHide)) hidden(sub)
  if (props.supHide !== undefined && on(props.supHide)) hidden(sup)
  if (props.grow !== undefined && on(props.grow))
    context.fail(node.children[0], 'growing n-ary glyph assembly requires a font MATH adapter')
  const operator = glyph(node, props.chr ?? '\u222b', style, context)
  operator.type = 'e'
  const underOver = (props.limLoc ?? 'subSup') === 'undOvr'
  const operatorBox = underOver
    ? limits(node, operator, sub.hidden ? null : sub, sup.hidden ? null : sup, metrics)
    : scripts(node, [operator, sub, sup], metrics)
  body.x = operatorBox.width + metrics.delimiterGap
  // Synthetic operator geometry is paint, not an invented source component.
  const result = fit(box(node, [sub, sup, body]))
  result.primitives.push(
    ...operator.primitives.map((p) => ({
      ...p,
      x: p.x + operator.x,
      y: p.y + operator.y,
    }))
  )
  result.width = Math.max(result.width, operatorBox.width)
  result.ascent = Math.max(result.ascent, operatorBox.ascent)
  result.descent = Math.max(result.descent, operatorBox.descent)
  return result
}
function fraction(node, args, props, style, metrics, context) {
  const [num, den] = args,
    type = props.type ?? 'bar'
  if (type === 'lin' || type === 'skw') {
    const slash = glyph(node, '\u2044', style, context)
    if (type === 'skw') {
      num.y = -metrics.scriptShiftUp
      den.y = metrics.scriptShiftDown
    }
    const result = row(node, [num, slash, den], metrics.fractionGap)
    result.children = args
    result.primitives = slash.primitives.map((p) => ({ ...p, x: p.x + slash.x }))
    return result
  }
  const native = Number.isFinite(metrics.fractionNumeratorShiftUp)
  // Vertical clearance is not horizontal padding. With actual MATH constants,
  // use the independent numerator/denominator minimum shifts and clearances.
  const width = Math.max(num.width, den.width) + (native ? 0 : 2 * metrics.fractionGap)
  num.x = (width - num.width) / 2
  den.x = (width - den.width) / 2
  const halfRule = type === 'noBar' ? 0 : metrics.ruleThickness / 2
  num.y = -metrics.axisHeight - halfRule - metrics.fractionGap - num.descent
  den.y = -metrics.axisHeight + halfRule + metrics.fractionGap + den.ascent
  if (native && type === 'bar') {
    num.y = -Math.max(metrics.fractionNumeratorShiftUp,
      metrics.axisHeight + halfRule + metrics.fractionNumeratorGapMin + num.descent)
    den.y = Math.max(metrics.fractionDenominatorShiftDown,
      den.ascent - metrics.axisHeight + halfRule + metrics.fractionDenominatorGapMin)
  } else if (native && type === 'noBar') {
    num.y = -metrics.stackTopShiftUp
    den.y = metrics.stackBottomShiftDown
    const missing = metrics.stackGapMin - (den.y - den.ascent - num.y - num.descent)
    if (missing > 0) { num.y -= missing / 2; den.y += missing / 2 }
  }
  const result = fit(box(node, args), width)
  if (type === 'bar')
    result.primitives.push({
      kind: 'line',
      x1: 0,
      x2: width,
      y1: -metrics.axisHeight,
      y2: -metrics.axisHeight,
      strokeWidth: metrics.ruleThickness,
      color: style.color,
    })
  return result
}
module.exports = { scripts, limits, nary, fraction }

const { box, fit, glyph, stretch, line, hidden } = require('./pptx-omml-layout-boxes')
const { on } = require('./pptx-omml-render-properties')

function paintGlyph(target, source, x, y) {
  const sx = source.scaleX ?? 1,
    sy = source.scaleY ?? 1
  target.primitives.push(
    ...source.primitives.map((p) => ({
      ...p,
      x: x + p.x * sx,
      y: y + p.y * sy,
      scaleX: sx,
      scaleY: sy,
    }))
  )
  target.width = Math.max(target.width, x + source.width)
  target.ascent = Math.max(target.ascent, source.ascent - y)
  target.descent = Math.max(target.descent, source.descent + y)
}
function radical(node, args, props, style, m, context) {
  const [degree, body] = args
  if (props.degHide !== undefined && on(props.degHide)) hidden(degree)
  const top = -body.ascent - m.radicalGap - m.ruleThickness
  const sign = stretch(glyph(node, '\u221a', style, context), body.descent - top)
  const prefix = degree.hidden ? 0 : degree.width
  body.x = prefix + sign.width
  if (degree.width || degree.ascent || degree.descent) degree.y = -m.radicalDegreeRaise
  const result = fit(box(node, args, [line(body.x, top, body.x + body.width, top, m, style)]))
  paintGlyph(result, sign, prefix, top + sign.ascent)
  return result
}
function delimiter(node, args, props, style, m, context) {
  const contentAscent = Math.max(...args.map((a) => a.ascent))
  const contentDescent = Math.max(...args.map((a) => a.descent))
  const centered = (props.shp ?? 'centered') === 'centered'
  const half = Math.max(contentAscent - m.axisHeight, contentDescent + m.axisHeight)
  const height = centered ? 2 * half : contentAscent + contentDescent
  const result = box(node, args)
  let x = 0
  function add(text) {
    if (!text) return
    const g = glyph(node, text, style, context)
    if (props.grow === undefined || on(props.grow))
      stretch(g, Math.max(height, g.ascent + g.descent))
    const y = centered
      ? (g.ascent - g.descent) / 2 - m.axisHeight
      : (contentDescent - contentAscent + g.ascent - g.descent) / 2
    paintGlyph(result, g, x, y)
    x += g.width + m.delimiterGap
  }
  add(props.begChr ?? '(')
  args.forEach((child, index) => {
    if (index) add(props.sepChr ?? '|')
    child.x = x
    x += child.width + m.delimiterGap
  })
  add(props.endChr ?? ')')
  const ink = { width: result.width, ascent: result.ascent, descent: result.descent }
  fit(result)
  for (const key of Object.keys(ink)) result[key] = Math.max(result[key], ink[key])
  return result
}
function decoration(node, body, props, style, m, context) {
  const result = box(node, [body])
  if (node.type === 'phant') {
    result.hidden = props.show === undefined || !on(props.show)
    fit(result)
    for (const [property, dimension] of [
      ['zeroWid', 'width'],
      ['zeroAsc', 'ascent'],
      ['zeroDesc', 'descent'],
    ]) {
      if (props[property] !== undefined && on(props[property])) {
        if (!result.hidden)
          context.fail(node, 'visible zero-extent phantom requires ink-overflow layout')
        result[dimension] = 0
      }
    }
    return result
  }
  if (node.type === 'box') return fit(result)
  const bottom = (props.pos ?? (node.type === 'groupChr' ? 'bot' : 'top')) === 'bot'
  if (node.type === 'acc' || node.type === 'groupChr') {
    const mark = stretch(
      glyph(node, props.chr ?? (node.type === 'acc' ? '\u0302' : '\u23df'), style, context),
      undefined,
      body.width
    )
    fit(result)
    paintGlyph(
      result,
      mark,
      0,
      bottom ? body.descent + m.accentGap + mark.ascent : -body.ascent - m.accentGap - mark.descent
    )
    return result
  }
  if (node.type === 'bar') {
    const y = bottom ? body.descent + m.accentGap : -body.ascent - m.accentGap
    result.primitives.push(line(0, y, body.width, y, m, style))
    return fit(result)
  }
  const pad = m.accentGap + m.ruleThickness / 2
  body.x = pad
  const left = m.ruleThickness / 2,
    right = body.width + 2 * pad - left
  const top = -body.ascent - pad,
    bot = body.descent + pad
  const edges = {
    hideTop: [left, top, right, top],
    hideBot: [left, bot, right, bot],
    hideLeft: [left, top, left, bot],
    hideRight: [right, top, right, bot],
  }
  for (const [name, points] of Object.entries(edges))
    if (props[name] === undefined || !on(props[name]))
      result.primitives.push(line(...points, m, style))
  const strikes = {
    strikeH: [left, (top + bot) / 2, right, (top + bot) / 2],
    strikeV: [(left + right) / 2, top, (left + right) / 2, bot],
    strikeBLTR: [left, bot, right, top],
    strikeTLBR: [left, top, right, bot],
  }
  for (const [name, points] of Object.entries(strikes))
    if (props[name] !== undefined && on(props[name]))
      result.primitives.push(line(...points, m, style))
  return fit(result, body.width + 2 * pad)
}
module.exports = { radical, delimiter, decoration }

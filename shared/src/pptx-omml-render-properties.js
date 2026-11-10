const { token } = require('./pptx-omml-document-grammar')
const value = (node, name = 'val') => node?.attributes.find((a) => a.name === name)?.value
const on = (v) => v === undefined || v === true || ['1', 'true', 'on'].includes(v)
function resolveOmmlFontFamily(family, theme, fail) {
  if (!family?.startsWith('+')) return family
  const match = /^\+(mj|mn)-(lt|ea|cs)$/.exec(family)
  const face = match && theme?.fonts?.[match[1] === 'mj' ? 'major' : 'minor']?.[
    { lt: 'latin', ea: 'eastAsian', cs: 'complexScript' }[match[2]]]
  if (!face || face.startsWith('+')) fail('unresolved theme font')
  return face
}
const properties = {
  oMathPara: 'jc',
  f: 'type',
  rad: 'degHide',
  sSub: '',
  sSup: '',
  sSubSup: '',
  sPre: '',
  nary: 'chr limLoc grow subHide supHide',
  d: 'begChr sepChr endChr grow shp',
  eqArr: 'baseJc',
  m: 'baseJc mcs',
  acc: 'chr',
  bar: 'pos',
  box: '',
  borderBox: 'hideTop hideBot hideLeft hideRight strikeH strikeV strikeBLTR strikeTLBR',
  groupChr: 'chr pos',
  phant: 'show zeroWid zeroAsc zeroDesc',
  func: '',
  limLow: '',
  limUpp: '',
}
function readProperties(node, context) {
  const pr = node.children.find((child) => token(child) === `m:${node.type}Pr`)
  const result = {}
  if (!pr) return result
  for (const child of pr.children) {
    if (child.type === 'ctrlPr') continue
    if (!(properties[node.type] || '').split(' ').includes(child.type))
      context.fail(child, `unsupported ${token(child)} property`)
    result[child.type] =
      value(child) ?? (['chr', 'begChr', 'endChr', 'sepChr'].includes(child.type) ? '' : true)
  }
  return result
}
function applyRunProperties(pr, inherited, context) {
  const style = { ...inherited }
  if (!pr) return style
  const family = token(pr).split(':')[0]
  if (family === 'a') {
    for (const a of pr.attributes) {
      if (context.fontInventory && !['b', 'i'].includes(a.name)) continue
      // Retained proofing metadata does not participate in visual style.
      if (['dirty', 'err', 'smtClean', 'noProof'].includes(a.name)) continue
      if (a.name === 'sz') style.fontSize = ((Number(a.value) / 100) * 96) / 72
      else if (a.name === 'b') style.bold = on(a.value)
      else if (a.name === 'i') style.italic = on(a.value)
      else if (a.name === 'baseline') style.baseline = Number(a.value) / 100000
      else if (['lang', 'altLang'].includes(a.name)) style[a.name] = a.value
      else context.fail(pr, `unsupported DrawingML ${a.name}`)
    }
  }
  for (const p of pr.children) {
    if (context.fontInventory && ['a:solidFill', 'w:sz', 'w:szCs', 'w:position', 'w:color',
      'w:spacing', 'w:kern', 'w:u', 'w:strike', 'w:dstrike', 'w:highlight', 'w:noProof',
      'w:lang', 'w:vertAlign'].includes(token(p))) continue
    const v = value(p)
    switch (token(p)) {
      case 'm:sty':
        style.bold = ['b', 'bi'].includes(v)
        style.italic = ['i', 'bi'].includes(v)
        break
      case 'm:nor':
        if (on(v)) style.italic = false
        break
      case 'm:scr':
        if (v !== 'roman') context.fail(p, `unsupported math alphabet ${v}`)
        break
      case 'w:b':
        style.bold = on(v)
        break
      case 'w:i':
        style.italic = on(v)
        break
      case 'w:sz':
        style.fontSize = ((Number(v) / 2) * 96) / 72
        break
      case 'w:color':
        if (v !== 'auto') style.color = `#${v}`
        break
      case 'w:position':
        style.offset = ((-Number(v) / 2) * 96) / 72
        break
      case 'w:rFonts': {
        const attrs = p.attributes
        if (
          attrs.some((a) => !['ascii', 'hAnsi'].includes(a.name)) ||
          new Set(attrs.map((a) => a.value)).size > 1
        )
          context.fail(p, 'unsupported font selection')
        style.fontFamily = value(p, 'ascii') ?? value(p, 'hAnsi') ?? style.fontFamily
        break
      }
      case 'a:latin':
        if (p.attributes.some((a) => a.name !== 'typeface'))
          context.fail(p, 'unsupported font metadata')
        style.fontFamily = value(p, 'typeface')
        style.fontFamily = resolveOmmlFontFamily(style.fontFamily, context.options?.theme,
          (detail) => context.fail(p, detail))
        break
      case 'a:solidFill': {
        const color = p.children[0]
        const theme = context.options?.theme
        const hex = token(color) === 'a:srgbClr' ? value(color)
          : theme?.colors?.[theme?.colorMap?.[value(color)] ?? value(color)]
        if (!hex) context.fail(color, 'unresolved scheme color')
        const { resolveGeometryColorPaint } = require('./pptx-geometry-color')
        const paint = resolveGeometryColorPaint({ kind: 'srgb', value: hex,
          transforms: color.children.map(child => ({ kind: child.type, value: Number(value(child)) })) })
        if (paint.alpha === 1) style.color = `#${paint.rgb}`
        else {
          const channels = paint.rgb.match(/../g).map(channel => parseInt(channel, 16))
          style.color = `rgba(${channels.join(',')},${paint.alpha})`
        }
        break
      }
      case 'w:noProof':
        break
      default:
        context.fail(p, `unsupported run property ${token(p)}`)
    }
  }
  return style
}
function runStyle(node, style, context) {
  for (const pr of node.children.filter((child) => child.type === 'rPr'))
    style = applyRunProperties(pr, style, context)
  return style
}
function controlStyle(node, style, context) {
  const control = node.children
    .find((child) => child.type === `${node.type}Pr`)
    ?.children.find((child) => child.type === 'ctrlPr')
  const pr = control?.children[0]
  const position = pr?.children.find((child) => token(child) === 'w:position')
  if (position && !context.fontInventory)
    context.fail(position, 'positioned control formatting requires operator baseline layout')
  if (!context.fontInventory && pr?.attributes.some((a) => a.name === 'baseline'))
    context.fail(pr, 'positioned control formatting requires operator baseline layout')
  return applyRunProperties(pr, style, context)
}
module.exports = { value, on, readProperties, runStyle, controlStyle, resolveOmmlFontFamily }

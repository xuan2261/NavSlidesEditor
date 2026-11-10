const { GEOMETRY_COLOR_TRANSFORM_RANGES } = require('./pptx-geometry-color-ranges')
// Native names and lexical values are canonical. Namespace prefixes are not.
const M = 'http://schemas.openxmlformats.org/officeDocument/2006/math'
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const XML = 'http://www.w3.org/XML/1998/namespace'
const namespaces = {
  [M]: 'm', 'http://purl.oclc.org/ooxml/officeDocument/math': 'm',
  [W]: 'w', 'http://purl.oclc.org/ooxml/wordprocessingml/main': 'w',
  [A]: 'a', 'http://purl.oclc.org/ooxml/drawingml/main': 'a', [XML]: 'xml', '': '',
}
const token = (node) => `${namespaces[node.namespaceUri] ?? '?'}:${node.type}`
const choice = (values) => (value) => values.split(' ').includes(value)
const boolean = choice('0 1 true false on off')
const integer = (min, max) => (value) => /^-?\d+$/.test(value) &&
  Number.isSafeInteger(Number(value)) && Number(value) >= min && Number(value) <= max
const character = (value) => [...value].length <= 1
const string = (value) => value.length <= 1024
const mathAtoms = 'm:(?:acc|bar|box|borderBox|d|eqArr|f|func|groupChr|limLow|limUpp|m|nary|phant|r|rad|sPre|sSub|sSubSup|sSup)'
const grammar = {}
const sequence = (key, expression, attrs = {}) => {
  grammar[key] = { sequence: new RegExp(`^(?:${expression})$`), attrs }
}
const properties = (key, names) => { grammar[key] = { properties: names.split(' ').map((name) => `m:${name}`), attrs: {} } }
sequence('m:oMath', `(?:${mathAtoms},)*`)
sequence('m:oMathPara', '(?:m:oMathParaPr,)?(?:m:oMath,)+')
for (const name of ['e', 'num', 'den', 'deg', 'sub', 'sup', 'fName', 'lim'])
  sequence(`m:${name}`, `(?:m:argPr,)?(?:${mathAtoms},)*`)
for (const [name, expression] of Object.entries({
  f: '(?:m:fPr,)?m:num,m:den,', rad: '(?:m:radPr,)?m:deg,m:e,',
  sSub: '(?:m:sSubPr,)?m:e,m:sub,', sSup: '(?:m:sSupPr,)?m:e,m:sup,',
  sSubSup: '(?:m:sSubSupPr,)?m:e,m:sub,m:sup,', sPre: '(?:m:sPrePr,)?m:sub,m:sup,m:e,',
  nary: '(?:m:naryPr,)?m:sub,m:sup,m:e,', d: '(?:m:dPr,)?(?:m:e,)+',
  eqArr: '(?:m:eqArrPr,)?(?:m:e,)+', m: '(?:m:mPr,)?(?:m:mr,)+',
  mr: '(?:m:e,)+', func: '(?:m:funcPr,)?m:fName,m:e,',
  limLow: '(?:m:limLowPr,)?m:e,m:lim,', limUpp: '(?:m:limUppPr,)?m:e,m:lim,',
  r: '(?:m:rPr,)?(?:w:rPr,|a:rPr,)?m:t,',
})) sequence(`m:${name}`, expression)
for (const name of ['acc', 'bar', 'box', 'borderBox', 'groupChr', 'phant'])
  sequence(`m:${name}`, `(?:m:${name}Pr,)?m:e,`)
sequence('m:t', '', { 'xml:space': choice('default preserve') })
for (const [name, fields] of Object.entries({
  oMathParaPr: 'jc', fPr: 'type ctrlPr', radPr: 'degHide ctrlPr',
  sSubPr: 'ctrlPr', sSupPr: 'ctrlPr', sSubSupPr: 'alnScr ctrlPr', sPrePr: 'ctrlPr',
  naryPr: 'chr limLoc grow subHide supHide ctrlPr', dPr: 'begChr sepChr endChr grow shp ctrlPr',
  eqArrPr: 'baseJc maxDist objDist rSpRule rSp ctrlPr',
  mPr: 'baseJc plcHide rSpRule cGpRule rSp cSp cGp mcs ctrlPr',
  accPr: 'chr ctrlPr', barPr: 'pos ctrlPr',
  boxPr: 'opEmu noBreak diff brk aln ctrlPr',
  borderBoxPr: 'hideTop hideBot hideLeft hideRight strikeH strikeV strikeBLTR strikeTLBR ctrlPr',
  groupChrPr: 'chr pos vertJc ctrlPr', phantPr: 'show zeroWid zeroAsc zeroDesc transp ctrlPr',
  funcPr: 'ctrlPr', limLowPr: 'ctrlPr', limUppPr: 'ctrlPr',
  rPr: 'lit nor scr sty brk aln',
  mcPr: 'count mcJc', argPr: 'argSz',
})) properties(`m:${name}`, fields)
sequence('m:mcs', '(?:m:mc,)+')
sequence('m:mc', 'm:mcPr,')
sequence('m:ctrlPr', '(?:w:rPr,|a:rPr,)?')
const mathValues = {
  jc: choice('left right center centerGroup'), type: choice('bar skw lin noBar'),
  sty: choice('p b i bi'), scr: choice('roman script fraktur double-struck sans-serif monospace'),
  limLoc: choice('subSup undOvr'), shp: choice('centered match'),
  baseJc: choice('top center bottom'), pos: choice('top bot'), vertJc: choice('top bot'),
  mcJc: choice('left center right'), chr: character, begChr: character, endChr: character, sepChr: character,
  rSpRule: integer(0, 4), cGpRule: integer(0, 4), rSp: integer(0, 2147483647),
  cSp: integer(0, 2147483647), cGp: integer(0, 2147483647), count: integer(1, 65535),
  argSz: integer(-2, 2),
}
const requiredMathValues = new Set(Object.keys(mathValues).filter((name) =>
  !['chr', 'begChr', 'endChr', 'sepChr'].includes(name)))
for (const name of ('degHide alnScr grow subHide supHide maxDist objDist plcHide opEmu noBreak diff aln ' +
  'hideTop hideBot hideLeft hideRight strikeH strikeV strikeBLTR strikeTLBR show zeroWid zeroAsc zeroDesc transp lit nor').split(' '))
  mathValues[name] = boolean
for (const [name, validate] of Object.entries(mathValues))
  sequence(`m:${name}`, '', { 'm:val': validate })
for (const name of requiredMathValues) grammar[`m:${name}`].required = ['m:val']
sequence('m:brk', '', { 'm:alnAt': integer(1, 255) })
const wProperties = 'rFonts b bCs i iCs caps smallCaps strike dstrike outline shadow emboss imprint noProof snapToGrid vanish webHidden color spacing w kern position sz szCs highlight u vertAlign rtl cs lang'
grammar['w:rPr'] = { properties: wProperties.split(' ').map((name) => `w:${name}`), attrs: {} }
for (const name of 'b bCs i iCs caps smallCaps strike dstrike outline shadow emboss imprint noProof snapToGrid vanish webHidden rtl cs'.split(' '))
  sequence(`w:${name}`, '', { 'w:val': boolean })
for (const name of ['sz', 'szCs', 'kern']) sequence(`w:${name}`, '', { 'w:val': integer(0, 32767) })
for (const name of ['spacing', 'position']) sequence(`w:${name}`, '', { 'w:val': integer(-31680, 31680) })
sequence('w:w', '', { 'w:val': integer(1, 600) })
sequence('w:rFonts', '', Object.fromEntries('ascii hAnsi eastAsia cs asciiTheme hAnsiTheme eastAsiaTheme cstheme hint'.split(' ').map((name) => [`w:${name}`, string])))
sequence('w:lang', '', { 'w:val': string, 'w:eastAsia': string, 'w:bidi': string })
sequence('w:color', '', { 'w:val': (v) => /^(?:auto|[\da-fA-F]{6})$/.test(v) })
sequence('w:highlight', '', { 'w:val': choice('black blue cyan green magenta red yellow white darkBlue darkCyan darkGreen darkMagenta darkRed darkYellow darkGray lightGray none') })
sequence('w:u', '', { 'w:val': choice('single words double thick dotted dottedHeavy dash dashedHeavy dashLong dashLongHeavy dotDash dashDotHeavy dotDotDash dashDotDotHeavy wave wavyHeavy wavyDouble none'), 'w:color': string })
sequence('w:vertAlign', '', { 'w:val': choice('baseline superscript subscript') })
grammar['a:rPr'] = { properties: ['a:solidFill', 'a:latin', 'a:ea', 'a:cs', 'a:sym'], attrs: {
  ':lang': string, ':altLang': string, ':sz': integer(100, 400000), ':b': boolean, ':i': boolean,
  ':baseline': integer(-100000, 100000), ':spc': integer(-400000, 400000),
  ':kern': integer(0, 400000), ':u': choice('none words sng dbl heavy dotted dash wavy'),
  ':strike': choice('noStrike sngStrike dblStrike'),
  ':dirty': boolean, ':err': boolean, ':smtClean': boolean, ':noProof': boolean,
} }
for (const name of ['latin', 'ea', 'cs', 'sym'])
  sequence(`a:${name}`, '', { ':typeface': string, ':panose': string, ':pitchFamily': integer(0, 255), ':charset': integer(-128, 255) })
sequence('a:solidFill', 'a:srgbClr,|a:schemeClr,')
const colorTransforms = ['tint', 'shade', 'lumMod', 'lumOff', 'alpha', 'alphaMod', 'alphaOff']
for (const name of colorTransforms) {
  sequence(`a:${name}`, '', { ':val': integer(...GEOMETRY_COLOR_TRANSFORM_RANGES[name]) })
  grammar[`a:${name}`].required = [':val']
}
const colorSequence = `(?:a:(?:${colorTransforms.join('|')}),)*`
sequence('a:srgbClr', colorSequence, { ':val': (v) => /^[\da-fA-F]{6}$/.test(v) })
sequence('a:schemeClr', colorSequence, { ':val': choice('dk1 lt1 dk2 lt2 accent1 accent2 accent3 accent4 accent5 accent6 hlink folHlink phClr bg1 tx1 bg2 tx2') })
for (const name of ['sz', 'szCs', 'kern', 'spacing', 'position', 'w', 'color', 'highlight', 'vertAlign'])
  grammar[`w:${name}`].required = ['w:val']
for (const name of ['latin', 'ea', 'cs', 'sym']) grammar[`a:${name}`].required = [':typeface']
for (const name of ['srgbClr', 'schemeClr']) grammar[`a:${name}`].required = [':val']

function validateOmmlNode(node, fail) {
  const key = token(node), rule = grammar[key]
  if (!rule) fail('unsupported element or namespace')
  if (['a:srgbClr', 'a:schemeClr'].includes(key) && node.children.length > 32)
    fail('color transform limit')
  const children = node.children.map(token), seen = new Set()
  if (rule.sequence && !rule.sequence.test(children.map((name) => `${name},`).join('')))
    fail('invalid child sequence/cardinality')
  if (rule.properties) for (const child of children) {
    if (!rule.properties.includes(child) || seen.has(child)) fail('unsupported/duplicate property')
    seen.add(child)
  }
  seen.clear()
  for (const attr of node.attributes) {
    const name = `${namespaces[attr.namespaceUri] ?? '?'}:${attr.name}`
    if (seen.has(name) || !Object.hasOwn(rule.attrs, name) || !rule.attrs[name](attr.value))
      fail(`unsupported/invalid attribute ${name}`)
    seen.add(name)
  }
  if (rule.required?.some((name) => !seen.has(name))) fail('missing required attribute')
  const textNode = key === 'm:t'
  if (textNode !== Object.hasOwn(node, 'text') || (textNode && typeof node.text !== 'string'))
    fail('invalid text ownership')
  if (!textNode && node.text !== undefined) fail('unexpected text')
  if (key === 'm:m') {
    const rows = node.children.filter((child) => child.type === 'mr')
    if (rows.some((row) => row.children.length !== rows[0].children.length)) fail('ragged matrix')
    const mcs = node.children.find((child) => child.type === 'mPr')?.children.find((child) => child.type === 'mcs')
    if (mcs) {
      const columns = mcs.children.reduce((sum, column) => sum + Number(column.children[0]?.children
        .find((child) => child.type === 'count')?.attributes[0]?.value ?? 1), 0)
      if (columns !== rows[0].children.length) fail('matrix column declaration mismatch')
    }
  }
}
module.exports = { validateOmmlNode, token, M, W, A, XML }

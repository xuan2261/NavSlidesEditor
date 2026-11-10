const { normalizeTextProperties } = require('../../../shared/src/pptx-text-document')
const { readTableColor } = require('./ooxml-semantic-table-properties')
const { readRunHyperlink } = require('./ooxml-semantic-run-hyperlink')

function fontDescriptor(node, source) {
  source.children(node)
  const font = source.attrs(node, ['typeface', 'panose', 'pitchFamily', 'charset'])
  if (font.panose !== undefined) font.panose = font.panose.trim()
  for (const key of ['pitchFamily', 'charset'])
    if (font[key] !== undefined)
      font[key] = source.number(node, font[key].trim().replace(/^\+(?=\d)/, ''), -128, 127)
  // Validate at the descriptor node so malformed scalars retain its locator.
  return source.checked(node, () => normalizeTextProperties({ fontLatin: font }, 'run')).fontLatin
}
function readTextOutline(node, source) {
  const attributes = source.attrs(node, ['w', 'cap', 'cmpd', 'algn']), result = {}
  source.children(node, ['noFill', 'solidFill', 'prstDash', 'round'])
  if (attributes.w !== undefined) result.width = source.number(node, attributes.w, 0, 20116800)
  for (const [native, key] of [['cap', 'cap'], ['cmpd', 'compound'], ['algn', 'alignment']])
    if (attributes[native] !== undefined) result[key] = attributes[native]
  for (const child of node.children) {
    if (['noFill', 'solidFill'].includes(child.local)) {
      if (result.color || result.fill) source.fail(child, 'conflicting line fill')
      result.fill = child.local === 'noFill' ? 'none' : 'solid'
      source.attrs(child)
      if (child.local === 'noFill') {
        source.children(child)
        result.color = { kind: 'none' }
      } else {
        source.children(child, ['srgbClr', 'schemeClr', 'prstClr', 'sysClr'])
        if (child.children.length !== 1) source.fail(child, 'missing/duplicate fill color')
        result.color = readTableColor(child.children[0], source)
      }
    } else if (child.local === 'prstDash') {
      source.children(child)
      result.dash = { kind: 'preset', value: source.attrs(child, ['val']).val }
    } else {
      source.attrs(child)
      source.children(child)
      result.join = { kind: child.local }
    }
  }
  return source.checked(node, () => normalizeTextProperties({ outline: result }, 'run')).outline
}


function runProperties(node, source, proofing = false, runId) {
  const fields = { sz: 'fontSizePt', b: 'bold', i: 'italic', lang: 'language', altLang: 'altLanguage',
    u: 'underline', strike: 'strike', baseline: 'baseline', spc: 'spacingPt', kern: 'kerningPt',
    kumimoji: 'kumimoji', cap: 'capitalization', normalizeH: 'normalizeHeight' }
  const attrs = source.attrs(node, [...Object.keys(fields), ...(proofing ? ['smtClean', 'dirty', 'err', 'noProof'] : [])])
  const result = { properties: {} }, props = result.properties
  for (const [key, value] of Object.entries(attrs)) {
    if (['smtClean', 'dirty', 'err', 'noProof'].includes(key))
      (result.proofing ||= {})[key] = source.boolean(node, value.trim())
    else props[fields[key]] = ['b', 'i', 'kumimoji', 'normalizeH'].includes(key) ? source.boolean(node, value) :
      ['sz', 'spc', 'kern'].includes(key) ? source.number(node, value, -400000, 400000) / 100 :
        key === 'baseline' ? source.number(node, value, -100000, 100000) : value
  }
  source.children(node, ['latin', 'ea', 'cs', 'sym', 'solidFill', 'highlight', 'rtl', 'hlinkClick', 'hlinkMouseOver', 'ln', 'effectLst', 'uLnTx', 'uFillTx'])
  for (const child of node.children) {
    if (child.local === 'rtl') {
      source.children(child)
      props.direction = source.boolean(child, source.attrs(child, ['val']).val) ? 'rtl' : 'ltr'
    } else if (['hlinkClick', 'hlinkMouseOver'].includes(child.local)) {
      const trigger = child.local === 'hlinkClick' ? 'click' : 'hover'
      ;(result.hyperlinks ||= {})[trigger] = readRunHyperlink(child, source, runId)
    } else if (['solidFill', 'highlight'].includes(child.local)) {
      source.attrs(child)
      source.children(child, ['srgbClr', 'schemeClr', 'prstClr', 'sysClr'])
      if (child.children.length !== 1) source.fail(child, 'missing/duplicate text color')
      props[child.local === 'highlight' ? 'highlight' : 'color'] = readTableColor(child.children[0], source)
    } else if (child.local === 'ln') {
      props.outline = readTextOutline(child, source)
    } else if (['effectLst', 'uLnTx', 'uFillTx'].includes(child.local)) {
      source.attrs(child)
      source.children(child)
    } else {
      const font = fontDescriptor(child, source)
      props[{ latin: 'fontLatin', ea: 'fontEastAsian', cs: 'fontComplexScript', sym: 'fontSymbol' }[child.local]] = font
    }
  }
  source.checked(node, () => normalizeTextProperties(props, 'run'))
  return result
}


function bodyProperties(node, source) {
  const fields = { lIns: 'insetLeftEmu', rIns: 'insetRightEmu', tIns: 'insetTopEmu', bIns: 'insetBottomEmu',
    anchor: 'verticalAlign', anchorCtr: 'anchorCenter', vert: 'verticalText', rot: 'rotation',
    wrap: 'wrap', spcFirstLastPara: 'spaceFirstLastParagraph', numCol: 'columnCount', compatLnSpc: 'compatibleLineSpacing' }
  const attrs = source.attrs(node, Object.keys(fields)), result = {}
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'wrap') {
      if (!['square', 'none'].includes(value)) source.fail(node, 'invalid wrap')
      result.wrap = value === 'square'
    } else result[fields[key]] = ['anchorCtr', 'spcFirstLastPara', 'compatLnSpc'].includes(key) ? source.boolean(node, value) :
      key === 'numCol' ? source.number(node, value, 1, 16) :
      ['anchor', 'vert'].includes(key) ? value : source.number(node, value)
  }
  source.children(node, ['noAutofit', 'normAutofit', 'spAutoFit'])
  if (node.children.length > 1) source.fail(node.children[1], 'conflicting autofit')
  if (node.children.length) {
    const child = node.children[0]
    source.children(child)
    const a = source.attrs(child, child.local === 'normAutofit' ? ['fontScale', 'lnSpcReduction'] : [])
    result.autofit = { mode: { noAutofit: 'none', normAutofit: 'normal', spAutoFit: 'shape' }[child.local] }
    for (const [key, value] of Object.entries(a))
      result.autofit[key === 'fontScale' ? 'fontScale' : 'lineSpaceReduction'] = source.number(child, value, 0, 100000)
  }
  return source.checked(node, () => normalizeTextProperties(result, 'body'))
}
module.exports = { runProperties, bodyProperties, fontDescriptor, readTextOutline }

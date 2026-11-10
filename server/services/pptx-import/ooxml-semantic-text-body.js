const { A_URIS, P_URIS, decodeXml, descendants } = require('./ooxml-text-run-xml')
const { normalizeTextProperties } = require('../../../shared/src/pptx-text-document')

// No inferred defaults or opaque declaration bag. bodyPr has no standalone
// inventory ID: its exact direct shape/txBody ancestry owns these properties.
function readSemanticTextBody(txBody, context, fail) {
  const { source, node, nodes, xml } = context
  const invalid = (detail) => fail(source, `invalid/unsupported text body ${detail}`)
  const bodies = node.children.filter((entry) => P_URIS.has(entry.uri) && entry.local === 'txBody')
  const declarations = descendants(node, (entry) => A_URIS.has(entry.uri) && entry.local === 'bodyPr')
  if (
    nodes.get(source.id) !== node ||
    bodies.length > 1 ||
    (txBody ? bodies.length !== 1 || bodies[0] !== txBody : bodies.length !== 0) ||
    declarations.length > 1 ||
    declarations.some((entry) => !txBody?.children.includes(entry))
  )
    invalid('source association')
  if (!txBody) return undefined
  const attributes = (entry, allowed) => {
    const result = {}
    for (const attribute of entry.attrs) {
      if (attribute.name === 'xmlns' || attribute.name.startsWith('xmlns:')) continue
      if (!allowed.includes(attribute.name) || Object.hasOwn(result, attribute.name))
        invalid(`${entry.local} attribute ${attribute.name}`)
      const value = decodeXml(attribute.value)
      if (value === null) invalid(`${entry.local} attribute entity`)
      result[attribute.name] = value
    }
    return result
  }
  const container = (entry) => {
    if (entry.selfClosing) return
    let cursor = entry.end + 1
    for (const child of entry.children) {
      if (xml.slice(cursor, child.start).trim()) invalid(`${entry.local} text`)
      cursor = child.closeEnd + 1
    }
    if (xml.slice(cursor, entry.closeStart).trim()) invalid(`${entry.local} text`)
  }
  attributes(txBody, [])
  container(txBody)
  const bodyPr = declarations[0]
  if (!bodyPr) return undefined
  container(bodyPr)
  const names = {
    lIns: 'insetLeftEmu', rIns: 'insetRightEmu', tIns: 'insetTopEmu', bIns: 'insetBottomEmu',
    anchor: 'verticalAlign', anchorCtr: 'anchorCenter', vert: 'verticalText',
    rot: 'rotation', wrap: 'wrap', spcFirstLastPara: 'spaceFirstLastParagraph', rtlCol: 'rtlColumns',
    numCol: 'columnCount', compatLnSpc: 'compatibleLineSpacing',
    upright: 'upright',
  }
  const boolean = (raw) => {
    if (!['0', '1', 'false', 'true'].includes(raw)) invalid('boolean')
    return raw === '1' || raw === 'true'
  }
  const integer = (raw) => {
    if (!/^-?\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))) invalid('integer')
    return Number(raw)
  }
  const result = {}
  for (const [name, raw] of Object.entries(attributes(bodyPr, Object.keys(names)))) {
    result[names[name]] = ['lIns', 'rIns', 'tIns', 'bIns', 'rot'].includes(name)
      ? integer(raw)
      : name === 'numCol'
        ? (() => {
            const col = integer(raw)
            if (col < 1 || col > 16) invalid('numCol range')
            return col
          })()
        : ['anchorCtr', 'spcFirstLastPara', 'rtlCol', 'compatLnSpc', 'upright'].includes(name)
          ? boolean(raw)
          : name === 'wrap'
            ? raw === 'square' ? true : raw === 'none' ? false : invalid('wrap')
            : raw
  }
  const autofitChildren = bodyPr.children.filter((entry) =>
    ['noAutofit', 'spAutoFit', 'normAutofit'].includes(entry.local)
  )
  const warpChildren = bodyPr.children.filter((entry) => entry.local === 'prstTxWarp')
  if (autofitChildren.length > 1) invalid('autofit cardinality')
  if (warpChildren.length > 1) invalid('warp cardinality')
  if (warpChildren.length && autofitChildren.length &&
    bodyPr.children.indexOf(warpChildren[0]) > bodyPr.children.indexOf(autofitChildren[0]))
    invalid('warp order')
  for (const child of bodyPr.children) {
    if (!A_URIS.has(child.uri) || !['noAutofit', 'spAutoFit', 'normAutofit', 'prstTxWarp'].includes(child.local))
      invalid('bodyPr child')
  }
  if (warpChildren.length) {
    const warp = warpChildren[0]
    container(warp)
    const warpAttrs = attributes(warp, ['prst'])
    if (warpAttrs.prst !== 'textNoShape') invalid('unsupported warp preset')
    const adjustments = warp.children[0]
    if (warp.children.length > 1 || (adjustments && (!A_URIS.has(adjustments.uri) ||
      adjustments.local !== 'avLst' || adjustments.children.length !== 0))) invalid('warp avLst')
    if (adjustments) {
      attributes(adjustments, [])
      container(adjustments)
    }
    result.presetTextWarp = warpAttrs.prst
  }
  if (autofitChildren.length) {
    const fit = autofitChildren[0]
    const mode = { noAutofit: 'none', spAutoFit: 'shape', normAutofit: 'normal' }[fit.local]
    if (!A_URIS.has(fit.uri) || !mode || fit.children.length) invalid('autofit child')
    container(fit)
    const authored = attributes(fit, mode === 'normal' ? ['fontScale', 'lnSpcReduction'] : [])
    result.autofit = { mode }
    for (const [name, raw] of Object.entries(authored))
      result.autofit[name === 'fontScale' ? 'fontScale' : 'lineSpaceReduction'] = integer(raw)
  }
  try {
    return Object.keys(result).length ? normalizeTextProperties(result, 'body') : undefined
  } catch (error) {
    invalid(error.message)
  }
}

module.exports = { readSemanticTextBody }

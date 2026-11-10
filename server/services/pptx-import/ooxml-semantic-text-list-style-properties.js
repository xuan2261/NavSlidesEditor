const { normalizeTextProperties } = require('../../../shared/src/pptx-text-document')
const { readTableColor } = require('./ooxml-semantic-table-properties')
const { fontDescriptor, runProperties } = require('./ooxml-semantic-table-text-properties')

function listParagraphProperties(node, source) {
  const fields = { algn: 'alignment', lvl: 'level', rtl: 'direction', marL: 'marginLeftEmu',
    marR: 'marginRightEmu', indent: 'indentEmu', defTabSz: 'defaultTabSizeEmu', fontAlgn: 'fontAlignment',
    hangingPunct: 'hangingPunctuation', latinLnBrk: 'latinLineBreak', eaLnBrk: 'eastAsianLineBreak' }
  const attrs = source.attrs(node, Object.keys(fields)), result = { properties: {} }, props = result.properties
  for (const [key, value] of Object.entries(attrs))
    props[fields[key]] = key === 'rtl' ? (source.boolean(node, value) ? 'rtl' : 'ltr') :
      ['hangingPunct', 'latinLnBrk', 'eaLnBrk'].includes(key) ? source.boolean(node, value) :
        ['algn', 'fontAlgn'].includes(key) ? value : source.number(node, value)
  const groups = {
    buNone: 'bullet', buChar: 'bullet', buAutoNum: 'bullet',
    buFont: 'bulletFont', buFontTx: 'bulletFont', buClr: 'bulletColor', buClrTx: 'bulletColor',
    buSzPts: 'bulletSize', buSzPct: 'bulletSize', buSzTx: 'bulletSize',
  }
  source.children(node, ['defRPr', 'lnSpc', 'spcBef', 'spcAft', 'tabLst', ...Object.keys(groups)])
  for (const child of node.children) {
    if (child.local === 'defRPr') result.defaultRunProperties = runProperties(child, source).properties
    else if (['lnSpc', 'spcBef', 'spcAft'].includes(child.local)) {
      source.attrs(child)
      source.children(child, ['spcPts', 'spcPct'])
      if (child.children.length !== 1) source.fail(child, 'missing/conflicting spacing')
      const spacing = child.children[0]
      source.children(spacing)
      const raw = source.number(spacing, source.attrs(spacing, ['val']).val, 0, 2011680000)
      props[{ lnSpc: 'lineSpacing', spcBef: 'spaceBefore', spcAft: 'spaceAfter' }[child.local]] =
        { unit: spacing.local === 'spcPts' ? 'points' : 'percent', value: spacing.local === 'spcPts' ? raw / 100 : raw }
    } else if (child.local === 'tabLst') {
      source.attrs(child)
      source.children(child, ['tab'], ['tab'])
      props.tabs = child.children.map((tab) => {
        source.children(tab)
        const a = source.attrs(tab, ['pos', 'algn'])
        return { positionEmu: source.number(tab, a.pos), ...(a.algn !== undefined ? { alignment: a.algn } : {}) }
      })
    } else {
      const key = groups[child.local]
      if (Object.hasOwn(props, key)) source.fail(child, `conflicting ${key}`)
      if (child.local === 'buClr') {
        source.attrs(child)
        source.children(child, ['srgbClr', 'schemeClr', 'prstClr', 'sysClr'])
        if (child.children.length !== 1) source.fail(child, 'missing/conflicting bullet color')
        props[key] = readTableColor(child.children[0], source)
      } else if (child.local === 'buFont') props[key] = fontDescriptor(child, source)
      else {
        source.children(child)
        const allowed = child.local === 'buChar' ? ['char'] : child.local === 'buAutoNum' ? ['type', 'startAt'] :
          ['buSzPts', 'buSzPct'].includes(child.local) ? ['val'] : []
        const a = source.attrs(child, allowed)
        if (child.local.endsWith('Tx')) props[key] = 'text'
        else if (child.local.startsWith('buSz')) {
          const raw = source.number(child, a.val, 0, 2011680000)
          props[key] = { unit: child.local === 'buSzPts' ? 'points' : 'percent',
            value: child.local === 'buSzPts' ? raw / 100 : raw }
        } else props[key] = child.local === 'buNone' ? { kind: 'none' } :
          child.local === 'buChar' ? { kind: 'character', character: a.char } :
            { kind: 'number', scheme: a.type,
              ...(a.startAt !== undefined ? { startAt: source.number(child, a.startAt, 1, 32767) } : {}) }
      }
    }
  }
  source.checked(node, () => normalizeTextProperties(props, 'paragraph'))
  return result
}
module.exports = { listParagraphProperties }

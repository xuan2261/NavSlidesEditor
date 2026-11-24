const { child, value } = require('./ooxml-native-text-style-source')

const ALIGN = { l: 'left', ctr: 'center', r: 'right', just: 'justify' }
const TAB_ALIGN = new Set(['l', 'r', 'ctr', 'dec'])
function firstAttribute(styles, key) {
  for (const node of styles) {
    const raw = value(node, key)
    if (raw !== null) return raw
  }
  return null
}
function coordinate(raw, scale, signed = false) {
  if (raw === null || !(signed ? /^-?\d+$/u : /^\d+$/u).test(raw)) return null
  const emu = Number(raw)
  const px = emu / 12700 * scale
  return Number.isSafeInteger(emu) && Number.isFinite(px) && Math.abs(px) <= 100000 &&
    /^-?\d+(?:\.\d+)?$/u.test(String(px)) ? px : null
}
function nativeParagraphLayout(styles, scale, hasTabs) {
  const style = { 'white-space': 'pre-wrap' }
  let unsupported = false
  for (const [source, property] of [['indent', 'text-indent'], ['marL', 'margin-left'], ['marR', 'margin-right']]) {
    const raw = firstAttribute(styles, source)
    const px = coordinate(raw, scale.x, true)
    if (px !== null) style[property] = `${px}px`
    else if (raw !== null) unsupported = true
    else if (source === 'indent') style[property] = '0px'
  }
  const alignment = firstAttribute(styles, 'algn')
  if (ALIGN[alignment]) style['text-align'] = ALIGN[alignment]
  const tabSize = coordinate(firstAttribute(styles, 'defTabSz') ?? '914400', scale.x)
  if (tabSize > 0) style['tab-size'] = `${tabSize}px`
  else if (hasTabs) unsupported = true
  const list = styles.map((node) => child(node, 'tabLst')).find(Boolean)
  if (list) {
    if (list.children.length > 256) return { style, unsupported: true }
    const stops = list.children.map((tab) => {
      const position = coordinate(value(tab, 'pos'), scale.x)
      const align = value(tab, 'algn') ?? 'l'
      if (tab.local !== 'tab' || tab.uri !== list.uri || position === null || !TAB_ALIGN.has(align)) {
        unsupported = true
        return null
      }
      return { position, align }
    }).filter(Boolean).sort((a, b) => a.position - b.position)
    if (stops.length) style['--pptx-tab-stops'] = stops.map(({ position, align }) => `${position}:${align}`).join(',')
  }
  if (hasTabs && /^(1|true)$/u.test(firstAttribute(styles, 'rtl') || '')) unsupported = true
  return { style, unsupported }
}

module.exports = { nativeParagraphLayout }

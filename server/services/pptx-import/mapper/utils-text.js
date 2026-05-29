const { mergeInlineStyle, normalizeAlign, parseHtmlTree } = require('revealjs-shared')
const { readNumber } = require('../geometry')
const { sanitizeHtml } = require('../sanitize')

// The 960×540 canvas is 72 DPI, so a point maps 1:1 to a canvas px before the
// box scale is applied. mergeInlineStyle (a generic 96-DPI CSS converter) emits
// px = pt × 96/72, so the import path recovers pt with the inverse factor and
// then applies the deck's height-proportional scale.
const PT_PER_PX = 72 / 96

function roundTenth(value) {
  return Math.round(value * 10) / 10
}

function ptToCanvasPx(pt, scale = { x: 1, y: 1 }) {
  const size = Number(pt)
  if (!Number.isFinite(size)) return undefined
  const axisY = readNumber(scale?.y, 1, 0) || 1
  return roundTenth(size * axisY)
}

function plainText(html) {
  return sanitizeHtml(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function normalizeFontSize(value) {
  const size = parseFloat(value)
  return Number.isFinite(size) && size > 0 ? size : undefined
}

function normalizeFontFamily(value) {
  const raw = String(value || '').trim()
  if (!raw) return undefined
  if ([...raw].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return undefined
  if (/[;:()\\/]/.test(raw)) return undefined
  if (/\/\*|\*\/|url|import|expression|javascript|behavior|binding/i.test(raw)) return undefined
  const family = raw
    .split(',')[0]
    .replace(/["']/g, '')
    .trim()
  if (!family || !/^[a-zA-Z0-9 _.-]+$/.test(family)) return undefined
  return family
}

function buildBaseTextStyle(element = {}) {
  const style = {}
  const align = normalizeAlign(String(element.textAlign || element.align || element.paragraphAlign || '').toLowerCase())
  const fontSize = normalizeFontSize(element.fontSize || element.fontSz)
  const fontFamily = normalizeFontFamily(element.fontFamily || element.fontFace || element.font || element.fontName)
  const color = element.textColor || element.fontColor || element.color

  if (align) style.align = align
  if (fontSize) style.fontSize = fontSize
  if (fontFamily) style.fontFace = fontFamily
  if (color) style.color = color
  return style
}

function applyTextStyle(metadata, style) {
  const align = normalizeAlign(String(style.align || '').toLowerCase())
  const fontSize = normalizeFontSize(style.fontSize)
  const fontFamily = normalizeFontFamily(style.fontFace)

  if (!metadata.textAlign && align) metadata.textAlign = align
  if (metadata.fontSize == null && fontSize) metadata.fontSize = fontSize
  if (!metadata.fontFamily && fontFamily) metadata.fontFamily = fontFamily
  if (!metadata.textColor && style.color) metadata.textColor = style.color
}

function visibleTextLength(node) {
  if (!node) return 0
  if (node.type === 'text') return String(node.text || '').replace(/\s+/g, ' ').trim().length
  return (node.children || []).reduce((sum, child) => sum + visibleTextLength(child), 0)
}

function hasDominantTextStyleChange(nextStyle, inheritedStyle) {
  return ['fontSize', 'fontFace', 'color'].some((key) => nextStyle?.[key] && nextStyle[key] !== inheritedStyle?.[key])
}

function dominantTextStyleTuple(style = {}) {
  return {
    fontSize: normalizeFontSize(style.fontSize),
    fontFace: normalizeFontFamily(style.fontFace),
    color: style.color || undefined,
  }
}

function hasSameDominantTextStyle(actualStyle, expectedStyle) {
  const actual = dominantTextStyleTuple(actualStyle)
  const expected = dominantTextStyleTuple(expectedStyle)
  return actual.fontSize === expected.fontSize
    && actual.fontFace === expected.fontFace
    && actual.color === expected.color
}

function nodeStyleDeclares(node, prop) {
  if (!node || node.type !== 'element') return false
  const style = node.attrs && node.attrs.style
  if (!style) return false
  return new RegExp(`(?:^|;)\\s*${prop}\\s*:`, 'i').test(String(style))
}

function mergeInlineStyleInPt(base, node) {
  const merged = mergeInlineStyle(base, node)
  // mergeInlineStyle is a generic 96-DPI converter: a node that declares its own
  // font-size/letter-spacing yields px = pt × 96/72. Recover to pt only for the
  // node that actually set the property — detected structurally from its own
  // style. A magnitude comparison misfires when a child's converted px coincides
  // with the inherited pt value (e.g. 18pt → 24px equals an inherited 24pt).
  if (nodeStyleDeclares(node, 'font-size') && Number.isFinite(merged.fontSize)) {
    merged.fontSize = roundTenth(merged.fontSize * PT_PER_PX)
  }
  if (nodeStyleDeclares(node, 'letter-spacing') && Number.isFinite(merged.charSpacing)) {
    merged.charSpacing = roundTenth(merged.charSpacing * PT_PER_PX)
  }
  return merged
}

function visibleTextUsesStyle(node, inheritedStyle, expectedStyle) {
  if (!node) return true
  if (node.type === 'text') {
    return !visibleTextLength(node) || hasSameDominantTextStyle(inheritedStyle, expectedStyle)
  }

  const nextStyle = node.type === 'element' ? mergeInlineStyleInPt(inheritedStyle, node) : inheritedStyle
  return (node.children || []).every((child) => visibleTextUsesStyle(child, nextStyle, expectedStyle))
}

function extractTextMetadata(html, element = {}, scale = { x: 1, y: 1 }) {
  const baseStyle = buildBaseTextStyle(element)
  const fallback = {}
  applyTextStyle(fallback, baseStyle)

  const runs = []
  const walk = (node, inheritedStyle) => {
    if (!node) return
    if (node.type === 'text') {
      const text = String(node.text || '').replace(/\s+/g, ' ').trim()
      if (text) runs.push({ text, style: inheritedStyle })
      return
    }

    const nextStyle = node.type === 'element' ? mergeInlineStyleInPt(inheritedStyle, node) : inheritedStyle
    if (node.type === 'element' && hasDominantTextStyleChange(nextStyle, inheritedStyle)) {
      const length = visibleTextLength(node)
      if (length && visibleTextUsesStyle(node, inheritedStyle, nextStyle)) {
        runs.push({ text: 'x'.repeat(length), style: nextStyle })
      }
    }
    for (const child of node.children || []) walk(child, nextStyle)
  }

  walk(parseHtmlTree(html), baseStyle)

  const metadata = {}
  if (runs.length) {
    const dominant = runs.reduce((winner, candidate) =>
      candidate.text.length > winner.text.length ? candidate : winner, runs[0])
    applyTextStyle(metadata, dominant.style)
  }
  const result = { ...fallback, ...metadata }
  // Font is carried in points through the walk; convert to canvas px once,
  // using the deck's height-proportional scale (1pt → 1px on a standard deck).
  if (result.fontSize != null) result.fontSize = ptToCanvasPx(result.fontSize, scale)
  return result
}

function normalizeImportedRichTextHtml(html) {
  return String(html || '').replace(/\sstyle=(["'])(.*?)\1/gi, (_match, quote, style) => {
    const safe = String(style)
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .filter((part) => {
        const prop = String(part.split(':')[0] || '').trim().toLowerCase()
        return prop !== 'font-size' && prop !== 'line-height'
      })
      .join('; ')
    return safe ? ` style=${quote}${safe}${quote}` : ''
  })
}

function computeFitFontSizePx(box = {}, metadata = {}, extra = {}) {
  const source = normalizeFontSize(metadata.fontSize) || 16
  const height = Number(box.height)
  const width = Number(box.width)
  if (!Number.isFinite(height) || height <= 0) return source
  const readableMin = 8
  const heightLimit = height * 0.38
  const textLength = Number(extra.textLength)
  const widthLimit = Number.isFinite(width) && textLength > 0 && textLength <= 3 ? width * 0.38 : source
  return Math.max(readableMin, Math.min(source, Math.round(Math.min(heightLimit, widthLimit) * 10) / 10))
}

function extractTextInsetsWithScale(element = {}, scale = { x: 1, y: 1 }, box = {}) {
  const toPx = (value, axisScale, maxDimension) => {
    const raw = readNumber(value, null)
    if (raw == null) return null
    const axis = readNumber(axisScale, 1, 0) || 1
    const maxFromBox = readNumber(maxDimension, null, 0)
    const max = Math.min(maxFromBox != null ? maxFromBox / 2 : 96, 96)
    const px = roundTenth(Math.max(0, raw) * axis)
    return Math.min(px, max)
  }
  const left = toPx(element.insetLeft ?? element.marginLeft ?? element.lIns ?? element.insetL, scale.x, box.width)
  const right = toPx(element.insetRight ?? element.marginRight ?? element.rIns ?? element.insetR, scale.x, box.width)
  const top = toPx(element.insetTop ?? element.marginTop ?? element.tIns ?? element.insetT, scale.y, box.height)
  const bottom = toPx(element.insetBottom ?? element.marginBottom ?? element.bIns ?? element.insetB, scale.y, box.height)
  if (![left, right, top, bottom].some((value) => value != null)) return null
  return { left, right, top, bottom }
}

function buildPptxTextImportMeta(box = {}, metadata = {}, extra = {}) {
  const round = (value) => {
    const raw = Number(value)
    return Number.isFinite(raw) ? Math.round(raw * 10) / 10 : undefined
  }
  return {
    version: 1,
    textFit: 'wrap',
    sourceFontSizePx: round(metadata.fontSize),
    fitFontSizePx: computeFitFontSizePx(box, metadata, extra),
    sourceBox: {
      width: round(box.width),
      height: round(box.height),
    },
    ...extra,
  }
}

module.exports = {
  buildBaseTextStyle,
  buildPptxTextImportMeta,
  extractTextInsets: extractTextInsetsWithScale,
  extractTextMetadata,
  normalizeFontFamily,
  normalizeFontSize,
  normalizeImportedRichTextHtml,
  plainText,
  ptToCanvasPx,
}

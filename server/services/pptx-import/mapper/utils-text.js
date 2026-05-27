const { mergeInlineStyle, normalizeAlign, parseHtmlTree } = require('revealjs-shared')
const { readNumber } = require('../geometry')
const { sanitizeHtml } = require('../sanitize')

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

function visibleTextUsesStyle(node, inheritedStyle, expectedStyle) {
  if (!node) return true
  if (node.type === 'text') {
    return !visibleTextLength(node) || hasSameDominantTextStyle(inheritedStyle, expectedStyle)
  }

  const nextStyle = node.type === 'element' ? mergeInlineStyle(inheritedStyle, node) : inheritedStyle
  return (node.children || []).every((child) => visibleTextUsesStyle(child, nextStyle, expectedStyle))
}

function extractTextMetadata(html, element = {}) {
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

    const nextStyle = node.type === 'element' ? mergeInlineStyle(inheritedStyle, node) : inheritedStyle
    if (node.type === 'element' && hasDominantTextStyleChange(nextStyle, inheritedStyle)) {
      const length = visibleTextLength(node)
      if (length && visibleTextUsesStyle(node, inheritedStyle, nextStyle)) {
        runs.push({ text: 'x'.repeat(length), style: nextStyle })
      }
    }
    for (const child of node.children || []) walk(child, nextStyle)
  }

  walk(parseHtmlTree(html), baseStyle)
  if (!runs.length) return fallback

  const dominant = runs.reduce((winner, candidate) =>
    candidate.text.length > winner.text.length ? candidate : winner, runs[0])
  const metadata = {}
  applyTextStyle(metadata, dominant.style)
  return { ...fallback, ...metadata }
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
    const px = Math.round(Math.max(0, raw) * (96 / 72) * axis * 10) / 10
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
}

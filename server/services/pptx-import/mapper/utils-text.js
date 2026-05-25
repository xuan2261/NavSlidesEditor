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
  const family = String(value || '')
    .split(',')[0]
    .replace(/["']/g, '')
    .trim()
  return family || undefined
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

function extractTextMetadata(html, element = {}) {
  const baseStyle = buildBaseTextStyle(element)
  const fallback = {}
  applyTextStyle(fallback, baseStyle)

  const metadata = {}
  const walk = (node, inheritedStyle) => {
    if (!node) return
    if (node.type === 'text') {
      if (String(node.text || '').replace(/\s+/g, ' ').trim()) {
        applyTextStyle(metadata, inheritedStyle)
      }
      return
    }

    const nextStyle = node.type === 'element' ? mergeInlineStyle(inheritedStyle, node) : inheritedStyle
    for (const child of node.children || []) walk(child, nextStyle)
  }

  walk(parseHtmlTree(html), baseStyle)
  return { ...fallback, ...metadata }
}

function extractTextInsets(element = {}) {
  const left = readNumber(element.insetLeft ?? element.marginLeft ?? element.lIns ?? element.insetL, null)
  const right = readNumber(element.insetRight ?? element.marginRight ?? element.rIns ?? element.insetR, null)
  const top = readNumber(element.insetTop ?? element.marginTop ?? element.tIns ?? element.insetT, null)
  const bottom = readNumber(element.insetBottom ?? element.marginBottom ?? element.bIns ?? element.insetB, null)
  if (![left, right, top, bottom].some((value) => value != null)) return null
  return { left, right, top, bottom }
}

module.exports = {
  buildBaseTextStyle,
  extractTextInsets,
  extractTextMetadata,
  normalizeFontFamily,
  normalizeFontSize,
  plainText,
}

import { DEFAULT_TEXT_COLOR, normalizeCssColor } from './export-pptx-color-utils'
import {
  decodeHtmlEntities,
  getBlockNodes,
  mergeInlineStyle,
  normalizeAlign,
  normalizeWhitespace,
  parseHtmlTree,
} from './export-pptx-html-parser'

function buildRunOptions(style) {
  const options = {}
  if (style.bold) options.bold = true
  if (style.italic) options.italic = true
  if (style.underline) options.underline = true
  if (style.strike) options.strike = true   // Phase 1
  if (style.subscript) options.subscript = true  // Phase 1
  if (style.superscript) options.superscript = true // Phase 1
  if (style.fontFace) options.fontFace = style.fontFace
  if (style.fontSize) options.fontSize = style.fontSize
  if (style.charSpacing) options.charSpacing = style.charSpacing // Phase 1
  if (style.link) options.hyperlink = { url: style.link } // Phase 1: hyperlink
  if (style.color) {
    const normalized = normalizeCssColor(style.color, DEFAULT_TEXT_COLOR)
    options.color = normalized.color
    if (normalized.transparency != null) options.transparency = normalized.transparency
  }
  return options
}

function pushTextRun(runs, text, style) {
  const normalized = normalizeWhitespace(text, style.preserveWhitespace)
  if (!normalized) return
  runs.push({
    text: normalized,
    options: buildRunOptions(style),
  })
}

function collectInlineRuns(nodes, inheritedStyle = {}) {
  const runs = []
  for (const node of nodes || []) {
    if (node.type === 'text') {
      pushTextRun(runs, node.text, inheritedStyle)
      continue
    }
    if (node.type !== 'element') continue
    if (node.tag === 'br') {
      runs.push({ text: '', options: { breakLine: true } })
      continue
    }
    let nextStyle = mergeInlineStyle(inheritedStyle, node)
    // Phase 1: hyperlink — attach href to style
    if (node.tag === 'a' && node.attrs?.href) {
      nextStyle = { ...nextStyle, link: node.attrs.href }
    }
    runs.push(...collectInlineRuns(node.children, nextStyle))
  }
  return runs
}

function buildParagraphsFromHtml(html, baseStyle = {}) {
  const tree = parseHtmlTree(html)
  const blocks = getBlockNodes(tree)
  const paragraphs = []

  for (const block of blocks) {
    if (block.tag === 'ul' || block.tag === 'ol') {
      const items = (block.children || []).filter((child) => child.type === 'element' && child.tag === 'li')
      items.forEach((item, index) => {
        const style = mergeInlineStyle(baseStyle, item)
        const runs = collectInlineRuns(item.children, style)
        if (!runs.length) return
        paragraphs.push({
          align: normalizeAlign(style.align),
          bullet:
            block.tag === 'ol'
              ? { type: 'number', numberStartAt: index + 1 }
              : { type: 'bullet', indent: 14 },
          runs,
        })
      })
      continue
    }

    const style = mergeInlineStyle(baseStyle, block)
    if (block.tag === 'pre') style.preserveWhitespace = true
    const runs = collectInlineRuns(block.children, style)
    if (!runs.length) continue
    paragraphs.push({
      align: normalizeAlign(style.align),
      runs,
    })
  }

  if (paragraphs.length) return paragraphs

  const fallbackText = stripHtmlToPlainText(html)
  return fallbackText ? [{ runs: [{ text: fallbackText, options: buildRunOptions(baseStyle) }] }] : []
}

export function stripHtmlToPlainText(html) {
  return decodeHtmlEntities(String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function htmlToPptTextRuns(html, baseStyle = {}) {
  const paragraphs = buildParagraphsFromHtml(html, baseStyle)
  const runs = []

  paragraphs.forEach((paragraph, paragraphIndex) => {
    paragraph.runs.forEach((run, runIndex) => {
      const options = { ...(run.options || {}) }
      if (runIndex === 0) {
        if (paragraph.align) options.align = paragraph.align
        if (paragraph.bullet) options.bullet = paragraph.bullet
      }
      const shouldBreak = paragraphIndex < paragraphs.length - 1 && runIndex === paragraph.runs.length - 1
      if (shouldBreak) options.breakLine = true
      runs.push({ text: run.text, options })
    })
  })

  return runs
}

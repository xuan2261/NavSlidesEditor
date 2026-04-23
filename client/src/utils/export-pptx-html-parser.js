const HEADING_SIZES = { h1: 28, h2: 24, h3: 20, h4: 18, h5: 16, h6: 14 }

export function decodeHtmlEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
}

export function normalizeWhitespace(text, preserve = false) {
  if (preserve) return decodeHtmlEntities(text)
  return decodeHtmlEntities(text).replace(/\s+/g, ' ')
}

function parseStyleAttribute(styleText) {
  return String(styleText || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const idx = part.indexOf(':')
      if (idx === -1) return acc
      acc[part.slice(0, idx).trim().toLowerCase()] = part.slice(idx + 1).trim()
      return acc
    }, {})
}

function parseTag(rawTag) {
  const selfClosing = /\/>$/.test(rawTag) || /^<br/i.test(rawTag)
  const body = rawTag.replace(/^</, '').replace(/\/?>$/, '').trim()
  const [tagName = '', ...rest] = body.split(/\s+/)
  const attrs = {}
  const attrText = rest.join(' ')
  const attrRegex = /([^\s=]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g
  let match
  while ((match = attrRegex.exec(attrText)) !== null) {
    const [, key, quoted, single, bare] = match
    attrs[key.toLowerCase()] = quoted ?? single ?? bare ?? ''
  }
  return { tag: tagName.toLowerCase(), attrs, selfClosing }
}

export function parseHtmlTree(html) {
  const root = { type: 'root', children: [] }
  const stack = [root]
  const tokens = String(html || '').match(/<!--[\s\S]*?-->|<\/?[^>]+>|[^<]+/g) || []

  for (const token of tokens) {
    if (!token || /^<!--/.test(token)) continue
    const current = stack[stack.length - 1]
    if (token.startsWith('</')) {
      const closingTag = token.replace(/^<\//, '').replace(/>$/, '').trim().toLowerCase()
      while (stack.length > 1) {
        const node = stack.pop()
        if (node.tag === closingTag) break
      }
      continue
    }
    if (token.startsWith('<')) {
      const parsed = parseTag(token)
      if (!parsed.tag) continue
      const node = {
        type: 'element',
        tag: parsed.tag,
        attrs: parsed.attrs,
        children: [],
      }
      current.children.push(node)
      if (!parsed.selfClosing) stack.push(node)
      continue
    }
    current.children.push({ type: 'text', text: token })
  }

  return root
}

export function getBlockNodes(root) {
  const blockTags = new Set(['blockquote', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ol', 'p', 'pre', 'ul'])
  const inlineBuffer = []
  const blocks = []

  const flushInline = () => {
    if (!inlineBuffer.length) return
    blocks.push({
      type: 'element',
      tag: 'p',
      attrs: {},
      children: inlineBuffer.splice(0, inlineBuffer.length),
    })
  }

  for (const child of root.children || []) {
    if (child.type === 'text') {
      inlineBuffer.push(child)
      continue
    }
    if (blockTags.has(child.tag)) {
      flushInline()
      blocks.push(child)
      continue
    }
    inlineBuffer.push(child)
  }

  flushInline()
  return blocks
}

export function mergeInlineStyle(base, node) {
  const merged = { ...base }
  if (!node || node.type !== 'element') return merged

  const style = parseStyleAttribute(node.attrs?.style)
  const tag = node.tag

  if (tag === 'b' || tag === 'strong' || Number(style['font-weight']) >= 600 || style['font-weight'] === 'bold') {
    merged.bold = true
  }
  if (tag === 'i' || tag === 'em' || style['font-style'] === 'italic') merged.italic = true
  if (
    tag === 'u' ||
    String(style['text-decoration'] || '').includes('underline') ||
    String(style['text-decoration-line'] || '').includes('underline')
  ) {
    merged.underline = true
  }
  if (tag === 'code') merged.fontFace = 'Courier New'
  if (style.color) merged.color = style.color
  if (style['font-family']) merged.fontFace = style['font-family'].split(',')[0].replace(/['"]/g, '')
  if (style['font-size']) {
    const size = parseFloat(style['font-size'])
    if (Number.isFinite(size)) merged.fontSize = size
  }
  if (style['text-align']) merged.align = style['text-align']

  if (tag in HEADING_SIZES) {
    merged.bold = true
    merged.fontSize = HEADING_SIZES[tag]
  }

  return merged
}

export function normalizeAlign(align) {
  return ['center', 'justify', 'left', 'right'].includes(align) ? align : undefined
}

// Exact canvas allowlist: never interpolate arbitrary CSS or attribute syntax.
function safeOverrideColor(value) {
  const color = typeof value === 'string' ? value.trim() : ''
  if (/^#[0-9a-f]{3,8}$/i.test(color)) return color
  if (/^rgba?\(\s*[\d.\s,%]+\)$/i.test(color)) return color
  if (/^hsla?\(\s*[\d.\s,%deg]+\)$/i.test(color)) return color
  if (['transparent', 'currentColor', 'none'].includes(color)) return color
  return null
}

function overridePaint(value, override) {
  if (!override || /^(?:\s|\/\*[\s\S]*?\*\/)*url\s*\(/i.test(value)) return value
  const match = /^(\s*)([\s\S]*?)(\s*!\s*important\s*|\s*)$/i.exec(value)
  if (!match[2]) return value
  return match[1] + override + match[3]
}

function overrideDeclaration(declaration, paints) {
  const match = /^(\s*)(fill|stroke)(\s*:\s*)/i.exec(declaration)
  if (!match) return declaration
  const prefix = match[0]
  return prefix + overridePaint(declaration.slice(prefix.length), paints[match[2].toLowerCase()])
}

function overrideInlineStyle(style, paints) {
  let output = ''
  let start = 0
  let quote = ''
  let depth = 0
  for (let i = 0; i < style.length; i++) {
    const char = style[i]
    if (char === '\\') {
      i++
    } else if (quote) {
      if (char === quote) quote = ''
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (char === '/' && style[i + 1] === '*') {
      const end = style.indexOf('*/', i + 2)
      if (end < 0) return output + style.slice(start)
      i = end + 1
    } else if (char === '(') {
      depth++
    } else if (char === ')') {
      depth = Math.max(0, depth - 1)
    } else if (char === ';' && depth === 0) {
      output += overrideDeclaration(style.slice(start, i), paints) + ';'
      start = i + 1
    }
  }
  // Unterminated strings/functions/comments remain unmodified, not repaired.
  if (quote || depth) return output + style.slice(start)
  return output + overrideDeclaration(style.slice(start), paints)
}

function overrideTag(tag, nameEnd, paints, inheritDefaults) {
  // Consume every attribute, including unrelated values, before considering paints.
  const attributes = /\s+([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/y
  let output = tag.slice(0, nameEnd)
  let position = nameEnd
  let hasFill = false
  let hasStroke = false
  while (position < tag.length) {
    attributes.lastIndex = position
    const match = attributes.exec(tag)
    if (!match) break
    const [raw, name, doubleQuoted, singleQuoted] = match
    const value = doubleQuoted ?? singleQuoted
    hasFill ||= name === 'fill'
    hasStroke ||= name === 'stroke'
    let modified = value
    if (value !== undefined) {
      if (name === 'fill' || name === 'stroke') modified = overridePaint(value, paints[name])
      else if (name === 'style') modified = overrideInlineStyle(value, paints)
    }
    if (modified !== value) {
      const valueStart = raw.length - value.length - 1
      output += raw.slice(0, valueStart) + modified + raw.slice(-1)
    } else {
      output += raw
    }
    position = attributes.lastIndex
  }
  if (inheritDefaults) {
    if (paints.fill && !hasFill) output += ` fill="${paints.fill}"`
    if (paints.stroke && !hasStroke) output += ` stroke="${paints.stroke}"`
  }
  return output + tag.slice(position)
}

function markupEnd(content, start) {
  const terminator = content.startsWith('<!--', start)
    ? '-->'
    : content.startsWith('<![CDATA[', start)
      ? ']]>'
      : content.startsWith('<?', start)
        ? '?>'
        : null
  if (terminator) {
    const end = content.indexOf(terminator, start + 2)
    return end < 0 ? -1 : end + terminator.length
  }
  let quote = ''
  let brackets = 0
  const declaration = content[start + 1] === '!'
  for (let i = start + 1; i < content.length; i++) {
    const char = content[i]
    if (quote) {
      if (char === quote) quote = ''
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (declaration && char === '[') {
      brackets++
    } else if (declaration && char === ']') {
      brackets = Math.max(0, brackets - 1)
    } else if (char === '>' && brackets === 0) {
      return i + 1
    } else if (char === '<' && !declaration) {
      return -1
    }
  }
  return -1
}

/**
 * Override existing SVG paints and supply root defaults for unpainted shapes.
 * Preserve geometry, defs, stylesheet rules, and URL paints. Output is UNTRUSTED
 * SVG; each renderer MUST sanitize it before insertion into HTML.
 * @param {string} content
 * @param {{fillOverride?: string, strokeOverride?: string}} [overrides]
 * @returns {string}
 */
function applySvgPaintOverrides(content, { fillOverride, strokeOverride } = {}) {
  const paints = {
    fill: safeOverrideColor(fillOverride),
    stroke: safeOverrideColor(strokeOverride),
  }
  if (!paints.fill && !paints.stroke) return content
  let output = ''
  let position = 0
  let defsDepth = 0
  while (position < content.length) {
    const start = content.indexOf('<', position)
    if (start < 0) break
    let end = markupEnd(content, start)
    if (end < 0) break
    const tag = content.slice(start, end)
    const match = /^<(\/?)([A-Za-z][\w:.-]*)(?=[\s/>])/.exec(tag)
    let modified = tag
    if (match) {
      const closing = Boolean(match[1])
      const name = match[2].toLowerCase()
      const selfClosing = /\/\s*>$/.test(tag)
      if (!closing && !selfClosing && (name === 'style' || name === 'script')) {
        // Raw text must not be interpreted as markup or inline declarations.
        const closingTag = name === 'style' ? /<\/style\s*>/gi : /<\/script\s*>/gi
        closingTag.lastIndex = end
        const close = closingTag.exec(content)
        if (!close) break
        end = closingTag.lastIndex
        modified = content.slice(start, end)
      } else if (name === 'defs') {
        if (closing) defsDepth = Math.max(0, defsDepth - 1)
        else if (!selfClosing) defsDepth++
      } else if (!closing && !defsDepth && name !== 'style' && name !== 'script') {
        modified = overrideTag(tag, match[0].length, paints, name === 'svg')
      }
    }
    output += content.slice(position, start) + modified
    position = end
  }
  return output + content.slice(position)
}

module.exports = { applySvgPaintOverrides }

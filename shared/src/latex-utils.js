function normalizeLatexForRender(content) {
  const source = String(content || '')
  const trimmed = source.trim()
  const displayMatch = trimmed.match(/^\\\[(.*)\\\]$/s) || trimmed.match(/^\$\$(.*)\$\$$/s)
  if (displayMatch) return displayMatch[1].trim()
  const equationMatch = trimmed.match(/^\\begin\{equation\*?\}([\s\S]*)\\end\{equation\*?\}$/)
  if (equationMatch) return equationMatch[1].trim()
  return source
}

module.exports = {
  normalizeLatexForRender,
}

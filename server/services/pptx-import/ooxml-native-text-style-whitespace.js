const { decodeHtmlEntities } = require('revealjs-shared')
const { decodeXml } = require('./ooxml-text-run-xml')

const normalized = (text) => String(text).replace(/\t/g, '    ').replace(/\s/gu, ' ')
const tokens = (text) => String(text).match(/&(?:#\d+|#x[\da-fA-F]+|[A-Za-z]+);|[\s\S]/gu) || []
function tokenText(token) {
  if (/^&nbsp;$/iu.test(token)) return '\u00a0'
  const decoded = decodeHtmlEntities(token)
  return decoded !== token ? decoded : decodeXml(token) ?? token
}
function coverage(node) {
  if (node.type === 'text') return normalized(tokens(node.text).map(tokenText).join(''))
  if (node.tag === 'br') return '\0'
  return (node.children || []).map(coverage).join('')
}
function sourceCoverage(runs) {
  return runs.map((run) => run.kind === 'break' ? '\0' : normalized(run.text)).join('')
}
const escape = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
function* sourceAtoms(runs) {
  for (const run of runs) {
    if (run.kind === 'break') continue
    for (const text of run.text) yield { text, style: run.style, width: normalized(text).length }
  }
}

// Match using the parser's tab expansion, but emit source characters once. Only
// text leaves change: source runs can cross parser spans without losing links.
function restoreRuns(block, runs, explicitTabs = false) {
  const iterator = sourceAtoms(runs)
  let atom = iterator.next().value
  let consumed = 0
  function patch(node) {
    const children = []
    for (const item of node.children || []) {
      if (item.type !== 'text') { patch(item); children.push(item); continue }
      let raw = ''
      let style = null
      function flush() {
        if (!raw) return
        const text = { type: 'text', text: raw }
        children.push(style && Object.keys(style).length ? {
          type: 'element', tag: 'span', attrs: { style: Object.entries(style).map(([key, val]) => `${key}: ${val};`).join('') },
          children: [text],
        } : text)
        raw = ''
      }
      for (const token of tokens(item.text)) {
        let remaining = normalized(tokenText(token)).length
        while (remaining && atom) {
          if (consumed === 0) {
            if (atom.style !== style) { flush(); style = atom.style }
            const restored = atom.text === '\u00a0' ? '&nbsp;' : /\s/u.test(atom.text) ? atom.text
              : atom.text === tokenText(token) ? token : escape(atom.text)
            if (explicitTabs && atom.text === '\t') {
              flush()
              children.push({ type: 'element', tag: 'span', attrs: { style: '--pptx-tab:1;' },
                children: [{ type: 'text', text: '\t' }] })
            } else raw += restored
          }
          const count = Math.min(remaining, atom.width - consumed)
          consumed += count
          remaining -= count
          if (consumed === atom.width) { atom = iterator.next().value; consumed = 0 }
        }
      }
      flush()
    }
    node.children = children
  }
  // Parser empty-paragraph placeholders preserve line height and stay intact.
  if (atom) patch(block)
}

module.exports = { coverage, sourceCoverage, restoreRuns }

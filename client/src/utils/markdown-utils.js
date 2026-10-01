import { Marked } from 'marked'
import { escapeHtml } from 'revealjs-shared'
import { isSafeHref } from './url-safety'

// Parse code as its own token so later inline/block rules never rewrite literals.
const markdownParser = new Marked({
  async: false,
  renderer: {
    code({ text, escaped }) {
      const code = escaped ? text : escapeHtml(text)
      return `<pre style="background:rgba(0,0,0,0.3);padding:10px 14px;border-radius:6px;overflow:auto;font-family:'Fira Code',monospace;font-size:13px;"><code>${code}</code></pre>\n`
    },
    codespan({ text }) {
      return `<code style="background:rgba(255,255,255,0.1);padding:2px 5px;border-radius:3px;font-family:monospace;font-size:0.9em;">${escapeHtml(text)}</code>`
    },
    paragraph({ tokens }) {
      return `<p style="margin:0 0 0.4em;line-height:1.6;">${this.parser.parseInline(tokens)}</p>\n`
    },
    link({ href, tokens }) {
      const safeHref = isSafeHref(href) ? href : '#'
      return `<a href="${escapeHtml(safeHref)}" style="color:#60a5fa;text-decoration:underline;">${this.parser.parseInline(tokens)}</a>`
    },
    hr() {
      return '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.2);margin:12px 0;">\n'
    },
    list(token) {
      const tag = token.ordered ? 'ol' : 'ul'
      const start = token.ordered && token.start !== 1 ? ` start="${token.start}"` : ''
      const items = token.items.map((item) => this.listitem(item)).join('')
      return `<${tag}${start} style="padding-left:1.5em;margin:0.4em 0;">${items}</${tag}>\n`
    },
  },
})

export function markdownToHtml(md) {
  if (!md) return ''
  return markdownParser.parse(md)
}

import { isSafeHref } from './url-safety'

export function markdownToHtml(md) {
  if (!md) return ''
  let html = md
    // Code blocks
    .replace(
      /```(\w*)\n([\s\S]*?)```/g,
      (_, lang, code) =>
        `<pre style="background:rgba(0,0,0,0.3);padding:10px 14px;border-radius:6px;overflow:auto;font-family:'Fira Code',monospace;font-size:13px;"><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`
    )
    // Inline code
    .replace(
      /`([^`]+)`/g,
      '<code style="background:rgba(255,255,255,0.1);padding:2px 5px;border-radius:3px;font-family:monospace;font-size:0.9em;">$1</code>'
    )
    // Headings
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_, text, href) => {
        const safeHref = isSafeHref(href) ? href : '#'
        return `<a href="${safeHref}" style="color:#60a5fa;text-decoration:underline;">${text}</a>`
      }
    )
    // Horizontal rules
    .replace(
      /^---$/gm,
      '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.2);margin:12px 0;">'
    )
    // Unordered lists
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
  // Wrap consecutive <li> in <ul>
  html = html.replace(
    /((?:<li>.*<\/li>\n?)+)/g,
    '<ul style="padding-left:1.5em;margin:0.4em 0;">$1</ul>'
  )
  // Paragraphs (lines not already wrapped)
  html = html
    .split('\n')
    .map((line) => {
      if (!line.trim()) return ''
      if (/^<(h[1-4]|ul|ol|li|pre|hr|div|blockquote)/.test(line.trim())) return line
      return `<p style="margin:0 0 0.4em;line-height:1.6;">${line}</p>`
    })
    .join('\n')
  return html
}

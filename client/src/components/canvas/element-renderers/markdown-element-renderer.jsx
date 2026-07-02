import { markdownToHtml } from '../../../utils/markdown-utils'
import { sanitizeRichTextHtml } from '../../../utils/content-safety'
import { resolveColorField } from 'revealjs-shared'

export function MarkdownRenderer({ element }) {
  const html = sanitizeRichTextHtml(markdownToHtml(element.content || ''))
  const markdownStyle = {
    width: '100%',
    height: '100%',
    overflow: 'auto',
    padding: '8px 12px',
    boxSizing: 'border-box',
    color: resolveColorField(element.textColor, 'markdown', 'textColor') || 'white',
    fontSize: element.fontSize ? `${element.fontSize}px` : '18px',
    lineHeight: 1.5,
  }
  return (
    <div style={markdownStyle} dangerouslySetInnerHTML={{ __html: html }} />
  )
}

import { sanitizeHref } from 'revealjs-shared'

export default function ImageCitation({ element }) {
  const text = element.citationText || element.citationLink
  if (!text) return null
  const style = {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '100%',
    fontSize: 10,
    color: element.citationColor || 'rgba(255,255,255,0.5)',
    lineHeight: 1.3,
    padding: '3px 2px 0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    pointerEvents: 'none',
    textAlign: ['left', 'center', 'right'].includes(element.citationAlign)
      ? element.citationAlign
      : 'left',
  }
  return element.citationLink ? (
    <a
      href={sanitizeHref(element.citationLink)}
      target="_blank"
      rel="noopener noreferrer"
      style={{ ...style, textDecoration: 'none' }}
    >
      {text}
    </a>
  ) : (
    <div style={style}>{text}</div>
  )
}

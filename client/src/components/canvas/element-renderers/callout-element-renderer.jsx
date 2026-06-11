import { resolveColorField } from 'revealjs-shared'

export function CalloutRenderer({ element }) {
  const num = element.calloutNumber || 1
  const bg = element.calloutColor || '#ef4444'
  const textColor = resolveColorField(element.calloutTextColor, 'callout', 'calloutTextColor') || '#ffffff'
  const fontSize = element.fontSize || 16
  const calloutStyle = {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    background: bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: textColor,
    fontSize,
    fontWeight: 700,
    fontFamily: '-apple-system, sans-serif',
    boxSizing: 'border-box',
    userSelect: 'none',
  }
  return (
    <div style={calloutStyle}>{num}</div>
  )
}

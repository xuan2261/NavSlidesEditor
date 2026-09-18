import React from 'react'
import { LoadingFallback, getScattergoriesInteractiveP } from './shared.jsx'
export function ScattergoriesRenderer({ element, isPresenting }) {
  const [Interactive, setInteractive] = React.useState(null)
  React.useEffect(() => {
    if (isPresenting) {
      getScattergoriesInteractiveP().then(setInteractive)
    }
  }, [isPresenting])

  if (isPresenting) {
    if (!Interactive) return <LoadingFallback />
    return <Interactive element={{ ...element, isPresenting: true }} />
  }
  const categories = element.categories || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: '100%' }}>
      <div style={{ fontSize: 48, lineHeight: 1 }}>📝</div>
      <div style={{ fontSize: 14, fontWeight: 'bold', color: element.accentColor || '#ec4899' }}>Scattergories</div>
      {categories.length > 0 ? (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 240, padding: '0 8px' }}>
          {categories.slice(0, 6).map((cat, i) => (
            <div key={i} style={{
              background: 'rgba(236,72,153,0.15)',
              border: `1px solid ${element.accentColor || '#ec4899'}`,
              borderRadius: 4,
              padding: '1px 5px',
              fontSize: 9,
              color: element.accentColor || '#ec4899',
              maxWidth: 90,
              textAlign: 'center',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {cat.name || cat}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
          {element.timePerRound || 60}s/round · {element.letterMode || 'random'} letters
        </div>
      )}
    </div>
  )
}

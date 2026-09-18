import React from 'react'
import { LoadingFallback, getFourCornersInteractiveP } from './shared.jsx'
export function FourCornersRenderer({ element, isPresenting }) {
  const [Interactive, setInteractive] = React.useState(null)
  React.useEffect(() => {
    if (isPresenting) {
      getFourCornersInteractiveP().then(setInteractive)
    }
  }, [isPresenting])

  if (isPresenting) {
    if (!Interactive) return <LoadingFallback />
    return <Interactive element={{ ...element, isPresenting: true }} />
  }
  const corners = ['NW', 'NE', 'SW', 'SE']
  const count = element.cornerCount || 4

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: '100%' }}>
      <div style={{ fontSize: 48, lineHeight: 1 }}>🧭</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, width: 120, height: 80 }}>
        {corners.slice(0, count).map((corner, _i) => (
          <div key={corner} style={{
            border: `2px solid ${element.accentColor || '#10b981'}`,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 'bold',
            color: element.accentColor || '#10b981',
            background: `${element.accentColor || '#10b981'}18`,
          }}>
            {corner}
          </div>
        ))}
      </div>
      {element.showTimer && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
          Timer: {element.eliminateMode || 'wrong'} elimination
        </div>
      )}
    </div>
  )
}

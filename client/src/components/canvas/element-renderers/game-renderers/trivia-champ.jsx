import React from 'react'
import { LoadingFallback, getTriviaChampInteractiveP } from './shared.jsx'
export function TriviaChampRenderer({ element, isPresenting }) {
  const [Interactive, setInteractive] = React.useState(null)
  React.useEffect(() => {
    if (isPresenting) {
      getTriviaChampInteractiveP().then(setInteractive)
    }
  }, [isPresenting])

  if (isPresenting) {
    if (!Interactive) return <LoadingFallback />
    return <Interactive element={{ ...element, isPresenting: true }} />
  }
  const rounds = element.rounds || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: '100%' }}>
      <div style={{ fontSize: 48, lineHeight: 1 }}>💡</div>
      <div style={{ fontSize: 14, fontWeight: 'bold', color: element.accentColor || '#8b5cf6' }}>Trivia Championship</div>
      {rounds.length > 0 ? (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>
          {rounds.map(r => r.name || 'Round').join(' · ')}
        </div>
      ) : (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
          Lightning: {element.lightningRound ? 'enabled' : 'off'} · Jackpot: {element.jackpotRound ? 'enabled' : 'off'}
        </div>
      )}
    </div>
  )
}

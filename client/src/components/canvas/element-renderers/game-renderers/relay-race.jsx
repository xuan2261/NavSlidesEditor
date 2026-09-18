import React from 'react'
import { LoadingFallback, getRelayRaceInteractiveP } from './shared.jsx'
export function RelayRaceRenderer({ element, isPresenting }) {
  const [Interactive, setInteractive] = React.useState(null)
  React.useEffect(() => {
    if (isPresenting) {
      getRelayRaceInteractiveP().then(setInteractive)
    }
  }, [isPresenting])

  if (isPresenting) {
    if (!Interactive) return <LoadingFallback />
    return <Interactive element={{ ...element, isPresenting: true }} />
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: '100%' }}>
      <div style={{ fontSize: 48, lineHeight: 1 }}>🏃</div>
      <div style={{ fontSize: 14, fontWeight: 'bold', color: element.accentColor || '#f97316' }}>Relay Race</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
        {element.questionsPerRound || 4} Q/round
        {element.passOnWrong ? ' · Pass on wrong' : ''}
        {element.shuffleTeams ? ' · Shuffle' : ''}
      </div>
    </div>
  )
}

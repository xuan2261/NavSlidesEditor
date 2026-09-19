import React from 'react'
import { useGameSocket } from '../../../../hooks/use-game-socket.js'
import { ConnectionError } from './shared.jsx'
export function WordCloudRenderer({ element, isPresenting }) {
  const cloudConfig = element['word-cloud'] || element
  const socketOptions = React.useMemo(() => ({
    gameType: 'word-cloud',
    options: {
      prompt: cloudConfig.prompt || 'Word Cloud',
      maxPhraseLength: cloudConfig.maxPhraseLength || 40,
      maxSubmissionsPerPlayer: cloudConfig.maxSubmissionsPerPlayer || 5,
      displayLimit: cloudConfig.displayLimit || 50,
    },
  }), [
    cloudConfig.displayLimit,
    cloudConfig.maxPhraseLength,
    cloudConfig.maxSubmissionsPerPlayer,
    cloudConfig.prompt,
  ])
  const socketResult = useGameSocket(
    isPresenting ? element.id || 'word-cloud' : null,
    isPresenting ? 'presenter' : null,
    'host',
    socketOptions
  )
  const { emit, gameState, isConnected, joinError } = socketResult
  const entries = gameState?.entries || []
  const maxCount = Math.max(1, ...entries.map((entry) => entry.count || 0))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 420, alignItems: 'center' }}>
      <div style={{ fontSize: 15, fontWeight: 'bold', color: 'white', textAlign: 'center' }}>
        {cloudConfig.prompt || 'Word Cloud'}
      </div>
      <ConnectionError message={joinError} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', alignItems: 'center', minHeight: 120 }}>
        {entries.length === 0 && (
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>Waiting for submissions…</span>
        )}
        {entries.slice(0, cloudConfig.displayLimit || 50).map((entry) => {
          const size = 12 + Math.round(((entry.count || 1) / maxCount) * 18)
          return (
            <span
              key={entry.text}
              style={{
                color: element.accentColor || '#6366f1',
                fontSize: size,
                fontWeight: 800,
                lineHeight: 1,
                padding: '3px 6px',
              }}
            >
              {entry.text}
            </span>
          )
        })}
      </div>
      {isPresenting && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 4 }}>
          <button
            onClick={() => emit?.('game-word-cloud-start', { gameId: element.id || 'word-cloud' })}
            disabled={!isConnected}
            style={{ background: element.accentColor || '#6366f1', color: 'white', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 'bold' }}
          >
            {isConnected ? 'Start cloud' : 'Connecting…'}
          </button>
          <button
            onClick={() => emit?.('game-word-cloud-reveal', { gameId: element.id || 'word-cloud' })}
            disabled={!isConnected}
            style={{ background: 'rgba(255,255,255,0.16)', color: 'white', border: '1px solid rgba(255,255,255,0.24)', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 'bold' }}
          >
            Refresh
          </button>
          <button
            onClick={() => emit?.('game-word-cloud-clear', { gameId: element.id || 'word-cloud' })}
            disabled={!isConnected}
            style={{ background: 'rgba(239,68,68,0.2)', color: 'white', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 'bold' }}
          >
            Clear
          </button>
        </div>
      )}
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', textAlign: 'center' }}>
        {gameState?.totalSubmissions || 0} submission{gameState?.totalSubmissions === 1 ? '' : 's'} · aggregate only
      </div>
    </div>
  )
}

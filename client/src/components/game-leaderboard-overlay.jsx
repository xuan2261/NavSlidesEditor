import React from 'react'

export function GameLeaderboardOverlay({ visible, scores = [], onClose }) {
  if (!visible) return null
  const sorted = [...scores].sort((a, b) => b.score - a.score)

  return (
    <div
      data-testid="game-leaderboard"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99997,
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          backgroundColor: '#1e1e2e',
          color: '#fff',
          padding: '32px',
          borderRadius: '16px',
          minWidth: '300px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Leaderboard</h2>
        {sorted.length === 0 ? (
          <p style={{ color: 'rgba(255,255,255,0.5)' }}>No scores yet</p>
        ) : (
          <ol style={{ paddingLeft: '24px', lineHeight: '2' }}>
            {sorted.map((entry, i) => {
              const label = entry.team || entry.player || entry.name || entry.playerId || 'Player'
              return (
                <li key={entry.playerId || entry.teamId || entry.team || entry.player || entry.name || i}>
                  {label}: <strong>{entry.score}</strong>
                </li>
              )
            })}
          </ol>
        )}
        <p style={{ marginTop: '20px', fontSize: '12px', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
          Click anywhere to close
        </p>
      </div>
    </div>
  )
}

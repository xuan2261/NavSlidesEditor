import React from 'react'
import { useGameSocket } from '../../../../hooks/use-game-socket.js'
import { ConnectionError } from './shared.jsx'
export function PollRenderer({ element, isPresenting }) {
  const pollConfig = element.poll || element
  const options = React.useMemo(
    () => (Array.isArray(pollConfig.options) ? pollConfig.options : []),
    [pollConfig.options]
  )
  const socketOptions = React.useMemo(() => ({
    gameType: 'poll',
    options: {
      prompt: pollConfig.prompt || 'Live Poll',
      options,
    },
  }), [pollConfig.prompt, options])
  const socketResult = useGameSocket(
    isPresenting ? element.id || 'poll' : null,
    isPresenting ? 'presenter' : null,
    'host',
    socketOptions
  )
  const { emit, gameState, isConnected, joinError } = socketResult
  const aggregateOptions = gameState?.options || options.map(option => ({ ...option, votes: 0 }))
  const totalVotes = gameState?.totalVotes || 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 360 }}>
      <div style={{ fontSize: 15, fontWeight: 'bold', color: 'white', textAlign: 'center' }}>
        {pollConfig.prompt || 'Live Poll'}
      </div>
      <ConnectionError message={joinError} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {aggregateOptions.map((option) => {
          const pct = totalVotes > 0 ? Math.round(((option.votes || 0) / totalVotes) * 100) : 0
          return (
            <div key={option.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>
                <span>{option.text}</span>
                <span>{option.votes || 0} · {pct}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: element.accentColor || '#6366f1' }} />
              </div>
            </div>
          )
        })}
      </div>
      {isPresenting && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 4 }}>
          <button
            onClick={() => emit?.('game-poll-start', { gameId: element.id || 'poll' })}
            disabled={!isConnected}
            style={{ background: element.accentColor || '#6366f1', color: 'white', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 'bold' }}
          >
            {isConnected ? 'Start poll' : 'Connecting…'}
          </button>
          <button
            onClick={() => emit?.('game-poll-reveal', { gameId: element.id || 'poll' })}
            disabled={!isConnected}
            style={{ background: 'rgba(255,255,255,0.16)', color: 'white', border: '1px solid rgba(255,255,255,0.24)', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 'bold' }}
          >
            Refresh
          </button>
        </div>
      )}
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', textAlign: 'center' }}>
        {totalVotes} vote{totalVotes === 1 ? '' : 's'} · anonymous aggregate
      </div>
    </div>
  )
}

import React from 'react'
import { useGameSocket } from '../../../../hooks/use-game-socket.js'
import { ConnectionError } from './shared.jsx'
export function MatchingRenderer({ element, isPresenting }) {
  const matchingConfig = element.matching || element
  const pairs = React.useMemo(
    () => (Array.isArray(matchingConfig.pairs) ? matchingConfig.pairs : []),
    [matchingConfig.pairs]
  )
  const socketOptions = React.useMemo(() => ({
    gameType: 'matching',
    options: {
      prompt: matchingConfig.prompt || 'Matching',
      pairs,
    },
  }), [matchingConfig.prompt, pairs])
  const socketResult = useGameSocket(
    isPresenting ? element.id || 'matching' : null,
    isPresenting ? 'presenter' : null,
    'host',
    socketOptions
  )
  const { emit, gameState, isConnected, joinError } = socketResult
  const prompts = gameState?.prompts || pairs.map(pair => ({ id: pair.promptId, text: pair.prompt }))
  const targets = gameState?.targets || pairs.map(pair => ({ id: pair.targetId, text: pair.target }))
  const promptsById = React.useMemo(() => new Map(prompts.map(prompt => [prompt.id, prompt.text])), [prompts])
  const targetsById = React.useMemo(() => new Map(targets.map(target => [target.id, target.text])), [targets])
  const revealedPairs = (gameState?.answerKey || []).map(pair => ({
    prompt: promptsById.get(pair.promptId) || pair.promptId,
    target: targetsById.get(pair.targetId) || pair.targetId,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 420, alignItems: 'center' }}>
      <div style={{ fontSize: 15, fontWeight: 'bold', color: 'white', textAlign: 'center' }}>
        {matchingConfig.prompt || 'Matching'}
      </div>
      <ConnectionError message={joinError} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%' }}>
        {[prompts, targets].map((items, columnIndex) => (
          <div key={columnIndex} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {items.slice(0, 8).map((item) => (
              <div
                key={item.id}
                style={{
                  border: '1px solid rgba(255,255,255,0.18)',
                  borderRadius: 8,
                  padding: '6px 8px',
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.86)',
                  background: 'rgba(255,255,255,0.08)',
                }}
              >
                {item.text}
              </div>
            ))}
          </div>
        ))}
      </div>
      {isPresenting && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 4 }}>
          <button
            onClick={() => emit?.('game-matching-start', { gameId: element.id || 'matching' })}
            disabled={!isConnected}
            style={{ background: element.accentColor || '#6366f1', color: 'white', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 'bold' }}
          >
            {isConnected ? 'Start matching' : 'Connecting…'}
          </button>
          <button
            onClick={() => emit?.('game-matching-reveal', { gameId: element.id || 'matching' })}
            disabled={!isConnected}
            style={{ background: 'rgba(255,255,255,0.16)', color: 'white', border: '1px solid rgba(255,255,255,0.24)', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 'bold' }}
          >
            Reveal
          </button>
        </div>
      )}
      {revealedPairs.length > 0 && (
        <div style={{ width: '100%', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 8, padding: 8, fontSize: 10, color: 'rgba(255,255,255,0.75)' }}>
          <strong style={{ display: 'block', color: 'white', marginBottom: 4 }}>Answers</strong>
          {revealedPairs.map((pair, index) => (
            <div key={`${pair.prompt}-${index}`}>{pair.prompt} → {pair.target}</div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', textAlign: 'center' }}>
        {gameState?.submissions || 0} submission{gameState?.submissions === 1 ? '' : 's'} · pair IDs only
      </div>
    </div>
  )
}

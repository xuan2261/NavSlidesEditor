/**
 * Four Corners Interactive — Phase 10.
 * Phase 3: static grid. Phase 10: animated corner selection, timer, predictions, elimination, winner.
 */
import React, { useState, useEffect, useCallback } from 'react'

const CORNERS = [
  { id: 'NW', label: 'A', icon: '◤' },
  { id: 'NE', label: 'B', icon: '◥' },
  { id: 'SE', label: 'C', icon: '◢' },
  { id: 'SW', label: 'D', icon: '◣' },
]

function CircularTimer({ secondsLeft, totalSeconds, color, size = 48 }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const dashoffset = circ * (1 - secondsLeft / totalSeconds)

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={circ} strokeDashoffset={dashoffset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.9s linear' }}
      />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        fill="white" fontSize="12" fontWeight="bold" fontFamily="sans-serif"
        style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}>
        {secondsLeft}
      </text>
    </svg>
  )
}

function LeaderboardOverlay({ scores, visible }) {
  if (!visible) return null
  const sorted = [...scores].sort((a, b) => b.score - a.score)

  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 8, zIndex: 50, padding: 16,
    }}>
      <div style={{ fontSize: 10, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Leaderboard</div>
      {sorted.map((entry, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: i === 0 ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.05)',
          borderRadius: 6, padding: '4px 12px', width: '100%', maxWidth: 200,
          border: i === 0 ? '1px solid rgba(255,215,0,0.4)' : '1px solid rgba(255,255,255,0.1)',
        }}>
          <span style={{ color: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : 'rgba(255,255,255,0.3)', fontSize: 14, fontWeight: 'bold' }}>
            {i === 0 ? '👑' : `#${i + 1}`}
          </span>
          <span style={{ color: 'white', fontSize: 12, flex: 1 }}>{entry.name}</span>
          <span style={{ color: '#10b981', fontSize: 12, fontWeight: 'bold' }}>{entry.score} pts</span>
        </div>
      ))}
    </div>
  )
}

function FourCornersLive({ element }) {
  const [gamePhase, setGamePhase] = useState('setup')
  const [secondsLeft, setSecondsLeft] = useState(element.timerDuration || 30)
  const [correctCorner, setCorrectCorner] = useState(null)
  const [eliminated, setEliminated] = useState([])
  const [playerCornerVotes, setPlayerCornerVotes] = useState({})
  const [scores, setScores] = useState(() => (element.players || []).map(p => ({ name: p, score: 0 })))
  const [winner, setWinner] = useState(null)

  useEffect(() => {
    if (gamePhase !== 'guessing') return
    if (secondsLeft <= 0) { setGamePhase('revealed'); return }
    const id = setTimeout(() => setSecondsLeft(s => s - 1), 1000)
    return () => clearTimeout(id)
  }, [gamePhase, secondsLeft])

  const handleStartRound = useCallback(() => {
    const questions = element.questions || []
    if (questions.length === 0) return
    const q = questions[Math.floor(Math.random() * questions.length)]
    setCorrectCorner(q.corner || CORNERS[Math.floor(Math.random() * CORNERS.length)].id)
    setSecondsLeft(element.timerDuration || 30)
    setGamePhase('guessing')
    setEliminated([])
    setPlayerCornerVotes({})
  }, [element.questions, element.timerDuration])

  const handleReveal = useCallback(() => {
    setGamePhase('revealed')
    const newScores = [...scores]
    const newEliminated = []

    Object.entries(playerCornerVotes).forEach(([player, corner]) => {
      const idx = newScores.findIndex(s => s.name === player)
      if (idx === -1) return
      if (corner === correctCorner) {
        newScores[idx] = { ...newScores[idx], score: newScores[idx].score + 10 }
      } else if (element.eliminateMode === 'wrong') {
        newEliminated.push(player)
      }
    })

    setScores(newScores)
    setEliminated(newEliminated)

    if (newEliminated.length === newScores.length - 1 && newScores.length > 1) {
      const wc = newScores.find(s => !newEliminated.includes(s.name))
      if (wc) { setWinner(wc); setGamePhase('ended') }
    }
  }, [playerCornerVotes, correctCorner, scores, element.eliminateMode])

  const accent = element.accentColor || '#10b981'
  const totalSeconds = element.timerDuration || 30

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: '100%', position: 'relative' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.15em', color: accent, textTransform: 'uppercase', fontWeight: 'bold' }}>Four Corners</div>

      {gamePhase === 'setup' && (
        <>
          <div style={{ fontSize: 48, lineHeight: 1 }}>🧭</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
            {element.questions ? `${element.questions.length} questions` : 'Add questions in properties'}
          </div>
          <button onClick={handleStartRound} style={{ background: accent, color: 'white', border: 'none', borderRadius: 8, padding: '8px 24px', fontSize: 13, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
            START ROUND
          </button>
        </>
      )}

      {gamePhase === 'guessing' && (
        <>
          <CircularTimer secondsLeft={secondsLeft} totalSeconds={totalSeconds} color={accent} />
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Choose your corner!</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, width: 140, height: 90 }}>
            {CORNERS.slice(0, element.cornerCount || 4).map(c => {
              const voters = Object.entries(playerCornerVotes).filter(([, v]) => v === c.id).map(([p]) => p)
              return (
                <div key={c.id} style={{
                  border: `2px solid ${accent}`, borderRadius: 6,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 'bold', color: accent,
                  background: `${accent}${voters.length > 0 ? '30' : '12'}`,
                  transition: 'background 0.3s', gap: 2,
                }}>
                  <span>{c.icon}</span>
                  <span style={{ fontSize: 8, color: voters.length > 0 ? 'white' : 'rgba(255,255,255,0.3)' }}>
                    {voters.length > 0 ? `${voters.length} player${voters.length !== 1 ? 's' : ''}` : '—'}
                  </span>
                </div>
              )
            })}
          </div>
          <button onClick={handleReveal} style={{ background: accent, color: 'white', border: 'none', borderRadius: 8, padding: '6px 20px', fontSize: 12, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
            REVEAL ANSWER
          </button>
        </>
      )}

      {gamePhase === 'revealed' && (
        <>
          <div style={{ fontSize: 40, lineHeight: 1 }}>🔓</div>
          <div style={{ fontSize: 16, fontWeight: 'bold', color: '#10b981' }}>Correct: {correctCorner}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, width: 140, height: 90 }}>
            {CORNERS.slice(0, element.cornerCount || 4).map(c => {
              const isCorrect = c.id === correctCorner
              const isElim = eliminated.includes(c.id)
              return (
                <div key={c.id} style={{
                  borderRadius: 6, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 'bold',
                  background: isCorrect ? '#10b98150' : isElim ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)',
                  border: `2px solid ${isCorrect ? '#10b981' : isElim ? '#ef4444' : 'rgba(255,255,255,0.2)'}`,
                  color: isCorrect ? '#10b981' : isElim ? '#ef4444' : 'white',
                  opacity: isElim ? 0.5 : 1, transition: 'all 0.5s', gap: 2,
                }}>
                  <span>{c.icon}</span>
                  <span style={{ fontSize: 8 }}>{isCorrect ? 'CORRECT' : isElim ? 'OUT' : ''}</span>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleStartRound} style={{ background: accent, color: 'white', border: 'none', borderRadius: 8, padding: '6px 16px', fontSize: 11, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
              NEXT ROUND
            </button>
            <button onClick={() => setGamePhase('ended')} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '6px 16px', fontSize: 11, cursor: 'pointer', fontFamily: 'sans-serif' }}>
              END GAME
            </button>
          </div>
        </>
      )}

      {gamePhase === 'ended' && winner && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 64, lineHeight: 1 }}>🏆</div>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: '#ffd700' }}>Winner!</div>
          <div style={{ fontSize: 16, color: 'white' }}>{winner.name}</div>
          <div style={{ fontSize: 12, color: '#10b981' }}>{winner.score} points</div>
        </div>
      )}

      {gamePhase === 'ended' && !winner && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 48, lineHeight: 1 }}>🏁</div>
          <div style={{ fontSize: 14, color: 'white' }}>Game Over</div>
        </div>
      )}

      <LeaderboardOverlay scores={scores} visible={gamePhase === 'ended'} />
    </div>
  )
}

export function FourCornersRenderer({ element }) {
  if (element.isPresenting) {
    return <FourCornersLive element={element} />
  }
  const accent = element.accentColor || '#10b981'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: '100%' }}>
      <div style={{ fontSize: 48, lineHeight: 1 }}>🧭</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, width: 120, height: 80 }}>
        {CORNERS.slice(0, element.cornerCount || 4).map(c => (
          <div key={c.id} style={{
            border: `2px solid ${accent}`, borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 'bold', color: accent, background: `${accent}18`,
          }}>
            {c.label}
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

/**
 * Trivia Championship Interactive — Phase 10.
 * Phase 3: static preview. Phase 10: round tabs, lightning round, jackpot round, buzzer, crown.
 */
import React, { useState, useEffect, useCallback, useRef, startTransition } from 'react'

const ROUND_DEFS = [
  { id: 0, name: 'Round 1', mode: 'individual', timeLimit: 10, label: 'Individual' },
  { id: 1, name: 'Round 2', mode: 'team', timeLimit: 30, label: 'Team' },
  { id: 2, name: 'Final', mode: 'buzzer', label: 'Buzzer' },
]

function BuzzerDisplay({ activePlayer, _scores, _accent }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ fontSize: 64, lineHeight: 1, animation: 'pulse 0.5s infinite alternate' }}>
        {activePlayer ? '🔔' : '⏳'}
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontFamily: 'sans-serif' }}>
        {activePlayer ? `${activePlayer} buzzed!` : 'Waiting for buzz…'}
      </div>
      {activePlayer && (
        <div style={{ fontSize: 10, color: '#10b981', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
          +10 pts
        </div>
      )}
    </div>
  )
}

function LightningDisplay({ questions, _currentQ, qIndex, _scores, _accent }) {
  const [secondsLeft, setSecondsLeft] = useState(10)
  const [phase, setPhase] = useState('question') // question | revealed | done

  useEffect(() => {
    if (phase !== 'question') return
    if (secondsLeft <= 0) { startTransition(() => { setPhase('revealed') }); return }
    const id = setTimeout(() => setSecondsLeft(s => s - 1), 1000)
    return () => clearTimeout(id)
  }, [phase, secondsLeft])

  const q = questions[qIndex]
  if (!q) return <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Lightning done!</div>

  const r = 22
  const circ = 2 * Math.PI * r
  const dashoffset = circ * (1 - secondsLeft / 10)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ fontSize: 9, color: '#fbbf24', fontFamily: 'sans-serif', fontWeight: 'bold', letterSpacing: '0.2em' }}>
        ⚡ LIGHTNING ×3 ⚡
      </div>
      <svg width={48} height={48} viewBox="0 0 48 48" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={24} cy={24} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
        <circle cx={24} cy={24} r={r} fill="none" stroke="#fbbf24" strokeWidth="3"
          strokeDasharray={circ} strokeDashoffset={dashoffset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.9s linear' }} />
      </svg>
      <div style={{ fontSize: 14, fontWeight: 'bold', color: 'white', fontFamily: 'sans-serif', textAlign: 'center' }}>
        {q.question}
      </div>
      {phase === 'revealed' && (
        <div style={{ fontSize: 12, color: '#10b981', fontFamily: 'sans-serif' }}>
          Answer: {q.options?.[q.correctIndex]}
        </div>
      )}
    </div>
  )
}

function JackpotDisplay({ question, _accent }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ fontSize: 9, color: '#ef4444', fontFamily: 'sans-serif', fontWeight: 'bold', letterSpacing: '0.2em' }}>
        💰 JACKPOT ×5 💰
      </div>
      <div style={{ fontSize: 48, lineHeight: 1 }}>🎯</div>
      <div style={{ fontSize: 12, color: 'white', fontFamily: 'sans-serif', textAlign: 'center', maxWidth: 200 }}>
        {question?.question || 'Final question?'}
      </div>
      {!revealed ? (
        <button onClick={() => setRevealed(true)} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 12, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
          REVEAL
        </button>
      ) : (
        <div style={{ fontSize: 14, color: '#10b981', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
          {question?.options?.[question?.correctIndex]}
        </div>
      )}
    </div>
  )
}

function TriviaChampLive({ element }) {
  const [currentRound, setCurrentRound] = useState(0)
  const [scores, setScores] = useState(() => (element.teams || []).map(t => ({ name: t.name || t, score: 0 })))
  const [buzzerPlayer, setBuzzerPlayer] = useState(null)
  const [buzzerLocked, setBuzzerLocked] = useState(false)
  const [lightningActive, setLightningActive] = useState(false)
  const [lightningQIndex, setLightningQIndex] = useState(0)
  const [jackpotActive, setJackpotActive] = useState(false)
  const [gamePhase, setGamePhase] = useState('setup') // setup | playing | ended
  const [winner, setWinner] = useState(null)
  const buzzerRef = useRef(false)

  const questions = element.questions || []
  const accent = element.accentColor || '#8b5cf6'
  const round = ROUND_DEFS[currentRound]

  const handleBuzzer = useCallback((playerName) => {
    if (buzzerLocked) return
    buzzerRef.current = true
    setBuzzerLocked(true)
    setBuzzerPlayer(playerName)
    setScores(prev => prev.map(s =>
      s.name === playerName ? { ...s, score: s.score + 10 } : s
    ))
    setTimeout(() => {
      buzzerRef.current = false
      setBuzzerLocked(false)
      setBuzzerPlayer(null)
    }, 2000)
  }, [buzzerLocked])

  const handleStartLightning = useCallback(() => {
    setLightningActive(true)
    setLightningQIndex(0)
    setGamePhase('playing')
  }, [])

  const handleStartJackpot = useCallback(() => {
    setJackpotActive(true)
    setGamePhase('playing')
  }, [])

  const handleEndGame = useCallback(() => {
    setGamePhase('ended')
    const sorted = [...scores].sort((a, b) => b.score - a.score)
    if (sorted.length > 0) setWinner(sorted[0])
  }, [scores])

  const sortedScores = [...scores].sort((a, b) => b.score - a.score)

  if (!element.isPresenting) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: '100%' }}>
        <div style={{ fontSize: 48, lineHeight: 1 }}>💡</div>
        <div style={{ fontSize: 14, fontWeight: 'bold', color: accent }}>Trivia Championship</div>
        {element.rounds && element.rounds.length > 0 ? (
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>
            {element.rounds.map(r => r.name || 'Round').join(' · ')}
          </div>
        ) : (
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
            Lightning: {element.lightningRound?.enabled ? 'on' : 'off'} · Jackpot: {element.jackpotRound?.enabled ? 'on' : 'off'}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: '100%', position: 'relative' }}>
      {/* Round tabs */}
      <div style={{ display: 'flex', gap: 4 }}>
        {ROUND_DEFS.map(r => (
          <button key={r.id} onClick={() => setCurrentRound(r.id)}
            style={{
              padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 10, fontFamily: 'sans-serif', fontWeight: 'bold',
              background: currentRound === r.id ? accent : 'rgba(255,255,255,0.1)',
              color: currentRound === r.id ? 'white' : 'rgba(255,255,255,0.4)',
              transition: 'all 0.2s',
            }}>
            {r.name}
          </button>
        ))}
      </div>

      {/* Mode label */}
      <div style={{ fontSize: 9, color: accent, letterSpacing: '0.15em', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
        {round.label} · {round.timeLimit ? `${round.timeLimit}s` : 'no limit'}
      </div>

      {/* Lightning */}
      {lightningActive && (
        <LightningDisplay questions={questions} qIndex={lightningQIndex} scores={scores} accent={accent} />
      )}

      {/* Jackpot */}
      {jackpotActive && (
        <JackpotDisplay question={questions[0]} accent={accent} />
      )}

      {/* Buzzer */}
      {round.mode === 'buzzer' && !lightningActive && !jackpotActive && (
        <BuzzerDisplay activePlayer={buzzerPlayer} scores={scores} accent={accent} />
      )}

      {/* Scores */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%', maxWidth: 180 }}>
        {sortedScores.map((s, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: i === 0 ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.04)',
            borderRadius: 4, padding: '3px 8px',
            border: i === 0 ? '1px solid rgba(255,215,0,0.3)' : '1px solid rgba(255,255,255,0.08)',
          }}>
            <span style={{ fontSize: 9, color: i === 0 ? '#ffd700' : 'rgba(255,255,255,0.3)', fontFamily: 'sans-serif', fontWeight: 'bold', minWidth: 14 }}>
              {i === 0 ? '👑' : `${i + 1}.`}
            </span>
            <span style={{ fontSize: 10, color: 'white', fontFamily: 'sans-serif', flex: 1 }}>{s.name}</span>
            <span style={{ fontSize: 10, color: accent, fontFamily: 'sans-serif', fontWeight: 'bold' }}>{s.score}</span>
          </div>
        ))}
      </div>

      {/* Presenter controls */}
      {gamePhase !== 'ended' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
          {element.lightningRound?.enabled && !lightningActive && (
            <button onClick={handleStartLightning} style={{ background: '#fbbf24', color: '#1a1a2e', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 9, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
              ⚡ Lightning
            </button>
          )}
          {element.jackpotRound?.enabled && !jackpotActive && (
            <button onClick={handleStartJackpot} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 9, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
              💰 Jackpot
            </button>
          )}
          {round.mode === 'buzzer' && scores.length > 0 && (
            <button onClick={() => handleBuzzer(scores[0].name)} style={{ background: accent, color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 9, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
              🔔 Buzz ({scores[0].name})
            </button>
          )}
          <button onClick={handleEndGame} style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '4px 10px', fontSize: 9, cursor: 'pointer', fontFamily: 'sans-serif' }}>
            End
          </button>
        </div>
      )}

      {/* Champion */}
      {gamePhase === 'ended' && winner && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: 56, lineHeight: 1 }}>🏆</div>
          <div style={{ fontSize: 18, fontWeight: 'bold', color: '#ffd700' }}>Champion!</div>
          <div style={{ fontSize: 14, color: 'white', fontFamily: 'sans-serif' }}>{winner.name}</div>
          <div style={{ fontSize: 12, color: accent, fontFamily: 'sans-serif' }}>{winner.score} pts</div>
        </div>
      )}
    </div>
  )
}

export function TriviaChampRenderer({ element }) {
  if (element.isPresenting) {
    return <TriviaChampLive element={element} />
  }
  const accent = element.accentColor || '#8b5cf6'
  const rounds = element.rounds || []
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: '100%' }}>
      <div style={{ fontSize: 48, lineHeight: 1 }}>💡</div>
      <div style={{ fontSize: 14, fontWeight: 'bold', color: accent }}>Trivia Championship</div>
      {rounds.length > 0 ? (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>{rounds.map(r => r.name || 'Round').join(' · ')}</div>
      ) : (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
          Lightning: {element.lightningRound?.enabled ? 'on' : 'off'} · Jackpot: {element.jackpotRound?.enabled ? 'on' : 'off'}
        </div>
      )}
    </div>
  )
}

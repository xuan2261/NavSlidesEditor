/**
 * Relay Race Interactive — Phase 10.
 * Phase 3: static preview. Phase 10: team lanes, position indicators, pass-on-wrong mechanic.
 */
import React, { useState, useEffect, useCallback } from 'react'

function LinearTimer({ secondsLeft, totalSeconds, color }) {
  const pct = Math.max(0, (secondsLeft / totalSeconds) * 100)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: '100%', maxWidth: 200 }}>
      <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.95s linear' }} />
      </div>
      <div style={{ fontSize: 11, color: 'white', fontFamily: 'sans-serif', fontWeight: 'bold' }}>{secondsLeft}s</div>
    </div>
  )
}

function RelayLane({ team, position, totalPositions, accent, isActive, _correctAnswer, showResult }) {
  const laneH = 36
  const trackW = 180
  const stepW = trackW / Math.max(totalPositions, 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: team.color, flexShrink: 0 }} />
        <span style={{ fontSize: 10, color: 'white', fontFamily: 'sans-serif', minWidth: 60 }}>{team.name}</span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontFamily: 'sans-serif' }}>{position}/{totalPositions}</span>
      </div>
      <div style={{ position: 'relative', height: laneH, background: 'rgba(255,255,255,0.05)', borderRadius: 4, border: `1px solid ${isActive ? accent : 'rgba(255,255,255,0.1)'}` }}>
        {/* Position markers */}
        {Array.from({ length: totalPositions + 1 }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute', left: i * stepW - 1, top: 0, bottom: 0, width: 1,
            background: 'rgba(255,255,255,0.1)',
          }} />
        ))}
        {/* BatON */}
        <div style={{
          position: 'absolute',
          left: Math.min(position * stepW - 8, trackW - 10),
          top: (laneH - 20) / 2,
          width: 16, height: 20, borderRadius: 4,
          background: showResult === true ? '#10b981' : showResult === false ? '#ef4444' : accent,
          transition: 'left 0.4s ease',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, color: 'white', fontWeight: 'bold',
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
        }}>
          {showResult === true ? '✓' : showResult === false ? '✗' : '🏃'}
        </div>
        {/* Finish line */}
        <div style={{ position: 'absolute', right: 2, top: 0, bottom: 0, width: 2, background: 'rgba(255,255,255,0.3)' }} />
      </div>
    </div>
  )
}

function RelayLive({ element }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- teams is stable derived from prop; all deps are explicit in consuming useCallbacks
  const teams = element.teams || [
    { name: 'Team A', color: '#3b82f6' },
    { name: 'Team B', color: '#ef4444' },
  ]
  const [positions, setPositions] = useState(teams.map(() => 0))
  const [currentTeam, setCurrentTeam] = useState(0)
  const [round, _setRound] = useState(1)
  const [gamePhase, setGamePhase] = useState('setup') // setup | active | waiting | ended
  const [showResult, setShowResult] = useState(null) // null | true | false
  const [questions, _setQuestions] = useState(element.questions || [])
  const [currentQ, setCurrentQ] = useState(null)
  const [winner, setWinner] = useState(null)

  const totalPositions = element.questionsPerRound || 4

  // Server-authoritative timer: read from window.__timerStates (set by parent LiveViewPage)
  const timerState = (typeof window !== 'undefined' && window.parent && window.parent.__timerStates)
    ? (window.parent.__timerStates[element.id] || {})
    : {}
  const secondsLeft = timerState.remaining ?? element.timerDuration ?? 30
  const _isTimerRunning = timerState.running ?? false

  const startRound = useCallback(() => {
    if (questions.length === 0) return
    const q = questions[Math.floor(Math.random() * questions.length)]
    setCurrentQ(q)
    setGamePhase('active')
    setShowResult(null)
    if (element.shuffleTeams) {
      setPositions(prev => prev.map(() => 0))
    }
    // Emit timer-start via parent bridge
    if (typeof window !== 'undefined' && window.parent && typeof window.parent.__emitTimerEvent === 'function') {
      window.parent.__emitTimerEvent('game-timer-start', { elementId: element.id, duration: element.timerDuration || 30 })
    }
  }, [questions, element.timerDuration, element.shuffleTeams, element.id])

  const passToNextTeam = useCallback((wasCorrect) => {
    setShowResult(wasCorrect)
    setGamePhase('waiting')

    setTimeout(() => {
      const newPositions = [...positions]
      if (wasCorrect) {
        newPositions[currentTeam] = Math.min(newPositions[currentTeam] + 1, totalPositions)
      }

      // Check win
      if (newPositions[currentTeam] >= totalPositions) {
        setPositions(newPositions)
        setWinner(teams[currentTeam])
        setGamePhase('ended')
        return
      }

      // Pass baton to next team
      const nextTeam = (currentTeam + 1) % teams.length
      setPositions(newPositions)
      setCurrentTeam(nextTeam)
      setShowResult(null)

      if (element.passOnWrong && !wasCorrect) {
        // Advance opponent instead
        setPositions(prev => {
          const updated = [...prev]
          updated[nextTeam] = Math.min(updated[nextTeam] + 1, totalPositions)
          if (updated[nextTeam] >= totalPositions) {
            setWinner(teams[nextTeam])
            setGamePhase('ended')
          }
          return updated
        })
        setCurrentTeam((currentTeam + 2) % teams.length)
      }

      // Pick next question
      const nextQ = questions[Math.floor(Math.random() * questions.length)]
      setCurrentQ(nextQ)
      setGamePhase('active')
      // Restart server timer for next round
      if (typeof window !== 'undefined' && window.parent && typeof window.parent.__emitTimerEvent === 'function') {
        window.parent.__emitTimerEvent('game-timer-start', { elementId: element.id, duration: element.timerDuration || 30 })
      }
    }, 1200)
  }, [positions, currentTeam, teams, totalPositions, questions, element.timerDuration, element.passOnWrong, element.id])

  // Poll server timer to detect when 'active' phase ends with passOnWrong
  useEffect(() => {
    if (gamePhase !== 'active' || !element.passOnWrong) return
    const didTriggerRef = { current: false }
    const id = setInterval(() => {
      const state = (typeof window !== 'undefined' && window.parent && window.parent.__timerStates)
        ? (window.parent.__timerStates[element.id] || {})
        : {}
      const running = state.running ?? false
      const remaining = state.remaining ?? (element.timerDuration || 30)
      if (!running && remaining <= 0 && !didTriggerRef.current) {
        didTriggerRef.current = true
        passToNextTeam(false)
      }
    }, 200)
    return () => clearInterval(id)
  }, [gamePhase, element.id, element.timerDuration, element.passOnWrong, passToNextTeam])

  const handleCorrect = () => { passToNextTeam(true) }
  const handleWrong = () => { passToNextTeam(false) }

  const accent = element.accentColor || '#f97316'
  const totalSeconds = timerState.duration ?? element.timerDuration ?? 30

  if (!element.isPresenting) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: '100%' }}>
        <div style={{ fontSize: 48, lineHeight: 1 }}>🏃</div>
        <div style={{ fontSize: 14, fontWeight: 'bold', color: accent }}>Relay Race</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
          {element.questionsPerRound || 4} Q/round{element.passOnWrong ? ' · Pass on wrong' : ''}{element.shuffleTeams ? ' · Shuffle' : ''}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', height: '100%' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.15em', color: accent, textTransform: 'uppercase', fontWeight: 'bold' }}>
        Relay Race — Round {round}
      </div>

      {gamePhase === 'setup' && (
        <>
          <div style={{ fontSize: 48, lineHeight: 1 }}>🏃</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
            {questions.length > 0 ? `${questions.length} questions` : 'Add questions in properties'}
          </div>
          <button onClick={startRound} style={{ background: accent, color: 'white', border: 'none', borderRadius: 8, padding: '8px 24px', fontSize: 13, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
            START
          </button>
        </>
      )}

      {(gamePhase === 'active' || gamePhase === 'waiting') && currentQ && (
        <>
          <LinearTimer secondsLeft={secondsLeft} totalSeconds={totalSeconds} color={accent} />
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '8px 12px', maxWidth: 220, border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Question</div>
            <div style={{ fontSize: 12, color: 'white', fontFamily: 'sans-serif', textAlign: 'center' }}>{currentQ.question}</div>
          </div>
          <div style={{ fontSize: 10, color: teams[currentTeam]?.color || accent, fontFamily: 'sans-serif', fontWeight: 'bold' }}>
            → {teams[currentTeam]?.name || 'Team'}&apos;s turn
          </div>
          {gamePhase === 'active' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleCorrect} style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 12, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
                ✓ CORRECT
              </button>
              <button onClick={handleWrong} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 12, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
                ✗ WRONG
              </button>
            </div>
          )}
          {gamePhase === 'waiting' && (
            <div style={{ fontSize: 12, color: showResult ? (showResult ? '#10b981' : '#ef4444') : 'rgba(255,255,255,0.5)', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
              {showResult === true ? 'Correct! Advancing…' : showResult === false ? 'Wrong! Passing baton…' : '…'}
            </div>
          )}
        </>
      )}

      {/* Lanes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 220 }}>
        {teams.map((team, i) => (
          <RelayLane
            key={i}
            team={team}
            position={positions[i]}
            totalPositions={totalPositions}
            accent={accent}
            isActive={i === currentTeam}
            showResult={i === currentTeam ? showResult : null}
          />
        ))}
      </div>

      {gamePhase === 'ended' && winner && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 48, lineHeight: 1 }}>🏆</div>
          <div style={{ fontSize: 16, fontWeight: 'bold', color: '#ffd700' }}>{winner.name} Wins!</div>
        </div>
      )}
    </div>
  )
}

export function RelayRaceRenderer({ element }) {
  if (element.isPresenting) {
    return <RelayLive element={element} />
  }
  const accent = element.accentColor || '#f97316'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: '100%' }}>
      <div style={{ fontSize: 48, lineHeight: 1 }}>🏃</div>
      <div style={{ fontSize: 14, fontWeight: 'bold', color: accent }}>Relay Race</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
        {element.questionsPerRound || 4} Q/round{element.passOnWrong ? ' · Pass on wrong' : ''}{element.shuffleTeams ? ' · Shuffle' : ''}
      </div>
    </div>
  )
}

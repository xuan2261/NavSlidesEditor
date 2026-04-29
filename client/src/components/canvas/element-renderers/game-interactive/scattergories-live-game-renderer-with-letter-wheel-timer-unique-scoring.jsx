/**
 * Scattergories Interactive — Phase 10.
 * Phase 3: static preview. Phase 10: letter spinner, 60s timer, category grid, unique scoring.
 */
import React, { useState, useEffect, useCallback } from 'react'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

const DEFAULT_CATEGORIES = ['Food', 'Animal', 'Country', 'Name', 'Thing', 'Color']

function LetterSpinner({ letter, spinning, accent }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        background: spinning ? `conic-gradient(${accent} 0deg, rgba(255,255,255,0.1) 30deg)` : `${accent}22`,
        border: `3px solid ${accent}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: spinning ? 'spin 0.1s linear infinite' : 'none',
        boxShadow: `0 0 16px ${accent}40`,
      }}>
        <span style={{
          fontSize: 28, fontWeight: 'bold', color: 'white',
          fontFamily: 'sans-serif',
          animation: spinning ? 'none' : 'none',
        }}>
          {letter || '?'}
        </span>
      </div>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontFamily: 'sans-serif', letterSpacing: '0.1em' }}>
        {spinning ? 'SPINNING…' : letter ? 'STARTS WITH' : 'PRESS SPIN'}
      </div>
    </div>
  )
}

function CategoryGrid({ categories, answers, letter, accent }) {
  const cats = categories.length > 0 ? categories : DEFAULT_CATEGORIES.map(n => ({ name: n }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', maxWidth: 220 }}>
      {cats.map((cat, i) => {
        const answer = answers[cat.name || cat] || ''
        const valid = letter && answer.length > 0 && answer.toUpperCase().startsWith(letter)
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 4, padding: '4px 8px',
            border: `1px solid ${valid ? '#10b981' : 'rgba(255,255,255,0.08)'}`,
          }}>
            <span style={{ fontSize: 8, color: accent, fontFamily: 'sans-serif', fontWeight: 'bold', minWidth: 48, flexShrink: 0 }}>
              {cat.name || cat}
            </span>
            <span style={{
              fontSize: 10, color: valid ? '#10b981' : 'rgba(255,255,255,0.6)',
              fontFamily: 'sans-serif', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {answer || '—'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function UniqueScoringOverlay({ answers, letter, teams, visible }) {
  if (!visible) return null
  const cats = Object.keys(answers)
  const allAnswers = {} // category -> { team -> answer }
  cats.forEach(cat => {
    allAnswers[cat] = {}
    teams.forEach(t => {
      const ans = answers[cat]?.[t] || ''
      allAnswers[cat][t] = ans
    })
  })

  // Count occurrences per answer per category
  const scores = {}
  teams.forEach(t => { scores[t] = 0 })

  cats.forEach(cat => {
    const byAnswer = {}
    teams.forEach(t => {
      const a = (allAnswers[cat][t] || '').trim()
      if (!a) return
      const key = a.toLowerCase()
      if (!byAnswer[key]) byAnswer[key] = []
      byAnswer[key].push(t)
    })
    // Unique: only teams with sole answer get points
    Object.entries(byAnswer).forEach(([, teamList]) => {
      if (teamList.length === 1) {
        scores[teamList[0]] += 10
      }
    })
  })

  const sorted = teams.map(t => ({ name: t, score: scores[t] })).sort((a, b) => b.score - a.score)

  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.88)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 8, zIndex: 50, padding: 16,
    }}>
      <div style={{ fontSize: 10, letterSpacing: '0.2em', color: '#ec4899', textTransform: 'uppercase', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
        ✨ Unique Answers Score ✨
      </div>
      {sorted.map((entry, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: i === 0 ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.05)',
          borderRadius: 6, padding: '4px 12px', width: '100%', maxWidth: 200,
          border: i === 0 ? '1px solid rgba(255,215,0,0.4)' : '1px solid rgba(255,255,255,0.1)',
        }}>
          <span style={{ fontSize: 14, fontWeight: 'bold', color: i === 0 ? '#ffd700' : 'rgba(255,255,255,0.3)' }}>
            {i === 0 ? '👑' : `#${i + 1}`}
          </span>
          <span style={{ fontSize: 12, color: 'white', fontFamily: 'sans-serif', flex: 1 }}>{entry.name}</span>
          <span style={{ fontSize: 12, color: '#ec4899', fontFamily: 'sans-serif', fontWeight: 'bold' }}>{entry.score}</span>
        </div>
      ))}
    </div>
  )
}

function ScatterLive({ element }) {
  const teams = element.teams?.map(t => t.name || t) || ['Team A', 'Team B']
  const categories = element.categories || []
  const timePerRound = element.timePerRound || 60
  const [letter, setLetter] = useState(null)
  const [spinning, setSpinning] = useState(false)
  const [timeLeft, setTimeLeft] = useState(timePerRound)
  const [gamePhase, setGamePhase] = useState('setup') // setup | spinning | playing | scoring | ended
  const [answers, setAnswers] = useState({}) // category -> team -> answer text
  const [winner, setWinner] = useState(null)
  const [showScoring, setShowScoring] = useState(false)

  useEffect(() => {
    if (gamePhase !== 'playing') return
    if (timeLeft <= 0) { setGamePhase('scoring'); setShowScoring(true); return }
    const id = setTimeout(() => setTimeLeft(s => s - 1), 1000)
    return () => clearTimeout(id)
  }, [gamePhase, timeLeft])

  const handleSpin = useCallback(() => {
    setSpinning(true)
    setGamePhase('spinning')
    let spins = 0
    const interval = setInterval(() => {
      setLetter(ALPHABET[Math.floor(Math.random() * ALPHABET.length)])
      spins++
      if (spins > 20) {
        clearInterval(interval)
        setTimeout(() => {
          const finalLetter = ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
          setLetter(finalLetter)
          setSpinning(false)
          setTimeLeft(timePerRound)
          setGamePhase('playing')
          setAnswers({})
        }, 400)
      }
    }, 80)
  }, [timePerRound])

  const handleAnswer = useCallback((category, text) => {
    setAnswers(prev => ({ ...prev, [category]: text }))
  }, [])

  const handleEndRound = useCallback(() => {
    setShowScoring(true)
    setGamePhase('scoring')
  }, [])

  const handleNewRound = useCallback(() => {
    setLetter(null)
    setTimeLeft(timePerRound)
    setGamePhase('setup')
    setAnswers({})
    setShowScoring(false)
    setWinner(null)
  }, [timePerRound])

  const accent = element.accentColor || '#ec4899'
  const pct = (timeLeft / timePerRound) * 100

  if (!element.isPresenting) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: '100%' }}>
        <div style={{ fontSize: 48, lineHeight: 1 }}>📝</div>
        <div style={{ fontSize: 14, fontWeight: 'bold', color: accent }}>Scattergories</div>
        {categories.length > 0 ? (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 240, padding: '0 8px' }}>
            {categories.slice(0, 6).map((cat, i) => (
              <div key={i} style={{
                background: 'rgba(236,72,153,0.15)', border: `1px solid ${accent}`,
                borderRadius: 4, padding: '1px 5px', fontSize: 9, color: accent,
                maxWidth: 90, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {cat.name || cat}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
            {element.timePerRound || 60}s/round · {element.letterMode || 'random'} letters
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: '100%', position: 'relative' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.15em', color: accent, textTransform: 'uppercase', fontWeight: 'bold' }}>Scattergories</div>

      {/* Letter + Timer row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <LetterSpinner letter={letter} spinning={spinning} accent={accent} />
        {(gamePhase === 'playing' || gamePhase === 'scoring') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: 100 }}>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: accent, borderRadius: 3, transition: 'width 0.95s linear', opacity: timeLeft < 10 ? 0.6 : 1 }} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: timeLeft < 10 ? '#ef4444' : 'white', fontFamily: 'sans-serif', textAlign: 'center' }}>
              {timeLeft}s
            </div>
          </div>
        )}
      </div>

      {/* Category grid */}
      {(gamePhase === 'playing' || gamePhase === 'scoring') && (
        <CategoryGrid categories={categories} answers={answers} letter={letter} accent={accent} />
      )}

      {/* Controls */}
      {gamePhase === 'setup' && (
        <button onClick={handleSpin} style={{ background: accent, color: 'white', border: 'none', borderRadius: 8, padding: '8px 24px', fontSize: 13, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
          SPIN LETTER
        </button>
      )}

      {gamePhase === 'playing' && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={handleEndRound} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '6px 14px', fontSize: 11, cursor: 'pointer', fontFamily: 'sans-serif' }}>
            Score Now
          </button>
          <button onClick={handleNewRound} style={{ background: accent, color: 'white', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 11, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
            New Round
          </button>
        </div>
      )}

      {gamePhase === 'scoring' && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowScoring(false)} style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '6px 14px', fontSize: 11, cursor: 'pointer', fontFamily: 'sans-serif' }}>
            Hide Score
          </button>
          <button onClick={handleNewRound} style={{ background: accent, color: 'white', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 11, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
            New Round
          </button>
        </div>
      )}

      {/* Scoring overlay */}
      <UniqueScoringOverlay answers={answers} letter={letter} teams={teams} visible={showScoring} />

      {gamePhase === 'ended' && winner && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 48, lineHeight: 1 }}>🏆</div>
          <div style={{ fontSize: 16, fontWeight: 'bold', color: '#ffd700' }}>{winner} Wins!</div>
        </div>
      )}
    </div>
  )
}

export function ScattergoriesRenderer({ element }) {
  if (element.isPresenting) {
    return <ScatterLive element={element} />
  }
  const accent = element.accentColor || '#ec4899'
  const categories = element.categories || []
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: '100%' }}>
      <div style={{ fontSize: 48, lineHeight: 1 }}>📝</div>
      <div style={{ fontSize: 14, fontWeight: 'bold', color: accent }}>Scattergories</div>
      {categories.length > 0 ? (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 240, padding: '0 8px' }}>
          {categories.slice(0, 6).map((cat, i) => (
            <div key={i} style={{
              background: 'rgba(236,72,153,0.15)', border: `1px solid ${accent}`,
              borderRadius: 4, padding: '1px 5px', fontSize: 9, color: accent,
              maxWidth: 90, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {cat.name || cat}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
          {element.timePerRound || 60}s/round · {element.letterMode || 'random'} letters
        </div>
      )}
    </div>
  )
}

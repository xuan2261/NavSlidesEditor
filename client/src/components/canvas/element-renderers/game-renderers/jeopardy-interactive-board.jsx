import React from 'react'
import { buildQuestionLookup, getDailyDoubleKeys } from './jeopardy-shared.js'
import { JeopardyBoard } from './jeopardy-board.jsx'
import { JeopardyQuestionModal } from './jeopardy-question-modal.jsx'
import { DailyDoubleWagerModal } from './jeopardy-wager-modal.jsx'
import { TeamScorePanel } from './jeopardy-score-panel.jsx'
import { PresenterControls } from './jeopardy-presenter-controls.jsx'
// Interactive Jeopardy Board — full game UI (presentation mode only, uses hooks)
export function InteractiveJeopardyBoard({ element }) {
  // Lazy-load useGameSocket only when needed (renderToString safe: hooks never execute)
  const [gameSocketFn, setGameSocketFn] = React.useState(
    () => (_id, _name, _role) => ({})
  )
  React.useEffect(() => {
    import('../../../../hooks/use-game-socket.js').then(m => {
      setGameSocketFn(() => m.useGameSocket)
    })
  }, [])

  const gameId = element.id || 'jeopardy'
  const socketResult = gameSocketFn(gameId, 'presenter', 'presenter')
  const { lastEvent } = socketResult

  // Local game state
  const [scores, setScores] = React.useState(() => {
    const init = {}
    ;(element.teams || []).forEach(t => { init[t.id || t.name] = t.score || 0 })
    return init
  })
  const [usedCells, setUsedCells] = React.useState({})
  const [selectedCell, setSelectedCell] = React.useState(null) // { catIdx, pts, question }
  const [showAnswer, setShowAnswer] = React.useState(false)
  const [activeTeam, setActiveTeam] = React.useState(null) // team id
  const [isDailyDouble, setIsDailyDouble] = React.useState(false)
  const [wager, setWager] = React.useState(0)
  const [showWagerModal, setShowWagerModal] = React.useState(false)
  const [_wagerTeamId, _setWagerTeamId] = React.useState(null)
  const [_timerSecs, _setTimerSecs] = React.useState(element.timerDuration || 30)
  const [timeLeft, setTimeLeft] = React.useState(null)
  const [timerInterval, setTimerInterval] = React.useState(null)
  const [gameEnded, setGameEnded] = React.useState(false)
  const [flipKey, setFlipKey] = React.useState(0)

  const qLookup = React.useMemo(() => buildQuestionLookup(element), [element])
  const ddKeys = React.useMemo(() => getDailyDoubleKeys(element), [element])

  // Sync socket events
  React.useEffect(() => {
    if (!lastEvent) return
    if (lastEvent.type === 'answer-result') {
      const { teamId, correct, points: pts } = lastEvent
      if (teamId && pts != null) {
        setScores(prev => ({
          ...prev,
          [teamId]: correct ? (prev[teamId] || 0) + pts : Math.max(0, (prev[teamId] || 0) - pts),
        }))
      }
      // Advance team after answer
      const teams = element.teams || []
      if (teams.length > 1) {
        const curIdx = activeTeam ? teams.findIndex(t => t.id === activeTeam) : -1
        const nextIdx = (curIdx + 1) % teams.length
        setActiveTeam(teams[nextIdx]?.id || null)
      }
    }
    if (lastEvent.type === 'question') {
      // { catIdx, pts, question }
      const { catIdx, pts, isDailyDouble: dd } = lastEvent
      if (catIdx != null && pts != null) {
        const key = `${catIdx}-${pts}`
        setSelectedCell({ catIdx, pts, question: qLookup[key] })
        setIsDailyDouble(dd || ddKeys.has(key))
        if (dd || ddKeys.has(key)) setShowWagerModal(true)
        setFlipKey(k => k + 1)
      }
    }
    if (lastEvent.type === 'leaderboard') {
      // { scores: { teamId: value } }
      if (lastEvent.scores) setScores(prev => ({ ...prev, ...lastEvent.scores }))
    }
    if (lastEvent.type === 'game-ended') setGameEnded(true)
  }, [lastEvent, activeTeam, ddKeys, qLookup, element.teams])

  // Timer
  React.useEffect(() => {
    if (timeLeft == null || timeLeft <= 0) return
    const id = setInterval(() => {
      setTimeLeft(prev => {
        if (prev == null || prev <= 1) {
          clearInterval(id)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    setTimerInterval(id)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft != null])

  const startTimer = React.useCallback((seconds) => {
    if (timerInterval) clearInterval(timerInterval)
    setTimeLeft(seconds)
  }, [timerInterval])

  const stopTimer = React.useCallback(() => {
    if (timerInterval) { clearInterval(timerInterval); setTimerInterval(null) }
    setTimeLeft(null)
  }, [timerInterval])

  const handleCellClick = React.useCallback((catIdx, pts) => {
    const key = `${catIdx}-${pts}`
    if (usedCells[key]) return
    const question = qLookup[key]
    const isDD = ddKeys.has(key)

    setSelectedCell({ catIdx, pts, question })
    setFlipKey(k => k + 1)
    setShowAnswer(false)
    stopTimer()

    if (isDD) {
      setIsDailyDouble(true)
      setShowWagerModal(true)
    } else {
      setIsDailyDouble(false)
      setShowWagerModal(false)
      if (element.showTimer !== false) startTimer(element.timerDuration || 30)
    }
  }, [usedCells, qLookup, ddKeys, element.timerDuration, element.showTimer, stopTimer, startTimer])

  const handleWagerSubmit = React.useCallback((teamId, wagerAmount) => {
    _setWagerTeamId(teamId)
    setWager(wagerAmount)
    setShowWagerModal(false)
    setActiveTeam(teamId)
  }, [])

  const handleCloseQuestion = React.useCallback(() => {
    if (selectedCell) {
      const key = `${selectedCell.catIdx}-${selectedCell.pts}`
      setUsedCells(prev => ({ ...prev, [key]: true }))
    }
    stopTimer()
    setSelectedCell(null)
    setShowAnswer(false)
    setIsDailyDouble(false)
    setWager(0)
    _setWagerTeamId(null)
    // Check game end
    const allUsed = Object.keys(qLookup).every(k => usedCells[k] || k === `${selectedCell?.catIdx}-${selectedCell?.pts}`)
    if (allUsed) setGameEnded(true)
  }, [selectedCell, qLookup, usedCells, stopTimer])

  const handleAnswer = React.useCallback((correct) => {
    stopTimer()
    setShowAnswer(false)
    if (!activeTeam) { handleCloseQuestion(); return }
    const pts = isDailyDouble ? wager : (selectedCell?.pts || 0)
    const earned = correct ? pts : (element.negativePoints ? -pts : 0)
    setScores(prev => ({
      ...prev,
      [activeTeam]: Math.max(0, (prev[activeTeam] || 0) + earned),
    }))
    // Auto-close after short delay
    setTimeout(() => handleCloseQuestion(), 800)
  }, [activeTeam, isDailyDouble, wager, selectedCell, element.negativePoints, stopTimer, handleCloseQuestion])

  const handleRevealAnswer = React.useCallback(() => {
    setShowAnswer(true)
    stopTimer()
  }, [stopTimer])

  const handleReturnToBoard = React.useCallback(() => {
    handleCloseQuestion()
  }, [handleCloseQuestion])

  // Daily Double Wager Modal
  if (showWagerModal) {
    const teams = element.teams || []
    return (
      <DailyDoubleWagerModal
        teams={teams}
        scores={scores}
        maxWager={element.maxWager || 1000}
        onSubmit={handleWagerSubmit}
        onCancel={() => { setShowWagerModal(false); setSelectedCell(null) }}
      />
    )
  }

  // Question Modal
  if (selectedCell) {
    return (
      <JeopardyQuestionModal
        key={`q-${flipKey}`}
        question={selectedCell.question}
        pts={isDailyDouble ? wager : selectedCell.pts}
        isDailyDouble={isDailyDouble}
        showAnswer={showAnswer}
        timeLeft={timeLeft}
        onReveal={handleRevealAnswer}
        onCorrect={() => handleAnswer(true)}
        onWrong={() => handleAnswer(false)}
        onClose={handleReturnToBoard}
        accentColor={element.accentColor || '#f59e0b'}
      />
    )
  }

  // Game ended screen
  if (gameEnded) {
    const teams = element.teams || []
    const sorted = [...teams].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0))
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, width: '100%', height: '100%' }}>
        <div style={{ fontSize: 40, lineHeight: 1 }}>🏆</div>
        <div style={{ fontSize: 18, fontWeight: 'bold', color: element.accentColor || '#f59e0b' }}>Game Over!</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          {sorted.map((team, i) => (
            <div key={team.id || i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: i === 0 ? `${team.color}30` : 'rgba(255,255,255,0.05)',
              border: `1px solid ${i === 0 ? team.color : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 8, padding: '8px 16px',
            }}>
              <span style={{ fontSize: i === 0 ? 20 : 14 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</span>
              <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: team.color }} />
              <span style={{ fontWeight: 'bold', color: 'white', fontSize: 14 }}>{team.name}</span>
              <span style={{ fontWeight: 'bold', color: team.color, fontSize: 16 }}>{scores[team.id] || 0}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Main board view
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden' }}>
      <JeopardyBoard
        element={element}
        usedCells={usedCells}
        ddKeys={ddKeys}
        onCellClick={handleCellClick}
      />
      <TeamScorePanel
        teams={element.teams || []}
        scores={scores}
        activeTeam={activeTeam}
        onSelectTeam={setActiveTeam}
      />
      <PresenterControls
        teams={element.teams || []}
        activeTeam={activeTeam}
        onSelectTeam={setActiveTeam}
        onReveal={null}
        onReturn={null}
        accentColor={element.accentColor || '#f59e0b'}
        showFinalJeopardy={() => setGameEnded(true)}
      />
    </div>
  )
}

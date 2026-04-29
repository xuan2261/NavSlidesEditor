/**
 * GamePlayerJoinPage — player (HS) entry point and game participation UI.
 * Route: /player/:slideId/:elementId?name=...
 */
import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useGamePlayer } from '../hooks/use-game-player'

// ── Entry: Join Form ─────────────────────────────────────────────────────────────
function JoinForm({ onJoin }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setError('Please enter your name'); return }
    if (trimmed.length > 30) { setError('Name must be 30 characters or less'); return }
    onJoin(trimmed)
  }

  return (
    <div className="min-h-screen bg-editor-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-card rounded-xl border border-border p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="text-4xl mb-3">🎮</div>
            <h1 className="text-xl font-bold text-text-primary mb-1">Join the Game!</h1>
            <p className="text-sm text-text-muted">Enter your name to participate</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="player-name" className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">
                Your Name
              </label>
              <input
                id="player-name"
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError('') }}
                placeholder="e.g. Minh or Team Red"
                maxLength={30}
                autoFocus
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
              />
              {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
            </div>
            <button type="submit" className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm">
              Join Game
            </button>
          </form>
          <p className="text-[10px] text-text-muted text-center mt-4">
            Ask your teacher for the game link
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Waiting Room ─────────────────────────────────────────────────────────────────
function WaitingRoom({ playerCount, error }) {
  return (
    <div className="min-h-screen bg-editor-bg flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-pulse">⏳</div>
        <h2 className="text-xl font-bold text-text-primary mb-2">Waiting for teacher to start...</h2>
        <p className="text-text-muted mb-4">{playerCount} player{playerCount !== 1 ? 's' : ''} in game</p>
        {error && <p className="text-red-400 text-sm">⚠️ {error}</p>}
      </div>
    </div>
  )
}

// ── Question Display ──────────────────────────────────────────────────────────────
function QuestionCard({ question, timeLeft, selectedAnswer, onSelect, disabled }) {
  const urgent = timeLeft !== null && timeLeft <= 5
  return (
    <div className="w-full max-w-md mx-auto">
      {/* Timer */}
      <div className="text-center mb-4">
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-lg font-bold ${
          urgent ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-accent/20 text-accent'
        }`}>
          <span>⏱</span>
          <span>{timeLeft ?? question.timeLimit}s</span>
        </div>
      </div>

      {/* Question */}
      <div className="bg-card border border-border rounded-xl p-6 mb-4 shadow-lg">
        <h2 className="text-lg font-semibold text-text-primary mb-4 text-center">
          {question.question}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {question.options.map((opt, idx) => {
            const isSelected = selectedAnswer === idx
            const letter = String.fromCharCode(65 + idx)
            return (
              <button
                key={idx}
                onClick={() => !disabled && onSelect(idx)}
                disabled={disabled}
                className={`p-4 rounded-xl border-2 text-left font-medium transition-all ${
                  isSelected
                    ? 'border-accent bg-accent/10 text-accent scale-105'
                    : 'border-border hover:border-accent/50 hover:bg-surface-2 text-text-primary'
                } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span className="inline-block w-7 h-7 rounded-full bg-surface-2 text-xs font-bold mr-2 text-center leading-7">
                  {letter}
                </span>
                {opt}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Answered State ───────────────────────────────────────────────────────────────
function AnsweredState({ answerResult, question }) {
  return (
    <div className="min-h-screen bg-editor-bg flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-5xl mb-4">{answerResult?.correct ? '✅' : '❌'}</div>
        <h2 className="text-xl font-bold text-text-primary mb-2">
          {answerResult?.correct ? 'Correct!' : 'Wrong!'}
        </h2>
        {answerResult?.points > 0 && (
          <p className="text-2xl font-bold text-accent mb-2">+{answerResult.points} pts</p>
        )}
        <p className="text-text-muted">Waiting for next question...</p>
        {question?.options && answerResult?.correct === false && (
          <p className="text-sm text-text-muted mt-2">
            Correct answer: {String.fromCharCode(65 + question.correctIndex)} — {question.options[question.correctIndex]}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Final Results ───────────────────────────────────────────────────────────────
function FinalResults({ leaderboard, myScore, myRank, playerName }) {
  return (
    <div className="min-h-screen bg-editor-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🏆</div>
          <h2 className="text-2xl font-bold text-text-primary">Game Over!</h2>
        </div>

        {/* Personal stats */}
        {myRank !== null && (
          <div className="bg-accent/10 border border-accent/30 rounded-xl p-4 mb-4 text-center">
            <p className="text-text-muted text-sm">Your Rank</p>
            <p className="text-3xl font-bold text-accent">#{myRank}</p>
            <p className="text-text-muted text-sm mt-1">{myScore} pts</p>
          </div>
        )}

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-surface-1">
              <h3 className="font-semibold text-text-primary text-sm">Final Scores</h3>
            </div>
            <div className="divide-y divide-border">
              {leaderboard.slice(0, 10).map((entry, i) => {
                const isMe = entry.name === playerName
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
                return (
                  <div key={i} className={`px-4 py-3 flex items-center justify-between ${isMe ? 'bg-accent/5' : ''}`}>
                    <span className="text-lg">{medal}</span>
                    <span className={`flex-1 font-medium ${isMe ? 'text-accent' : 'text-text-primary'} text-sm ml-2`}>
                      {entry.name}{isMe ? ' (You)' : ''}
                    </span>
                    <span className="text-text-muted text-sm font-mono">{entry.score}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────────
export default function GamePlayerPage() {
  const { slideId, elementId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [playerName, setPlayerName] = useState('')

  const urlName = searchParams.get('name')
  const resolvedName = playerName || urlName

  const gameId = `${slideId}-${elementId}`

  const {
    status,
    players,
    playerCount,
    currentQuestion,
    timeLeft,
    selectedAnswer,
    answerResult,
    submitAnswer,
    myScore,
    myRank,
    leaderboard,
    isConnected,
    error,
  } = useGamePlayer({ gameId, playerName: resolvedName || undefined })

  // If name in URL, it's already joined — go straight to game
  if (urlName && status === 'joining') {
    return <WaitingRoom playerCount={0} error={null} />
  }

  // Join form
  if (!resolvedName) {
    return <JoinForm onJoin={(name) => setPlayerName(name)} />
  }

  // Router: update URL to persist name
  useEffect(() => {
    if (playerName && !urlName) {
      navigate(`/player/${slideId}/${elementId}?name=${encodeURIComponent(playerName)}`, { replace: true })
    }
  }, [playerName, urlName, slideId, elementId, navigate])

  // Status-based rendering
  if (status === 'waiting' || status === 'joining') {
    return <WaitingRoom playerCount={playerCount} error={error} />
  }

  if (status === 'question' && currentQuestion) {
    return (
      <div className="min-h-screen bg-editor-bg flex flex-col justify-center p-4">
        {/* Player info bar */}
        <div className="flex items-center justify-between mb-4 text-sm text-text-muted">
          <span>👤 {resolvedName}</span>
          <span>🏆 {myScore} pts</span>
        </div>
        <QuestionCard
          question={currentQuestion}
          timeLeft={timeLeft}
          selectedAnswer={selectedAnswer}
          onSelect={submitAnswer}
          disabled={status !== 'question'}
        />
      </div>
    )
  }

  if (status === 'answered' || status === 'result') {
    return <AnsweredState answerResult={answerResult} question={currentQuestion} />
  }

  if (status === 'finished') {
    return (
      <FinalResults
        leaderboard={leaderboard}
        myScore={myScore}
        myRank={myRank}
        playerName={resolvedName}
      />
    )
  }

  return <WaitingRoom playerCount={playerCount} error={error} />
}

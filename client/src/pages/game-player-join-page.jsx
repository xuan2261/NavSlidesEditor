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

function PollCard({ pollState, selectedOption, onVote }) {
  const totalVotes = pollState?.totalVotes || 0
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-text-primary mb-4 text-center">
          {pollState?.prompt || 'Live Poll'}
        </h2>
        <div className="space-y-3">
          {(pollState?.options || []).map((option) => {
            const selected = selectedOption === option.id
            const pct = totalVotes > 0 ? Math.round(((option.votes || 0) / totalVotes) * 100) : 0
            return (
              <button
                key={option.id}
                onClick={() => onVote(option.id)}
                className={`relative w-full overflow-hidden p-4 rounded-xl border-2 text-left font-medium transition-all ${
                  selected
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border hover:border-accent/50 hover:bg-surface-2 text-text-primary'
                }`}
              >
                <span className="relative flex justify-between gap-3">
                  <span>{option.text}</span>
                  <span className="text-text-muted">{option.votes || 0} · {pct}%</span>
                </span>
              </button>
            )
          })}
        </div>
        {selectedOption && <p className="text-xs text-text-muted text-center mt-4">Vote saved. Tap another option to change it.</p>}
      </div>
    </div>
  )
}

function WordCloudCard({ wordCloudState, submissionCount, onSubmit }) {
  const [text, setText] = useState('')
  const maxLength = 40
  const maxSubmissions = 5
  const canSubmit = text.trim() && submissionCount < maxSubmissions

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!canSubmit) return
    onSubmit(text)
    setText('')
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-text-primary mb-4 text-center">
          {wordCloudState?.prompt || 'Word Cloud'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            value={text}
            maxLength={maxLength}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a word or short phrase"
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-accent hover:bg-accent-hover disabled:bg-border disabled:text-text-muted text-white font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm"
          >
            Submit
          </button>
        </form>
        <p className="text-xs text-text-muted text-center mt-3">
          {submissionCount}/{maxSubmissions} submissions used · {text.length}/{maxLength} chars
        </p>
        {(wordCloudState?.entries || []).length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {wordCloudState.entries.slice(0, 20).map((entry) => (
              <span
                key={entry.text}
                className="rounded-full bg-accent/10 px-3 py-1 text-sm font-semibold text-accent"
              >
                {entry.text} ×{entry.count}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function resolveRevealedPairs(matchingState) {
  const promptsById = new Map((matchingState?.prompts || []).map((prompt) => [prompt.id, prompt.text]))
  const targetsById = new Map((matchingState?.targets || []).map((target) => [target.id, target.text]))
  return (matchingState?.answerKey || []).map((pair) => ({
    prompt: promptsById.get(pair.promptId) || pair.promptId,
    target: targetsById.get(pair.targetId) || pair.targetId,
  }))
}

export function MatchingCard({ matchingState, matchingResult, onSubmit }) {
  const prompts = matchingState?.prompts || []
  const targets = matchingState?.targets || []
  const [selectedPromptId, setSelectedPromptId] = useState(null)
  const [mapping, setMapping] = useState({})
  const mappedCount = Object.keys(mapping).length
  const canSubmit = prompts.length > 0 && mappedCount === prompts.length

  const handleTarget = (targetId) => {
    if (!selectedPromptId) return
    setMapping((current) => ({ ...current, [selectedPromptId]: targetId }))
    setSelectedPromptId(null)
  }

  const isTargetUsed = (targetId) =>
    Object.entries(mapping).some(([promptId, mappedTargetId]) => (
      promptId !== selectedPromptId && mappedTargetId === targetId
    ))

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-text-primary mb-2 text-center">
          {matchingState?.prompt || 'Matching'}
        </h2>
        <p className="text-xs text-text-muted text-center mb-4">
          Select a prompt, then select its matching target.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2" aria-label="Prompts">
            {prompts.map((prompt) => (
              <button
                key={prompt.id}
                onClick={() => setSelectedPromptId(prompt.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  selectedPromptId === prompt.id
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border bg-surface-2 text-text-primary'
                }`}
              >
                {prompt.text}
                {mapping[prompt.id] && (
                  <span className="block text-[10px] text-text-muted">Matched</span>
                )}
              </button>
            ))}
          </div>
          <div className="space-y-2" aria-label="Targets">
            {targets.map((target) => (
              <button
                key={target.id}
                onClick={() => handleTarget(target.id)}
                disabled={!selectedPromptId || isTargetUsed(target.id)}
                className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-left text-sm text-text-primary transition-colors hover:border-accent/60 disabled:opacity-60"
              >
                {target.text}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => onSubmit(prompts.map((prompt) => ({ promptId: prompt.id, targetId: mapping[prompt.id] })))}
          disabled={!canSubmit}
          className="mt-4 w-full bg-accent hover:bg-accent-hover disabled:bg-border disabled:text-text-muted text-white font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm"
        >
          Submit matches
        </button>
        {matchingResult && (
          <p className="text-sm text-text-muted text-center mt-3">
            Score: {matchingResult.score}/{matchingResult.total}
          </p>
        )}
        {matchingState?.answerKey && (
          <div className="mt-4 rounded-lg border border-border bg-surface-2 p-3">
            <div className="text-xs font-semibold text-text-primary mb-2">Revealed answers</div>
            <ul className="space-y-1 text-xs text-text-muted">
              {resolveRevealedPairs(matchingState).map((pair, index) => (
                <li key={`${pair.prompt}-${index}`}>
                  {pair.prompt} → {pair.target}
                </li>
              ))}
            </ul>
          </div>
        )}
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

  const gameId = elementId

  const {
    status,
    _players,
    playerCount,
    currentQuestion,
    pollState,
    wordCloudState,
    matchingState,
    timeLeft,
    selectedAnswer,
    selectedPollOption,
    wordCloudSubmissionCount,
    matchingResult,
    answerResult,
    submitAnswer,
    submitPollVote,
    submitWordCloudText,
    submitMatchingPairs,
    myScore,
    myRank,
    leaderboard,
    _isConnected,
    error,
  } = useGamePlayer({ gameId, playerName: resolvedName || undefined })

  // Router: update URL to persist name — must be called before any conditional returns
  useEffect(() => {
    if (playerName && !urlName) {
      navigate(`/player/${slideId}/${elementId}?name=${encodeURIComponent(playerName)}`, { replace: true })
    }
  }, [playerName, urlName, slideId, elementId, navigate])

  // If name in URL, it's already joined — go straight to game
  if (urlName && status === 'joining') {
    return <WaitingRoom playerCount={0} error={null} />
  }

  // Join form
  if (!resolvedName) {
    return <JoinForm onJoin={(name) => setPlayerName(name)} />
  }

  // Router: update URL to persist name
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

  if (status === 'poll' && pollState) {
    return (
      <div className="min-h-screen bg-editor-bg flex flex-col justify-center p-4">
        <div className="flex items-center justify-between mb-4 text-sm text-text-muted">
          <span>👤 {resolvedName}</span>
          <span>📊 Live poll</span>
        </div>
        <PollCard
          pollState={pollState}
          selectedOption={selectedPollOption}
          onVote={submitPollVote}
        />
      </div>
    )
  }

  if (status === 'word-cloud' && wordCloudState) {
    return (
      <div className="min-h-screen bg-editor-bg flex flex-col justify-center p-4">
        <div className="flex items-center justify-between mb-4 text-sm text-text-muted">
          <span>👤 {resolvedName}</span>
          <span>☁ Word cloud</span>
        </div>
        <WordCloudCard
          wordCloudState={wordCloudState}
          submissionCount={wordCloudSubmissionCount}
          onSubmit={submitWordCloudText}
        />
      </div>
    )
  }

  if (status === 'matching' && matchingState) {
    return (
      <div className="min-h-screen bg-editor-bg flex flex-col justify-center p-4">
        <div className="flex items-center justify-between mb-4 text-sm text-text-muted">
          <span>👤 {resolvedName}</span>
          <span>🔗 Matching</span>
        </div>
        <MatchingCard
          matchingState={matchingState}
          matchingResult={matchingResult}
          onSubmit={submitMatchingPairs}
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

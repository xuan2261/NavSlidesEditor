import { useState } from 'react'
import { LivePlayerAdapter } from './live-player-adapter.jsx'
export function GamePlayerJoinForm({ onJoin, initialError = '' }) {
  const [name, setName] = useState(''),
    [error, setError] = useState(initialError)
  function submit(event) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Please enter your name')
      return
    }
    if (trimmed.length > 30) {
      setError('Name must be 30 characters or less')
      return
    }
    onJoin(trimmed)
  }
  return (
    <main className="min-h-screen bg-workspace flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-md flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Join the live game</h1>
        <label className="flex flex-col gap-2">
          Your name
          <input
            autoFocus
            autoComplete="nickname"
            placeholder="e.g. Minh or Team Red"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'game-join-error' : undefined}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="min-h-11 rounded-lg border border-border bg-surface p-3"
          />
        </label>
        {error && (
          <p id="game-join-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="min-h-11 rounded-lg bg-primary text-white p-3">
          Join game
        </button>
      </form>
    </main>
  )
}
export function GamePlayerShell({ playerName, game }) {
  const score = game.snapshot?.quiz?.showScore !== false
  return (
    <main className="min-h-screen bg-workspace flex flex-col items-center justify-center p-4">
      <header className="w-full max-w-xl flex justify-between gap-4 mb-4">
        <span>{playerName}</span>
        {score && (
          <span>
            {game.myScore} pts{game.myRank ? ` · Rank ${game.myRank}` : ''}
          </span>
        )}
      </header>
      {game.connection ? (
        <LivePlayerAdapter connection={game.connection} />
      ) : (
        <section aria-live="polite">
          <h1>Waiting for the host to start…</h1>
          {game.error && <p role="alert">{game.error}</p>}
        </section>
      )}
    </main>
  )
}

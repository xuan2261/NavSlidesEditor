import { useEffect, useMemo, useState } from 'react'
import { useGameSocket } from './use-game-socket.js'

function normalizeScores(scores) {
  if (Array.isArray(scores)) return scores
  if (!scores || typeof scores !== 'object') return []
  return Object.entries(scores).map(([team, score]) => ({ team, score }))
}

export function useEditorGameLeaderboard(gameElement) {
  const gameId = typeof gameElement === 'string' ? gameElement : gameElement?.id
  const gameOptions = useMemo(
    () => gameId ? { retryOnRoomNotFound: true, maxRoomNotFoundRetries: 5 } : null,
    [gameId]
  )
  const [scoreState, setScoreState] = useState({ gameId: null, scores: [] })
  useGameSocket(
    gameId || null,
    gameId ? 'editor-observer' : null,
    'observer',
    gameOptions
  )

  useEffect(() => {
    if (!gameId || typeof window === 'undefined') return undefined

    const handleLeaderboard = (event) => {
      if (event.detail?.gameId !== gameId) return
      setScoreState({ gameId, scores: normalizeScores(event.detail?.scores) })
    }
    window.addEventListener('navslides:game-leaderboard', handleLeaderboard)
    return () => window.removeEventListener('navslides:game-leaderboard', handleLeaderboard)
  }, [gameId])

  return scoreState.gameId === gameId ? scoreState.scores : []
}

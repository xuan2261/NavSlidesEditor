import { useCallback, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { createGameConnection, createLivePlayerState } from 'revealjs-shared'
export function useGameSocket(gameId, playerName, role = 'player', gameOptions = null) {
  const [snapshot, setSnapshot] = useState(() => createLivePlayerState(gameId))
  const connectionRef = useRef(null)
  const optionsKey = JSON.stringify(gameOptions || {})
  useEffect(() => {
    if (!gameId || !playerName) return
    const socket = io('/games', { path: '/ws', reconnection: true })
    let storage, session
    try {
      storage = window.localStorage
    } catch {
      /* Join remains usable when persistence is denied. */
    }
    try {
      session = window.sessionStorage
    } catch {
      /* Host credentials remain in connection memory. */
    }
    const connection = createGameConnection({
      socket,
      owned: true,
      gameId,
      playerName,
      role,
      options: JSON.parse(optionsKey),
      storage,
      sessionStorage: session,
    })
    connectionRef.current = connection
    let previousScores
    const update = (state) => {
      setSnapshot(state)
      if (state.leaderboard !== previousScores && state.hydrated) {
        previousScores = state.leaderboard
        window.dispatchEvent(
          new CustomEvent('navslides:game-leaderboard', {
            detail: { gameId, scores: state.leaderboard },
          })
        )
      }
    }
    const unsubscribe = connection.subscribe(update)
    update(connection.getSnapshot())
    return () => {
      unsubscribe()
      connection.release()
      if (connectionRef.current === connection) connectionRef.current = null
    }
  }, [gameId, playerName, role, optionsKey])
  const emit = useCallback((event, data) => connectionRef.current?.emit(event, data) ?? false, [])
  const gameState = snapshot.poll
    ? {
        ...snapshot.poll,
        type: 'poll',
        options: snapshot.poll.options.map((option) => ({
          ...option,
          votes: snapshot.poll.votes?.find((vote) => vote.optionId === option.id)?.count || 0,
        })),
      }
    : snapshot.wordCloud
      ? { ...snapshot.wordCloud, type: 'word-cloud' }
      : snapshot.matching
        ? { ...snapshot.matching, type: 'matching' }
        : snapshot.question
          ? { ...snapshot, question: snapshot.question }
          : null
  return {
    socket: connectionRef.current?.socket || null,
    connection: connectionRef.current,
    snapshot,
    isConnected: snapshot.connected,
    joinError: snapshot.error,
    gameState,
    leaderboard: snapshot.leaderboard,
    players: snapshot.players,
    lastEvent:
      snapshot.lastEvent || (snapshot.hydrated ? { ...snapshot, type: 'round-state' } : null),
    emit,
  }
}

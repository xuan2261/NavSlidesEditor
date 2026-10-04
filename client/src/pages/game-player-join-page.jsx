import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useGamePlayer } from '../hooks/use-game-player.js'
import { GamePlayerJoinForm, GamePlayerShell } from '../components/education/game-player-shell.jsx'
export default function GamePlayerPage() {
  const { slideId, elementId } = useParams(),
    [searchParams] = useSearchParams(),
    navigate = useNavigate()
  const [playerName, setPlayerName] = useState('')
  const gameId = elementId || searchParams.get('gameId') || ''
  const urlName = searchParams.get('name')?.trim() || ''
  const validUrlName = urlName.length <= 30 ? urlName : ''
  const resolvedName = playerName || validUrlName
  const game = useGamePlayer({
    gameId: gameId && gameId.length <= 128 ? gameId : null,
    playerName: resolvedName || undefined,
  })
  useEffect(() => {
    if (!playerName || playerName === urlName) return
    const params = new URLSearchParams(searchParams)
    params.set('name', playerName)
    const path = elementId
      ? `/player/${encodeURIComponent(slideId)}/${encodeURIComponent(elementId)}`
      : '/game/join'
    navigate(`${path}?${params}`, { replace: true })
  }, [playerName, urlName, slideId, elementId, searchParams, navigate])
  if (!gameId || gameId.length > 128)
    return (
      <main className="p-4">
        <p role="alert">Invalid game join link. Ask the host for a new link.</p>
      </main>
    )
  if (!resolvedName)
    return (
      <GamePlayerJoinForm
        onJoin={setPlayerName}
        initialError={urlName.length > 30 ? 'Name must be 30 characters or less' : ''}
      />
    )
  return <GamePlayerShell playerName={resolvedName} game={game} />
}

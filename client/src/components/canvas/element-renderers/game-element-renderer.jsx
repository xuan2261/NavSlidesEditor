/**
 * Game Element Renderer — Phase 3 full implementation + Phase 10 interactive games.
 *
 * Factory that dispatches to per-game-type sub-renderers in ./game-renderers/.
 * Compatible with renderToString (hooks only in lazy-loaded interactive sub-modules).
 *
 * Supports all game types from GAME_TYPES.
 *
 * Renders in two modes:
 *  - Edit mode  (isPresenting !== true): preview card with setup label
 *  - Present mode (isPresenting === true): live game UI with controls
 */
import React from 'react'
import { resolveGameConfig } from '../../../constants/game-element-types-constants.js'
import { GAME_TYPE_LABELS } from './game-renderers/shared.jsx'
import { NamePickerRenderer, NamePickerInteractiveWrapper } from './game-renderers/name-picker.jsx'
import { HotPotatoRenderer } from './game-renderers/hot-potato.jsx'
import { JeopardyRenderer } from './game-renderers/jeopardy-renderer.jsx'
import { FourCornersRenderer } from './game-renderers/four-corners.jsx'
import { RelayRaceRenderer } from './game-renderers/relay-race.jsx'
import { TriviaChampRenderer } from './game-renderers/trivia-champ.jsx'
import { ScattergoriesRenderer } from './game-renderers/scattergories.jsx'
import { PollRenderer } from './game-renderers/poll.jsx'
import { WordCloudRenderer } from './game-renderers/word-cloud.jsx'
import { MatchingRenderer } from './game-renderers/matching.jsx'
import { FallbackRenderer } from './game-renderers/fallback.jsx'
import { GameControls } from './game-renderers/game-controls.jsx'

export function GameElementRenderer(props) {
  // Support flat props or nested element={...} pattern. Legacy decks may keep
  // subtype fields flat; render one resolved view while preserving the source shape.
  const sourceElement = props.element ?? props
  const gameType = sourceElement.gameType || 'name-picker'
  const gameConfig = resolveGameConfig(sourceElement, gameType)
  const el = { ...sourceElement, ...gameConfig, [gameType]: gameConfig }
  const isPresenting = props.isPresenting === true
  const isRunning = el.gameStatus === 'running'
  const isEnded = el.gameStatus === 'ended'

  const bgColor = el.backgroundColor || '#1a1a2e'
  const accent = el.accentColor || '#6366f1'

  const renderGameContent = () => {
    switch (el.gameType) {
      case 'name-picker':
        if (isPresenting) {
          return <NamePickerInteractiveWrapper element={el} isPresenting={isPresenting} />
        }
        return <NamePickerRenderer element={el} isPresenting={isPresenting} />
      case 'hot-potato':
        return <HotPotatoRenderer element={el} isPresenting={isPresenting} />
      case 'jeopardy':
        return <JeopardyRenderer element={el} isPresenting={isPresenting} />
      case 'four-corners':
        return <FourCornersRenderer element={el} isPresenting={isPresenting} />
      case 'relay-race':
        return <RelayRaceRenderer element={el} isPresenting={isPresenting} />
      case 'trivia-champ':
        return <TriviaChampRenderer element={el} isPresenting={isPresenting} />
      case 'scattergories':
        return <ScattergoriesRenderer element={el} isPresenting={isPresenting} />
      case 'poll':
        return <PollRenderer element={el} isPresenting={isPresenting} />
      case 'word-cloud':
        return <WordCloudRenderer element={el} isPresenting={isPresenting} />
      case 'matching':
        return <MatchingRenderer element={el} isPresenting={isPresenting} />
      default:
        return <FallbackRenderer element={el} />
    }
  }

  const gameLabel = GAME_TYPE_LABELS[el.gameType] || el.gameType || 'Game'

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: bgColor,
        borderRadius: 8,
        color: '#ffffff',
        fontFamily: 'sans-serif',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
        boxSizing: 'border-box',
      }}
    >
      {/* Top label */}
      <div style={{
        position: 'absolute',
        top: 10,
        left: 0,
        right: 0,
        textAlign: 'center',
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: accent,
        pointerEvents: 'none',
      }}>
        Game: {gameLabel}
      </div>

      {/* Game content */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        padding: '28px 16px 32px',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        {renderGameContent()}
      </div>

      {/* Setup placeholder — only shown in edit mode when status is setup */}
      {!isPresenting && el.gameStatus === 'setup' && (
        <div style={{
          position: 'absolute',
          bottom: 10,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: 10,
          color: 'rgba(255,255,255,0.4)',
          fontStyle: 'italic',
          pointerEvents: 'none',
        }}>
          Configure in properties panel
        </div>
      )}

      {/* Controls — only in presentation mode (name-picker has its own controls) */}
      {isPresenting && (isRunning || !isEnded) && !['name-picker', 'poll', 'word-cloud'].includes(el.gameType) && (
        <GameControls element={el} />
      )}
    </div>
  )
}

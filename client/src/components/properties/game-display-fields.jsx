import React from 'react'
import { NumberField, TextField, ToggleField } from './game-authoring-fields'

export default function GameDisplayFields({
  element,
  config,
  gameType,
  onChange,
  onUpdateElement,
}) {
  return (
    <div className="space-y-2.5">
      <TextField
        label="Game title"
        value={config.title}
        onChange={(title) => onChange({ title })}
      />
      <TextField
        label="Game background color"
        type="color"
        value={element.backgroundColor || '#1a1a2e'}
        onChange={(backgroundColor) => onUpdateElement({ backgroundColor })}
      />
      <TextField
        label="Game accent color"
        type="color"
        value={element.accentColor || '#6366f1'}
        onChange={(accentColor) => onUpdateElement({ accentColor })}
      />
      <TextField
        label="Game font family"
        value={element.fontFamily || 'sans-serif'}
        onChange={(fontFamily) => onUpdateElement({ fontFamily })}
      />
      <ToggleField
        label="Sound effects"
        value={element.showSoundEffects !== false}
        onChange={(showSoundEffects) => onUpdateElement({ showSoundEffects })}
      />
      {gameType === 'name-picker' && (
        <ToggleField
          label="Confetti animation"
          value={config.showConfetti}
          onChange={(showConfetti) => onChange({ showConfetti })}
        />
      )}
      {['jeopardy', 'four-corners'].includes(gameType) && (
        <ToggleField
          label="Show timer"
          value={config.showTimer}
          onChange={(showTimer) => onChange({ showTimer })}
        />
      )}
      {Object.hasOwn(config, 'timerDuration') && (
        <NumberField
          label="Timer duration in seconds"
          value={config.timerDuration}
          min={1}
          max={86400}
          integer
          onChange={(timerDuration) => onChange({ timerDuration })}
        />
      )}
      {gameType === 'scattergories' && (
        <NumberField
          label="Time per round in seconds"
          value={config.timePerRound}
          min={1}
          max={86400}
          integer
          onChange={(timePerRound) => onChange({ timePerRound })}
        />
      )}
    </div>
  )
}

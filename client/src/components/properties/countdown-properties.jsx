import React from 'react'
import { validateGameConfig } from 'revealjs-shared'
import { NumberField, TextField, ToggleField, ValidationErrors } from './game-authoring-fields'

export default function CountdownProperties({ config, onChange }) {
  return (
    <div className="space-y-2.5">
      <TextField
        label="Countdown title"
        value={config.title}
        onChange={(title) => onChange({ title })}
      />
      <NumberField
        label="Duration in seconds"
        value={config.durationSeconds}
        min={1}
        max={86400}
        integer
        onChange={(durationSeconds) => onChange({ durationSeconds })}
      />
      <ToggleField
        label="Start automatically"
        value={config.autoStart}
        onChange={(autoStart) => onChange({ autoStart })}
      />
      <TextField
        label="Expiry message"
        value={config.expiryMessage}
        onChange={(expiryMessage) => onChange({ expiryMessage })}
      />
      <p className="text-xs text-text-muted">
        This local timer can be paused, resumed, reset and adjusted during presentation. Leaving the
        slide pauses active time; a manually paused timer stays paused.
      </p>
      <ValidationErrors errors={validateGameConfig('countdown', config).errors} />
    </div>
  )
}

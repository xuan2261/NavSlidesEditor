import React from 'react'
import { newId, NumberField, OrderedList, ToggleField } from './game-authoring-fields'
import CardContentFields from './card-content-fields'

export default function MemoryProperties({ config, onChange }) {
  return (
    <div className="space-y-2">
      <ToggleField
        label="Shuffle on start"
        value={config.shuffleOnStart}
        onChange={(shuffleOnStart) => onChange({ shuffleOnStart })}
      />
      <NumberField
        label="Mismatch delay in milliseconds"
        value={config.mismatchDelayMs}
        min={0}
        max={5000}
        integer
        onChange={(mismatchDelayMs) => onChange({ mismatchDelayMs })}
      />
      <NumberField
        label="Match points"
        value={config.matchPoints}
        min={1}
        max={1000}
        integer
        onChange={(matchPoints) => onChange({ matchPoints })}
      />
      <p className="text-xs text-text-muted">
        Use 2–24 pairs. Image faces require descriptive alt text.
      </p>
      <OrderedList
        items={config.pairs}
        onChange={(pairs) => onChange({ pairs })}
        itemName="Pair"
        addLabel="Add pair"
        max={24}
        createItem={() => ({
          id: newId(),
          first: { type: 'text', text: 'Prompt' },
          second: { type: 'text', text: 'Answer' },
        })}
      >
        {(pair, index, patch) => (
          <>
            <CardContentFields
              label={`Pair ${index + 1} first`}
              value={pair.first}
              onChange={(first) => patch({ first })}
            />
            <CardContentFields
              label={`Pair ${index + 1} second`}
              value={pair.second}
              onChange={(second) => patch({ second })}
            />
          </>
        )}
      </OrderedList>
    </div>
  )
}

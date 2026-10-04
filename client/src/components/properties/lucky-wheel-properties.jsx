import React from 'react'
import { validateGameConfig } from 'revealjs-shared'
import {
  newId,
  NumberField,
  OrderedList,
  TextField,
  ToggleField,
  ValidationErrors,
} from './game-authoring-fields'

export default function LuckyWheelProperties({ config, onChange }) {
  const items = config.items || []
  return (
    <div className="space-y-2.5">
      <TextField
        label="Wheel title"
        value={config.title}
        onChange={(title) => onChange({ title })}
      />
      <OrderedList
        items={items}
        onChange={(items) => onChange({ items })}
        itemName="Prize"
        addLabel="Add prize"
        max={1000}
        createItem={() => ({ id: newId(), label: `Prize ${items.length + 1}`, weight: 1 })}
      >
        {(item, index, patch) => (
          <>
            <TextField
              label={`Prize ${index + 1} label`}
              value={item.label}
              onChange={(label) => patch({ label })}
            />
            <NumberField
              label={`Prize ${index + 1} weight`}
              min={Number.MIN_VALUE}
              max={Number.MAX_VALUE}
              value={item.weight ?? 1}
              onChange={(weight) => patch({ weight })}
            />
          </>
        )}
      </OrderedList>
      <ToggleField
        label="Weighted selection"
        value={config.weighted}
        onChange={(weighted) => onChange({ weighted })}
      />
      <ToggleField
        label="Remove prize after picking"
        value={config.removeAfterPick}
        onChange={(removeAfterPick) => onChange({ removeAfterPick })}
      />
      <NumberField
        label="Animation duration in milliseconds"
        value={config.animationDuration}
        min={0}
        max={60000}
        integer
        onChange={(animationDuration) => onChange({ animationDuration })}
      />
      <ToggleField
        label="Confetti animation"
        value={config.showConfetti}
        onChange={(showConfetti) => onChange({ showConfetti })}
      />
      <ValidationErrors errors={validateGameConfig('lucky-wheel', config).errors} />
    </div>
  )
}

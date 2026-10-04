import React from 'react'
import {
  newId,
  NumberField,
  OrderedList,
  SelectField,
  TextField,
  ToggleField,
} from './game-authoring-fields'

export default function PickerAuthoring({ config, onChange }) {
  const items = config.items || []
  const colors = config.wheelColors || []
  return (
    <div className="space-y-2.5">
      <SelectField
        label="Picker mode"
        value={config.pickerMode}
        options={['wheel', 'dice', 'button']}
        onChange={(pickerMode) => onChange({ pickerMode })}
      />
      <OrderedList
        items={items}
        onChange={(items) => onChange({ items })}
        itemName="Item"
        addLabel="Add item"
        max={1000}
        createItem={() => ({ id: newId(), label: `Item ${items.length + 1}`, weight: 1 })}
      >
        {(item, index, patch) => (
          <>
            <TextField
              label={`Item ${index + 1} label`}
              value={item.label}
              onChange={(label) => patch({ label })}
            />
            <NumberField
              label={`Item ${index + 1} weight`}
              min={Number.MIN_VALUE}
              value={item.weight}
              onChange={(weight) => patch({ weight })}
            />
          </>
        )}
      </OrderedList>
      {!items.length && (
        <p role="alert" className="text-xs text-red-400">
          Add at least one picker item before saving.
        </p>
      )}
      <ToggleField
        label="Weighted selection"
        value={config.weighted}
        onChange={(weighted) => onChange({ weighted })}
      />
      <ToggleField
        label="Exclude after pick"
        value={config.excludeAfterPick}
        onChange={(excludeAfterPick) => onChange({ excludeAfterPick })}
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
      <NumberField
        label="Dice count"
        value={config.diceCount}
        min={1}
        max={6}
        integer
        onChange={(diceCount) => onChange({ diceCount })}
      />
      <NumberField
        label="Wheel segments"
        value={config.wheelSegments}
        min={1}
        max={100}
        integer
        onChange={(wheelSegments) => onChange({ wheelSegments })}
      />
      <fieldset className="space-y-1 rounded border border-border p-2">
        <legend className="text-xs text-text-muted">Wheel colors</legend>
        {colors.map((color, index) => (
          <div key={index} className="space-y-1">
            <TextField
              label={`Wheel color ${index + 1}`}
              type="color"
              value={color}
              onChange={(next) =>
                onChange({
                  wheelColors: colors.map((current, at) => (at === index ? next : current)),
                })
              }
            />
            <div className="flex gap-1">
              <button
                type="button"
                aria-label={`Delete wheel color ${index + 1}`}
                className="text-xs text-accent"
                onClick={() => onChange({ wheelColors: colors.filter((_, at) => at !== index) })}
              >
                Delete color
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="text-xs text-accent"
          onClick={() => onChange({ wheelColors: [...colors, '#6366f1'] })}
        >
          Add wheel color
        </button>
        {!colors.length && (
          <p role="alert" className="text-xs text-red-400">
            Add at least one wheel color before saving.
          </p>
        )}
      </fieldset>
    </div>
  )
}

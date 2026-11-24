import React, { useEffect, useRef, useState } from 'react'
import { normalizeInteractionVariables } from 'revealjs-shared'
import { Action, TextField, newId } from './game-authoring-fields'

const numericFields = ['initialValue', 'min', 'max']
function validateDrafts(drafts) {
  const variables = drafts.map((item) => ({
    ...item,
    ...Object.fromEntries(
      numericFields.map((key) => [key, String(item[key] ?? '').trim() ? Number(item[key]) : NaN])
    ),
  }))
  return normalizeInteractionVariables(variables)
}

/** Invalid drafts remain editable locally; only a complete valid set is persisted. */
export default function InteractionVariableControls({ variables = [], onChange }) {
  const signature = JSON.stringify(variables)
  const published = useRef(signature)
  const [drafts, setDrafts] = useState(variables)
  useEffect(() => {
    if (signature !== published.current) {
      published.current = signature
      setDrafts(variables)
    }
  }, [signature, variables])
  const validation = validateDrafts(drafts)
  function update(next) {
    setDrafts(next)
    const result = validateDrafts(next)
    if (!result.error) {
      published.current = JSON.stringify(result.variables)
      onChange?.(result.variables)
    }
  }
  function patch(index, key, value) {
    update(drafts.map((item, at) => (at === index ? { ...item, [key]: value } : item)))
  }
  return (
    <div className="space-y-2" data-interaction-variable-editor>
      <p className="text-xs text-text-muted">
        Scores belong to this presentation document. Resetting a slide keeps scores unless
        explicitly configured otherwise.
      </p>
      {drafts.map((item, index) => (
        <fieldset key={item.id} className="space-y-1 rounded border border-border p-2">
          <legend className="text-xs text-text-muted">Variable {index + 1}</legend>
          <TextField
            label={`Variable ${index + 1} name`}
            value={item.name}
            maxLength={80}
            onChange={(value) => patch(index, 'name', value)}
          />
          {[
            ['initialValue', 'initial value'],
            ['min', 'minimum'],
            ['max', 'maximum'],
          ].map(([key, label]) => (
            <TextField
              key={key}
              label={`Variable ${index + 1} ${label}`}
              type="number"
              step="any"
              min={-1_000_000_000}
              max={1_000_000_000}
              value={item[key]}
              onChange={(value) => patch(index, key, value)}
            />
          ))}
          <Action
            label={`Remove variable ${index + 1}`}
            onClick={() => update(drafts.filter((_, at) => at !== index))}
          >
            Remove
          </Action>
        </fieldset>
      ))}
      {validation.error && (
        <p role="alert" className="text-xs text-red-400">
          {validation.error}
        </p>
      )}
      <Action
        label="Add variable"
        disabled={drafts.length >= 32}
        onClick={() =>
          update([
            ...drafts,
            {
              id: newId(),
              name: `Score ${drafts.length + 1}`,
              initialValue: 0,
              min: 0,
              max: 1_000_000_000,
            },
          ])
        }
      >
        Add variable
      </Action>
    </div>
  )
}

import React, { useState } from 'react'
import { generateCrossword, validateGameConfig } from 'revealjs-shared'
import {
  Action,
  newId,
  NumberField,
  OrderedList,
  SelectField,
  TextField,
  ToggleField,
  ValidationErrors,
} from './game-authoring-fields'

export default function WordPuzzleProperties({ config, onChange, gameType }) {
  const crossword = gameType === 'crossword'
  const key = crossword ? 'entries' : 'words'
  const items = config[key] || []
  const [generationError, setGenerationError] = useState(null)
  const errors = validateGameConfig(gameType, config).errors
  const change = (patch) => {
    setGenerationError(null)
    onChange(patch)
  }
  const generate = () => {
    try {
      const puzzle = generateCrossword(config)
      const placements = new Map(puzzle.placements.map((entry) => [entry.id, entry]))
      change({
        entries: items.map((entry) => {
          const placed = placements.get(entry.id)
          return { ...entry, row: placed.row, column: placed.column, direction: placed.direction }
        }),
      })
    } catch (error) {
      setGenerationError(error)
    }
  }
  return (
    <div className="space-y-2.5">
      <p className="text-xs text-text-muted">
        Local classroom — one device. Reset clears progress, not the seed or puzzle.
      </p>
      <TextField
        label="Puzzle title"
        value={config.title}
        onChange={(title) => change({ title })}
      />
      <NumberField
        label="Grid rows"
        value={config.rows}
        min={2}
        max={20}
        integer
        onChange={(rows) => change({ rows })}
      />
      <NumberField
        label="Grid columns"
        value={config.columns}
        min={2}
        max={20}
        integer
        onChange={(columns) => change({ columns })}
      />
      <NumberField
        label="Puzzle seed"
        value={config.seed}
        min={0}
        max={4294967295}
        integer
        onChange={(seed) => change({ seed })}
      />
      <OrderedList
        items={items}
        itemName={crossword ? 'Entry' : 'Word'}
        addLabel={crossword ? 'Add entry' : 'Add word'}
        max={40}
        onChange={(next) => change({ [key]: next })}
        createItem={() =>
          crossword
            ? { id: newId(), answer: '', clue: '', row: 0, column: 0, direction: 'across' }
            : { id: newId(), text: '' }
        }
      >
        {(item, index, patch) => (
          <>
            <TextField
              label={`${crossword ? 'Entry' : 'Word'} ${index + 1} ${crossword ? 'answer' : 'text'}`}
              value={item[crossword ? 'answer' : 'text']}
              onChange={(value) => {
                setGenerationError(null)
                patch({ [crossword ? 'answer' : 'text']: value })
              }}
            />
            {crossword && (
              <>
                <TextField
                  label={`Entry ${index + 1} clue`}
                  value={item.clue}
                  multiline
                  onChange={(clue) => patch({ clue })}
                />
                <NumberField
                  label={`Entry ${index + 1} row (zero-based)`}
                  value={item.row}
                  min={0}
                  max={(config.rows || 2) - 1}
                  integer
                  onChange={(row) => patch({ row })}
                />
                <NumberField
                  label={`Entry ${index + 1} column (zero-based)`}
                  value={item.column}
                  min={0}
                  max={(config.columns || 2) - 1}
                  integer
                  onChange={(column) => patch({ column })}
                />
                <SelectField
                  label={`Entry ${index + 1} direction`}
                  value={item.direction}
                  options={['across', 'down']}
                  onChange={(direction) => patch({ direction })}
                />
              </>
            )}
            <ValidationErrors
              errors={errors.filter(
                (error) => error.path?.[0] === key && error.path?.[1] === index
              )}
            />
          </>
        )}
      </OrderedList>
      {crossword ? (
        <>
          <p className="text-xs text-text-muted">
            Generate replaces coordinates/directions only after a complete bounded layout is found.
            Word IDs, answers and clues stay unchanged.
          </p>
          <Action label="Generate crossword layout" onClick={generate}>
            Generate layout from seed
          </Action>
          {generationError && (
            <p role="alert" className="text-xs text-red-400">
              {generationError.entryId ? `Entry ${generationError.entryId}: ` : ''}
              {generationError.code}: {generationError.message}
            </p>
          )}
        </>
      ) : (
        <>
          <fieldset className="space-y-1">
            <legend className="text-xs text-text-muted">Allowed directions</legend>
            {['E', 'W', 'N', 'S', 'NE', 'NW', 'SE', 'SW'].map((direction) => (
              <ToggleField
                key={direction}
                label={`Direction ${direction}`}
                value={(config.directions || []).includes(direction)}
                onChange={(enabled) =>
                  change({
                    directions: enabled
                      ? [...(config.directions || []), direction]
                      : (config.directions || []).filter((value) => value !== direction),
                  })
                }
              />
            ))}
          </fieldset>
          <TextField
            label="Fill alphabet"
            value={config.alphabet}
            onChange={(alphabet) => change({ alphabet })}
          />
        </>
      )}
      <ValidationErrors
        errors={errors.filter((error) => error.path?.[0] !== key || error.path?.length < 2)}
      />
    </div>
  )
}

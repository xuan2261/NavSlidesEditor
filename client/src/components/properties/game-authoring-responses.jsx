import React from 'react'
import AuthoringMedia from './game-authoring-media'
import { newId, NumberField, OrderedList, TextField, ToggleField } from './game-authoring-fields'

export default function ResponsesAuthoring({ config, onChange, gameType }) {
  const options = config.options || []
  const pairs = config.pairs || []
  return (
    <div className="space-y-2.5">
      <TextField
        label="Prompt"
        value={config.prompt}
        multiline
        onChange={(prompt) => onChange({ prompt })}
      />
      {gameType === 'poll' && (
        <>
          <OrderedList
            items={options}
            onChange={(options) => onChange({ options })}
            itemName="Poll option"
            addLabel="Add poll option"
            max={6}
            createItem={() => ({ id: newId(), text: `Option ${options.length + 1}` })}
          >
            {(option, index, patch) => (
              <TextField
                label={`Poll option ${index + 1} text`}
                value={option.text}
                onChange={(text) => patch({ text })}
              />
            )}
          </OrderedList>
          {options.length < 2 && (
            <p role="alert" className="text-xs text-red-400">
              A poll needs at least two options before saving. Add an option.
            </p>
          )}
          <ToggleField
            label="Show results"
            value={config.showResults}
            onChange={(showResults) => onChange({ showResults })}
          />
          <ToggleField
            label="Allow vote change"
            value={config.allowVoteChange}
            onChange={(allowVoteChange) => onChange({ allowVoteChange })}
          />
        </>
      )}
      {gameType === 'word-cloud' && (
        <>
          <NumberField
            label="Maximum phrase length"
            value={config.maxPhraseLength}
            min={1}
            max={40}
            integer
            onChange={(maxPhraseLength) => onChange({ maxPhraseLength })}
          />
          <NumberField
            label="Maximum submissions per player"
            value={config.maxSubmissionsPerPlayer}
            min={1}
            max={5}
            integer
            onChange={(maxSubmissionsPerPlayer) => onChange({ maxSubmissionsPerPlayer })}
          />
          <NumberField
            label="Display limit"
            value={config.displayLimit}
            min={1}
            max={50}
            integer
            onChange={(displayLimit) => onChange({ displayLimit })}
          />
        </>
      )}
      {gameType === 'matching' && (
        <>
          <OrderedList
            items={pairs}
            onChange={(pairs) => onChange({ pairs })}
            itemName="Pair"
            addLabel="Add pair"
            getKey={(pair) => pair.promptId}
            max={8}
            createItem={() => ({
              promptId: newId(),
              prompt: `Prompt ${pairs.length + 1}`,
              targetId: newId(),
              target: `Target ${pairs.length + 1}`,
            })}
          >
            {(pair, index, patch) => (
              <>
                <TextField
                  label={`Pair ${index + 1} prompt`}
                  value={pair.prompt}
                  onChange={(prompt) => patch({ prompt })}
                />
                <AuthoringMedia
                  label={`Pair ${index + 1} prompt`}
                  value={pair.promptMedia}
                  onChange={(promptMedia) => patch({ promptMedia })}
                />
                <TextField
                  label={`Pair ${index + 1} target`}
                  value={pair.target}
                  onChange={(target) => patch({ target })}
                />
                <AuthoringMedia
                  label={`Pair ${index + 1} target`}
                  value={pair.targetMedia}
                  onChange={(targetMedia) => patch({ targetMedia })}
                />
              </>
            )}
          </OrderedList>
          {pairs.length < 2 && (
            <p role="alert" className="text-xs text-red-400">
              Matching needs at least two pairs before saving. Add a pair.
            </p>
          )}
        </>
      )}
      <NumberField
        label="Timer duration in seconds"
        value={config.timerDuration}
        min={1}
        max={86400}
        integer
        onChange={(timerDuration) => onChange({ timerDuration })}
      />
    </div>
  )
}

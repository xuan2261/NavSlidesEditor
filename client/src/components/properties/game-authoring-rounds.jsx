import React from 'react'
import {
  Action,
  moveItem,
  newId,
  NumberField,
  OrderedList,
  SelectField,
  TextField,
  ToggleField,
} from './game-authoring-fields'

export default function TriviaRounds({ config, onChange }) {
  const rounds = config.rounds || []
  const questions = config.questions || []
  return (
    <div className="space-y-2">
      <OrderedList
        items={rounds}
        onChange={(rounds) => onChange({ rounds })}
        itemName="Round"
        addLabel="Add round"
        createItem={() => ({
          id: newId(),
          name: `Round ${rounds.length + 1}`,
          mode: 'individual',
          questionIds: [],
          timeLimit: 30,
        })}
      >
        {(round, index, patch) => {
          const ids = round.questionIds || []
          const missing = ids.filter((id) => !questions.some((question) => question.id === id))
          return (
            <>
              <TextField
                label={`Round ${index + 1} name`}
                value={round.name}
                onChange={(name) => patch({ name })}
              />
              <SelectField
                label={`Round ${index + 1} mode`}
                value={round.mode}
                options={['individual', 'team', 'buzzer']}
                onChange={(mode) => patch({ mode })}
              />
              <NumberField
                label={`Round ${index + 1} time limit in seconds`}
                min={1}
                max={86400}
                integer
                value={round.timeLimit}
                onChange={(timeLimit) => patch({ timeLimit })}
              />
              <fieldset className="space-y-1">
                <legend className="text-xs text-text-muted">Questions in round {index + 1}</legend>
                {questions.map((question, questionIndex) => (
                  <ToggleField
                    key={question.id}
                    label={`Round ${index + 1} include question ${questionIndex + 1}: ${question.prompt}`}
                    value={ids.includes(question.id)}
                    onChange={(selected) =>
                      patch({
                        questionIds: selected
                          ? [...ids, question.id]
                          : ids.filter((id) => id !== question.id),
                      })
                    }
                  />
                ))}
              </fieldset>
              {ids.map((id, at) => (
                <div key={id} className="flex flex-wrap gap-1 text-xs text-text-primary">
                  <span>
                    {questions.find((question) => question.id === id)?.prompt ||
                      `Missing question ${id}`}
                  </span>
                  <Action
                    label={`Move round ${index + 1} question ${at + 1} up`}
                    disabled={at === 0}
                    onClick={() => patch({ questionIds: moveItem(ids, at, -1) })}
                  >
                    Up
                  </Action>
                  <Action
                    label={`Move round ${index + 1} question ${at + 1} down`}
                    disabled={at === ids.length - 1}
                    onClick={() => patch({ questionIds: moveItem(ids, at, 1) })}
                  >
                    Down
                  </Action>
                </div>
              ))}
              {missing.length > 0 && (
                <div role="alert" className="space-y-1 text-xs text-red-400">
                  {missing.map((id) => (
                    <div key={id}>
                      Missing question {id} in round {index + 1}. Restore it or remove its reference
                      before saving.
                      <Action
                        label={`Remove missing question ${id} from round ${index + 1}`}
                        onClick={() =>
                          patch({ questionIds: ids.filter((current) => current !== id) })
                        }
                      >
                        Remove reference
                      </Action>
                    </div>
                  ))}
                </div>
              )}
            </>
          )
        }}
      </OrderedList>
      <NumberField
        label="Buzz points"
        value={config.buzzPoints}
        min={0}
        max={1e9}
        onChange={(buzzPoints) => onChange({ buzzPoints })}
      />
      <ToggleField
        label="Enable lightning round"
        value={config.lightningRound?.enabled}
        onChange={(enabled) => onChange({ lightningRound: { ...config.lightningRound, enabled } })}
      />
      <NumberField
        label="Lightning time per question in seconds"
        value={config.lightningRound?.timePerQ}
        min={1}
        max={86400}
        integer
        onChange={(timePerQ) =>
          onChange({ lightningRound: { ...config.lightningRound, timePerQ } })
        }
      />
      <ToggleField
        label="Enable jackpot round"
        value={config.jackpotRound?.enabled}
        onChange={(enabled) => onChange({ jackpotRound: { ...config.jackpotRound, enabled } })}
      />
      <NumberField
        label="Jackpot multiplier"
        value={config.jackpotRound?.multiplier}
        min={1}
        max={1000}
        onChange={(multiplier) =>
          onChange({ jackpotRound: { ...config.jackpotRound, multiplier } })
        }
      />
    </div>
  )
}

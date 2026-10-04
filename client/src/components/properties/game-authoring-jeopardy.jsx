import React from 'react'
import { validateCanonicalQuestion } from 'revealjs-shared'
import AuthoringMedia from './game-authoring-media'
import {
  Action,
  newId,
  NumberField,
  OrderedList,
  TeamFields,
  TextField,
  ToggleField,
  ValidationErrors,
} from './game-authoring-fields'

export default function JeopardyAuthoring({ config, onChange, onEditQuestion }) {
  const categories = config.categories || []
  const dailyDouble = config.dailyDouble || []
  const cellIds = new Set(
    categories.flatMap((category) => category.questions.map((question) => question.id))
  )
  const missing = dailyDouble.filter((id) => !cellIds.has(id))
  return (
    <div className="space-y-2.5">
      <OrderedList
        items={categories}
        itemName="Category"
        addLabel="Add category"
        createItem={() => ({
          id: newId(),
          title: `Category ${categories.length + 1}`,
          questions: [],
        })}
        onChange={(categories) => onChange({ categories })}
      >
        {(category, index, patch) => (
          <>
            <TextField
              label={`Category ${index + 1} title`}
              value={category.title}
              onChange={(title) => patch({ title })}
            />
            <OrderedList
              items={category.questions}
              itemName={`Category ${index + 1} cell`}
              onChange={(questions) => patch({ questions })}
            >
              {(question, cellIndex, patchCell) => {
                const label = `Category ${index + 1} cell ${cellIndex + 1}`
                return (
                  <>
                    <p className="text-xs text-text-primary">
                      {question.prompt || 'Untitled question'}
                    </p>
                    <NumberField
                      label={`${label} points`}
                      value={question.points}
                      min={0}
                      onChange={(points) => patchCell({ points })}
                    />
                    <AuthoringMedia
                      label={label}
                      value={question.media}
                      onChange={(media) => patchCell({ media })}
                    />
                    <ToggleField
                      label={`${label} daily double`}
                      value={dailyDouble.includes(question.id)}
                      onChange={(enabled) =>
                        onChange({
                          dailyDouble: enabled
                            ? [...dailyDouble, question.id]
                            : dailyDouble.filter((id) => id !== question.id),
                        })
                      }
                    />
                    <Action
                      label={`Edit ${label.toLowerCase()} question`}
                      onClick={() =>
                        onEditQuestion(question, (saved) =>
                          patch({
                            questions: category.questions.map((current) =>
                              current.id === question.id ? { ...saved, id: question.id } : current
                            ),
                          })
                        )
                      }
                    >
                      Edit question
                    </Action>
                    <ValidationErrors errors={validateCanonicalQuestion(question).errors} />
                  </>
                )
              }}
            </OrderedList>
            <Action
              label={`Add category ${index + 1} cell`}
              onClick={() =>
                onEditQuestion(null, (saved) =>
                  patch({ questions: [...category.questions, saved] })
                )
              }
            >
              Add cell question
            </Action>
            {!category.questions.length && (
              <p role="alert" className="text-xs text-red-400">
                Add at least one cell question to {category.title || `category ${index + 1}`} before
                saving.
              </p>
            )}
          </>
        )}
      </OrderedList>
      {!categories.length && (
        <p role="alert" className="text-xs text-red-400">
          Add a category before saving.
        </p>
      )}
      {missing.length > 0 && (
        <div role="alert" className="space-y-1 text-xs text-red-400">
          {missing.map((id) => (
            <div key={id}>
              Daily double references missing cell {id}. Remove this reference or restore the cell
              before saving.
              <Action
                label={`Remove missing daily double ${id}`}
                onClick={() =>
                  onChange({ dailyDouble: dailyDouble.filter((current) => current !== id) })
                }
              >
                Remove reference
              </Action>
            </div>
          ))}
        </div>
      )}
      <NumberField
        label="Wager limit"
        value={config.wagerLimit}
        min={0}
        max={1e9}
        onChange={(wagerLimit) => onChange({ wagerLimit })}
      />
      <ToggleField
        label="Allow negative points"
        value={config.negativePoints}
        onChange={(negativePoints) => onChange({ negativePoints })}
      />
      <NumberField
        label="Timer duration in seconds"
        value={config.timerDuration}
        min={1}
        max={86400}
        integer
        onChange={(timerDuration) => onChange({ timerDuration })}
      />
      <ToggleField
        label="Show timer"
        value={config.showTimer}
        onChange={(showTimer) => onChange({ showTimer })}
      />
      <TeamFields teams={config.teams} onChange={(teams) => onChange({ teams })} />
    </div>
  )
}

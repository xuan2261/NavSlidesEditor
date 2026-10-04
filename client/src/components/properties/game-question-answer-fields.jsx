import { useId } from 'react'
import QuestionOptionList from './game-question-option-list'
import {
  buttonClass,
  CheckField,
  ItemSelect,
  moveItem,
  RowActions,
  SelectField,
  TextField,
} from './game-question-controls'

export function ChoiceFields({ value, onChange }) {
  const groupName = useId()
  const multiple = value.kind === 'multi-choice'
  const setKey = (answerKey) => onChange({ ...value, answerKey })
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-text-primary">Answer options</legend>
      <p className="text-xs text-text-muted">
        Mark {multiple ? 'every correct option' : 'one correct option'}. Correctness follows item
        identity, not display position.
      </p>
      <QuestionOptionList
        options={value.options || []}
        onChange={(options) => onChange({ ...value, options })}
        renderAnswer={(option, index) => (
          <CheckField
            label={`Correct option ${index + 1}`}
            path={['answerKey', multiple ? 'optionIds' : 'optionId']}
            type={multiple ? 'checkbox' : 'radio'}
            name={groupName}
            checked={
              multiple
                ? (value.answerKey.optionIds || []).includes(option.id)
                : value.answerKey.optionId === option.id
            }
            onChange={(checked) => {
              if (!multiple) setKey({ optionId: option.id })
              else
                setKey({
                  optionIds: checked
                    ? [...(value.answerKey.optionIds || []), option.id]
                    : (value.answerKey.optionIds || []).filter((id) => id !== option.id),
                })
            }}
          />
        )}
      />
    </fieldset>
  )
}

export function OrderingFields({ value, onChange }) {
  const options = value.options || []
  const itemIds = value.answerKey.itemIds || []
  const setOrder = (next) => onChange({ ...value, answerKey: { itemIds: next } })
  return (
    <div className="space-y-3">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-text-primary">Items in display order</legend>
        <QuestionOptionList
          noun="item"
          options={options}
          onChange={(next) => onChange({ ...value, options: next })}
        />
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-text-primary">
          Correct answer sequence (private)
        </legend>
        <p className="text-xs text-text-muted">
          Set every item once. Moving display items does not change this sequence. Remove any
          deleted item here explicitly.
        </p>
        {itemIds.map((id, index) => (
          <div key={`${id}-${index}`} className="rounded border border-border p-2 space-y-1">
            <ItemSelect
              label={`Answer step ${index + 1}`}
              path={['answerKey', 'itemIds', index]}
              value={id}
              options={options.filter((option) => option.id === id || !itemIds.includes(option.id))}
              onChange={(next) =>
                setOrder(itemIds.map((itemId, position) => (position === index ? next : itemId)))
              }
            />
            <RowActions
              label={`answer step ${index + 1}`}
              index={index}
              count={itemIds.length}
              deleteVerb="Remove"
              onMove={(offset) => setOrder(moveItem(itemIds, index, offset))}
              onDelete={() => setOrder(itemIds.filter((_, position) => position !== index))}
            />
          </div>
        ))}
        <ItemSelect
          label="Add answer step"
          path={['answerKey', 'itemIds']}
          value=""
          options={options.filter((option) => !itemIds.includes(option.id))}
          onChange={(id) => {
            if (id) setOrder([...itemIds, id])
          }}
        />
      </fieldset>
    </div>
  )
}

export function BooleanFields({ value, onChange }) {
  return (
    <SelectField
      label="Correct boolean answer"
      path={['answerKey', 'value']}
      value={String(value.answerKey.value)}
      onChange={(next) => onChange({ ...value, answerKey: { value: next === 'true' } })}
    >
      <option value="true">True</option>
      <option value="false">False</option>
    </SelectField>
  )
}

export function FillBlankFields({ value, onChange }) {
  const accepted = value.answerKey.accepted || []
  const patchKey = (patch) => onChange({ ...value, answerKey: { ...value.answerKey, ...patch } })
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-text-primary">Accepted answers</legend>
      <p className="text-xs text-text-muted">
        Answers are trimmed and Unicode-normalized. Accents remain significant.
      </p>
      {accepted.map((text, index) => (
        <div key={index} className="rounded border border-border p-2 space-y-1">
          <TextField
            label={`Accepted answer ${index + 1}`}
            path={['answerKey', 'accepted', index]}
            value={text}
            onChange={(next) =>
              patchKey({
                accepted: accepted.map((answer, position) => (position === index ? next : answer)),
              })
            }
          />
          <RowActions
            label={`accepted answer ${index + 1}`}
            index={index}
            count={accepted.length}
            onMove={(offset) => patchKey({ accepted: moveItem(accepted, index, offset) })}
            onDelete={() =>
              patchKey({ accepted: accepted.filter((_, position) => position !== index) })
            }
          />
        </div>
      ))}
      <button
        type="button"
        className={buttonClass}
        onClick={() => patchKey({ accepted: [...accepted, ''] })}
      >
        Add accepted answer
      </button>
      <CheckField
        label="Case-sensitive answers"
        path={['answerKey', 'caseSensitive']}
        checked={value.answerKey.caseSensitive === true}
        onChange={(caseSensitive) => patchKey({ caseSensitive })}
      />
    </fieldset>
  )
}

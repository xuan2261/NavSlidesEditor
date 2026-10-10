import React, { useEffect, useId, useState } from 'react'
import { validateCanonicalQuestion } from 'revealjs-shared'

export const FIELD_CLASS =
  'w-full min-h-8 rounded-md border border-border bg-card px-2 py-1 text-xs text-text-primary focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/25'
export const newId = () => crypto.randomUUID()

export function TextField({ label, value, onChange, multiline = false, ...props }) {
  const id = useId()
  const Input = multiline ? 'textarea' : 'input'
  return (
    <label htmlFor={id} className="block text-xs text-text-muted">
      {label}
      <Input
        id={id}
        aria-label={label}
        className={FIELD_CLASS}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        {...props}
      />
    </label>
  )
}

export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
  integer = false,
  step = integer ? 1 : 'any',
}) {
  const id = useId()
  const [draft, setDraft] = useState(String(value ?? ''))
  const [error, setError] = useState('')
  useEffect(() => {
    setDraft(String(value ?? ''))
    setError('')
  }, [value])
  const update = (event) => {
    const text = event.target.value
    setDraft(text)
    const next = Number(text)
    const valid =
      text.trim() &&
      Number.isFinite(next) &&
      next >= min &&
      (max === undefined || next <= max) &&
      (!integer || Number.isInteger(next))
    setError(
      valid
        ? ''
        : `Enter ${integer ? 'a whole number' : 'a number'} from ${min}${max === undefined ? ' or higher' : ` to ${max}`}.`
    )
    if (valid) onChange(next)
  }
  return (
    <label htmlFor={id} className="block text-xs text-text-muted">
      {label}
      <input
        id={id}
        aria-label={label}
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={update}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={FIELD_CLASS}
      />
      {error && (
        <span id={`${id}-error`} role="alert" className="block text-red-400">
          {error}
        </span>
      )}
    </label>
  )
}

export function ToggleField({ label, value, onChange }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-text-primary">
      <input
        type="checkbox"
        aria-label={label}
        checked={value === true}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  )
}

export function SelectField({ label, value, options, onChange }) {
  const id = useId()
  return (
    <label htmlFor={id} className="block text-xs text-text-muted">
      {label}
      <select
        id={id}
        aria-label={label}
        className={FIELD_CLASS}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => {
          const [key, text] = Array.isArray(option) ? option : [option, option]
          return (
            <option key={key} value={key}>
              {text}
            </option>
          )
        })}
      </select>
    </label>
  )
}

export function Action({ label, children, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="rounded border border-border px-2 py-1 text-xs text-accent disabled:opacity-40"
      {...props}
    >
      {children}
    </button>
  )
}

export function moveItem(items, index, offset) {
  const next = [...items]
  const target = index + offset
  if (target < 0 || target >= items.length) return items
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export function OrderedList({
  items,
  onChange,
  itemName,
  addLabel,
  createItem,
  children,
  getKey = (item) => item.id,
  max,
}) {
  return (
    <div className="space-y-2">
      {items.map((item, index) => {
        const name = `${itemName} ${index + 1}`
        const patch = (changes) =>
          onChange(
            items.map((current, at) => (at === index ? { ...current, ...changes } : current))
          )
        return (
          <fieldset
            key={getKey(item)}
            aria-label={name}
            className="space-y-1 rounded border border-border p-2"
          >
            <legend className="text-xs text-text-muted">{name}</legend>
            {children(item, index, patch)}
            <div className="flex flex-wrap gap-1">
              <Action
                label={`Move ${name.toLowerCase()} up`}
                disabled={index === 0}
                onClick={() => onChange(moveItem(items, index, -1))}
              >
                Up
              </Action>
              <Action
                label={`Move ${name.toLowerCase()} down`}
                disabled={index === items.length - 1}
                onClick={() => onChange(moveItem(items, index, 1))}
              >
                Down
              </Action>
              <Action
                label={`Delete ${name.toLowerCase()}`}
                onClick={() => onChange(items.filter((_, at) => at !== index))}
              >
                Delete
              </Action>
            </div>
          </fieldset>
        )
      })}
      {createItem && (
        <Action
          label={addLabel}
          disabled={max !== undefined && items.length >= max}
          onClick={() => onChange([...items, createItem()])}
        >
          {addLabel}
        </Action>
      )}
    </div>
  )
}

export function TeamFields({ teams = [], onChange }) {
  // Only authored identity/name/color are persisted; runtime score never enters config.
  const update = (next) => onChange(next.map(({ id, name, color }) => ({ id, name, color })))
  return (
    <OrderedList
      items={teams}
      onChange={update}
      itemName="Team"
      addLabel="Add team"
      max={100}
      createItem={() => ({ id: newId(), name: `Team ${teams.length + 1}`, color: '#6366f1' })}
    >
      {(team, index, patch) => (
        <>
          <TextField
            label={`Team ${index + 1} name`}
            value={team.name}
            onChange={(name) => patch({ name })}
          />
          <TextField
            label={`Team ${index + 1} color`}
            type="color"
            value={team.color}
            onChange={(color) => patch({ color })}
          />
        </>
      )}
    </OrderedList>
  )
}

export function QuestionList({ questions = [], onChange, onEditQuestion }) {
  return (
    <>
      <OrderedList items={questions} onChange={onChange} itemName="Question">
        {(question, index) => (
          <>
            <p className="text-xs text-text-primary">
              {question.prompt || 'Untitled question'} · {question.points} points
            </p>
            <Action
              label={`Edit question ${index + 1}`}
              onClick={() =>
                onEditQuestion(question, (saved) =>
                  onChange(
                    questions.map((current) =>
                      current.id === question.id ? { ...saved, id: question.id } : current
                    )
                  )
                )
              }
            >
              Edit question
            </Action>
            <ValidationErrors errors={validateCanonicalQuestion(question).errors} />
          </>
        )}
      </OrderedList>
      <Action
        label="Add question"
        onClick={() => onEditQuestion(null, (saved) => onChange([...questions, saved]))}
      >
        Add question
      </Action>
    </>
  )
}

export function ValidationErrors({ errors = [] }) {
  if (!errors.length) return null
  return (
    <div role="alert" className="text-xs text-red-400">
      <p>Resolve these issues before saving:</p>
      <ul>
        {errors.map((error, index) => (
          <li key={index}>
            {error.path?.join('.') ? `${error.path.join('.')}: ` : ''}
            {error.message}
          </li>
        ))}
      </ul>
    </div>
  )
}

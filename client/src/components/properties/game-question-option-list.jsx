import { buttonClass, MediaFields, moveItem, RowActions, TextField } from './game-question-controls'

export default function QuestionOptionList({
  options,
  onChange,
  path = ['options'],
  noun = 'option',
  media = true,
  renderAnswer,
}) {
  const update = (index, patch) =>
    onChange(
      options.map((option, position) => (position === index ? { ...option, ...patch } : option))
    )
  const setMedia = (index, nextMedia) =>
    onChange(
      options.map((option, position) => {
        if (position !== index) return option
        if (nextMedia) return { ...option, media: nextMedia }
        const next = { ...option }
        delete next.media
        return next
      })
    )
  return (
    <div className="space-y-2">
      {options.map((option, index) => {
        const label = `${noun[0].toUpperCase()}${noun.slice(1)} ${index + 1}`
        return (
          <fieldset key={option.id} className="rounded border border-border p-2 space-y-2">
            <legend className="text-xs font-medium text-text-primary">{label}</legend>
            <TextField
              label={`${label} text`}
              value={option.text}
              path={[...path, index, 'text']}
              onChange={(text) => update(index, { text })}
            />
            {media && (
              <MediaFields
                label={label}
                media={option.media}
                path={[...path, index, 'media']}
                onChange={(next) => setMedia(index, next)}
              />
            )}
            {renderAnswer?.(option, index)}
            <RowActions
              label={`${noun} ${index + 1}`}
              index={index}
              count={options.length}
              onMove={(offset) => onChange(moveItem(options, index, offset))}
              onDelete={() => onChange(options.filter((item) => item.id !== option.id))}
            />
          </fieldset>
        )
      })}
      <button
        type="button"
        className={buttonClass}
        onClick={() => onChange([...options, { id: crypto.randomUUID(), text: '' }])}
      >
        Add {noun}
      </button>
    </div>
  )
}

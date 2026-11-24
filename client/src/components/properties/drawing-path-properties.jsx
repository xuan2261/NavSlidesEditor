import { useId, useState } from 'react'
import { parseDrawingPathsDraft } from './drawing-path-data'

export default function DrawingPathProperties({ element, onUpdate }) {
  const id = useId()
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState(null)
  const locked = element.locked === true
  return (
    <div className="mb-2.5">
      <label htmlFor={id} className="block text-[11px] text-text-muted mb-1">
        Drawing path data
      </label>
      <textarea
        id={id}
        aria-label="Drawing path data"
        data-testid="prop-drawing-path-data"
        aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}
        aria-invalid={error ? 'true' : undefined}
        disabled={locked}
        spellCheck={false}
        className="w-full min-h-[120px] bg-card border border-border text-text-primary px-2 py-1.5 rounded text-[11px] font-mono resize-y"
        value={draft ?? JSON.stringify(element.paths || [], null, 2)}
        onBlur={() => {
          if (!error) setDraft(null)
        }}
        onChange={(event) => {
          if (locked) return
          const value = event.target.value
          setDraft(value)
          let paths
          try {
            paths = parseDrawingPathsDraft(value)
          } catch (invalid) {
            setError(invalid.message)
            return
          }
          setError(null)
          onUpdate({ paths })
        }}
      />
      <p id={`${id}-help`} className="text-[10px] text-text-muted">
        JSON array of SVG paths: {'[{"d":"M0 0 L100 100"}]'}. Optional stroke, strokeWidth and
        opacity override the drawing style. Coordinates are local pixels; [] clears the drawing.
      </p>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-[11px] text-red-400">
          {error} The last valid drawing is unchanged.
        </p>
      )}
    </div>
  )
}

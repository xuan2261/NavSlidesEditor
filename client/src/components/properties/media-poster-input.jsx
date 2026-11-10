import { useState } from 'react'
import { Input } from '../../components/ui'
import { resolveUrlEntry } from '../../utils/url-safety'
import { isMediaPoster } from 'revealjs-shared/src/pptx-media-metadata.js'

export default function MediaPosterInput({ element, onUpdate }) {
  const [draft, setDraft] = useState(null)
  const baseline = element.poster || ''
  const current = draft !== null && draft.id === element.id && draft.baseline === baseline ? draft : null
  const value = current ? current.value : baseline
  return (
    <>
      <Input
        aria-label="Video poster image URL"
        aria-invalid={current?.invalid || undefined}
        disabled={element.locked === true}
        className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted mb-2"
        type="text"
        value={value}
        onChange={(event) => {
          const value = event.target.value
          if (element.pptxInstanceId) {
            const valid = isMediaPoster(value)
            setDraft({ id: element.id, baseline, value, invalid: !valid })
            if (valid) onUpdate({ poster: value })
          } else {
            const next = resolveUrlEntry(value, 'image')
            if (next.value || !value) onUpdate({ poster: next.value })
          }
        }}
        placeholder={element.pptxInstanceId ? '/uploads/poster.png (optional)' : 'Thumbnail URL (optional)'}
      />
      {current?.invalid && (
        <p role="alert" className="text-[11px] text-red-400 mb-2">
          Enter an uploaded image path, such as /uploads/poster.png, or leave it empty.
        </p>
      )}
    </>
  )
}

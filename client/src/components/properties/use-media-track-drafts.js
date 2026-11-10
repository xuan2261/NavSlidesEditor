import { useState } from 'react'
import { validateMediaMetadataField } from 'revealjs-shared/src/pptx-media-metadata.js'

// Canonical occurrence patches stay strict while a URL can still be typed one character at a time.
export function useMediaTrackDrafts(element, onUpdate) {
  const [draft, setDraft] = useState(null)
  const baseline = JSON.stringify(element.tracks || [])
  const current =
    draft !== null && draft.id === element.id && draft.baseline === baseline ? draft : null
  return {
    tracks: current?.tracks ?? (Array.isArray(element.tracks) ? element.tracks : []),
    tracksError: current?.error,
    updateTracks(tracks) {
      if (!element.pptxInstanceId) {
        onUpdate({ tracks })
        return
      }
      try {
        validateMediaMetadataField('tracks', tracks)
      } catch (error) {
        setDraft({ id: element.id, baseline, tracks, error: error.message })
        return
      }
      setDraft(null)
      onUpdate({ tracks })
    },
  }
}

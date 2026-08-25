import { Input, Select } from '../../components/ui'
import { clampNumber } from '../../utils/number-input'
import { resolveUrlEntry } from '../../utils/url-safety'
import { resolveVideoSrc } from '../../utils/migrate-video-src'
/**
 * Video/Audio media properties: source URL, poster, controls, autoplay, loop, muted.
 */

export default function MediaProperties({ element, onUpdate }) {
  const isVideo = element.type === 'video'
  const locked = element.locked === true
  const tracks = Array.isArray(element.tracks) ? element.tracks : []
  const updateTracks = (next) => onUpdate({ tracks: next })
  const updateNumber = (key, value, min = null, max = null) => {
    const next = clampNumber(value, min, max, null)
    if (next === null) return
    onUpdate({ [key]: next })
  }

  return (
    <div className="mb-2.5">
      <div className="text-[11px] text-text-muted mb-1">Source URL</div>
      <Input
        aria-label={isVideo ? 'Video source URL' : 'Audio source URL'}
        className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted mb-2"
        type="text"
        value={isVideo ? resolveVideoSrc(element) : element.src || ''}
        onChange={(e) => {
          const next = resolveUrlEntry(e.target.value, isVideo ? 'video' : 'audio')
          if (next.value || !e.target.value) onUpdate({ src: next.value })
        }}
        placeholder={isVideo ? 'Upload path or URL' : 'Audio URL'}
      />
      {isVideo && (
        <>
          <div className="text-[11px] text-text-muted mb-1">
            Poster Image URL
          </div>
          <Input
            aria-label="Video poster image URL"
            className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted mb-2"
            type="text"
            value={element.poster || ''}
            onChange={(e) => {
              const next = resolveUrlEntry(e.target.value, 'image')
              if (next.value || !e.target.value) onUpdate({ poster: next.value })
            }}
            placeholder="Thumbnail URL (optional)"
          />
          <div className="text-[11px] text-text-muted mb-1">
            Object Fit
          </div>
          <Select
            aria-label="Video object fit"
            className="w-full bg-card border border-border text-text-primary px-1.5 py-1 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted mb-2"
            value={element.objectFit || 'contain'}
            onChange={(e) => onUpdate({ objectFit: e.target.value })}
          >
            {['contain', 'cover', 'fill', 'none'].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div>
              <div className="text-[11px] text-text-muted mb-1">
                Start Time
              </div>
              <Input
                data-testid="prop-video-start-time"
                aria-label="Video start time"
                className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
                type="number"
                min="0"
                step="0.1"
                value={element.startTime ?? 0}
                onChange={(e) => updateNumber('startTime', e.target.value, 0)}
              />
            </div>
            <div>
              <div className="text-[11px] text-text-muted mb-1">
                End Time
              </div>
              <Input
                data-testid="prop-video-end-time"
                aria-label="Video end time"
                className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
                type="number"
                min="0"
                step="0.1"
                value={element.endTime ?? 0}
                onChange={(e) => updateNumber('endTime', e.target.value, 0)}
              />
            </div>
            <div>
              <div className="text-[11px] text-text-muted mb-1">
                Playback Speed
              </div>
              <Input
                data-testid="prop-video-playback-rate"
                aria-label="Video playback speed"
                className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
                type="number"
                min="0.25"
                max="4"
                step="0.25"
                value={element.playbackRate ?? 1}
                onChange={(e) => updateNumber('playbackRate', e.target.value, 0.25, 4)}
              />
            </div>
          </div>
        </>
      )}
      <div className="flex flex-col gap-1">
        {[
          ['controls', 'Show controls'],
          ['autoplay', 'Autoplay'],
          ['loop', 'Loop'],
          ['muted', 'Muted'],
        ].map(([key, label]) => (
          <label
            key={key}
            className="flex items-center gap-1.5 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={key === 'controls' ? element[key] !== false : element[key] || false}
              onChange={(e) => onUpdate({ [key]: e.target.checked })}
              className="accent-accent"
            />
            <span className="text-xs text-text-secondary">{label}</span>
          </label>
        ))}
      </div>
      <div className="border-t border-border pt-2 mt-2">
        <div className="text-[11px] text-text-muted mb-1.5 font-medium">Accessibility</div>
        <div className="text-[11px] text-text-muted mb-1">Transcript</div>
        <textarea aria-label="Media transcript" disabled={locked} className="w-full min-h-[52px] bg-card border border-border text-text-primary px-2 py-1 text-xs resize-y mb-2" value={element.transcript || ''} onChange={(event) => onUpdate({ transcript: event.target.value })} />
        <div className="text-[11px] text-text-muted mb-1">Audio description</div>
        <textarea aria-label="Media audio description" disabled={locked} className="w-full min-h-[52px] bg-card border border-border text-text-primary px-2 py-1 text-xs resize-y mb-2" value={element.audioDescription || ''} onChange={(event) => onUpdate({ audioDescription: event.target.value })} />
        <div className="flex items-center justify-between mb-1"><span className="text-[11px] text-text-muted">Caption tracks</span><button type="button" disabled={locked || tracks.length >= 32} className="text-xs text-accent" onClick={() => updateTracks([...tracks, { src: '', srcLang: '', label: '', kind: 'captions', default: tracks.length === 0 }])}>Add track</button></div>
        {tracks.map((track, index) => {
          const safe = resolveUrlEntry(track.src, 'video')
          const patchTrack = (patch) => updateTracks(tracks.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : patch.default ? { ...item, default: false } : item))
          return <div key={`${track.src}-${index}`} className="border border-border rounded p-1.5 mb-1.5" aria-label={`Caption track ${index + 1}`}>
            <div className="flex items-center justify-between text-[11px] text-text-muted"><span>Caption track {index + 1}</span><div><button type="button" disabled={locked || index === 0} onClick={() => { const next = [...tracks]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; updateTracks(next) }}>Up</button><button type="button" disabled={locked || index === tracks.length - 1} className="ml-2" onClick={() => { const next = [...tracks]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; updateTracks(next) }}>Down</button><button type="button" disabled={locked} className="ml-2" onClick={() => updateTracks(tracks.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div></div>
            <Input aria-label={`Caption track ${index + 1} URL`} disabled={locked} value={track.src || ''} placeholder="Track URL" className="w-full mt-1 px-1.5 py-1 text-xs" onChange={(event) => { const next = resolveUrlEntry(event.target.value, 'video'); if (next.value || !event.target.value) patchTrack({ src: next.value }) }} />
            {!safe.value && track.src && <p role="alert" className="text-[11px] text-red-500">{safe.error}</p>}
            <div className="grid grid-cols-3 gap-1 mt-1"><Input aria-label={`Caption track ${index + 1} language`} disabled={locked} value={track.srcLang || ''} placeholder="Language" className="px-1.5 py-1 text-xs" onChange={(event) => patchTrack({ srcLang: event.target.value })} /><Input aria-label={`Caption track ${index + 1} label`} disabled={locked} value={track.label || ''} placeholder="Label" className="px-1.5 py-1 text-xs" onChange={(event) => patchTrack({ label: event.target.value })} /><Select aria-label={`Caption track ${index + 1} kind`} disabled={locked} value={track.kind || 'captions'} className="px-1 text-xs" onChange={(event) => patchTrack({ kind: event.target.value })}>{['captions', 'subtitles', 'descriptions', 'chapters', 'metadata'].map((kind) => <option key={kind}>{kind}</option>)}</Select></div>
            <label className="flex items-center gap-1 text-xs mt-1"><input aria-label={`Caption track ${index + 1} default`} type="checkbox" disabled={locked} checked={track.default === true} onChange={(event) => patchTrack({ default: event.target.checked })} />Default track</label>
          </div>
        })}
      </div>
    </div>
  )
}

import { Input, Select } from '../../components/ui'
import { clampNumber } from '../../utils/number-input'
/**
 * Video/Audio media properties: source URL, poster, controls, autoplay, loop, muted.
 */

export default function MediaProperties({ element, onUpdate }) {
  const isVideo = element.type === 'video'
  const updateNumber = (key, value, min = null, max = null) => {
    const next = clampNumber(value, min, max, null)
    if (next === null) return
    onUpdate({ [key]: next })
  }

  return (
    <div className="mb-2.5">
      <div className="text-[11px] text-text-muted mb-1">Source URL</div>
      <Input
        className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted mb-2"
        type="text"
        value={element.src || ''}
        onChange={(e) => onUpdate({ src: e.target.value })}
        placeholder={isVideo ? 'Upload path or URL' : 'Audio URL'}
      />
      {isVideo && (
        <>
          <div className="text-[11px] text-text-muted mb-1">
            Poster Image URL
          </div>
          <Input
            className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted mb-2"
            type="text"
            value={element.poster || ''}
            onChange={(e) => onUpdate({ poster: e.target.value })}
            placeholder="Thumbnail URL (optional)"
          />
          <div className="text-[11px] text-text-muted mb-1">
            Object Fit
          </div>
          <Select
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
    </div>
  )
}

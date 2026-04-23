import { Input, Select } from '../../components/ui'
/**
 * Video/Audio media properties: source URL, poster, controls, autoplay, loop, muted.
 */

export default function MediaProperties({ element, onUpdate }) {
  const isVideo = element.type === 'video'

  return (
    <div className="mb-2.5">
      <div className="text-[11px] text-text-muted mb-1">Source URL</div>
      <Input
        className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted mb-2"
        type="text"
        value={element.src || ''}
        onChange={(e) => onUpdate({ src: e.target.value })}
        placeholder={isVideo ? 'Video URL' : 'Audio URL'}
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
        </>
      )}
      <div className="flex flex-col gap-1">
        {(isVideo
          ? [
              ['controls', 'Show controls'],
              ['autoplay', 'Autoplay'],
              ['loop', 'Loop'],
              ['muted', 'Muted'],
            ]
          : [
              ['autoplay', 'Autoplay'],
              ['loop', 'Loop'],
              ['muted', 'Muted'],
            ]
        ).map(([key, label]) => (
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

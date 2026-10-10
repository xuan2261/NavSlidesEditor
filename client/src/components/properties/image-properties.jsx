import { useId } from 'react'
import { Select, Input, ColorPicker } from '../../components/ui'
import { clampNumber } from '../../utils/number-input'
import { computeMixedValues } from '../../utils/selection-mixed-values'
import MixedValueNotice from './mixed-value-notice'
import FocusedAuthoringTextInput from './focused-authoring-text-input'

const IMAGE_VISUAL_DEFAULTS = {
  src: '',
  flipH: false,
  flipV: false,
  filterSepia: 0,
  filterBlur: 0,
  objectFit: 'contain',
  filterBrightness: 100,
  filterContrast: 100,
  filterGrayscale: 0,
  filterSaturate: 100,
  borderRadius: 0,
  borderWidth: 0,
  borderColor: '#000000',
}

const IMAGE_RANGES = [
  ['Brightness', 'filterBrightness', 'brightness', 200, '%'],
  ['Contrast', 'filterContrast', 'contrast', 200, '%'],
  ['Grayscale', 'filterGrayscale', 'grayscale', 100, '%'],
  ['Saturation', 'filterSaturate', 'saturation', 200, '%'],
  ['Sepia', 'filterSepia', 'sepia', 100, '%'],
  ['Blur', 'filterBlur', 'blur', 20, 'px'],
  ['Round Corners', 'borderRadius', 'border-radius', 100, 'px'],
]
/** Image source, appearance, accessibility and citation authoring. */

export default function ImageProperties({
  element,
  onUpdate,
  elements = [],
  selectedElementIds = [],
}) {
  const mixedId = useId()
  const effectiveImages = elements
    .filter((candidate) => candidate.type === 'image')
    .map((candidate) => ({
      ...candidate,
      ...Object.fromEntries(
        Object.entries(IMAGE_VISUAL_DEFAULTS).map(([key, fallback]) => [
          key,
          candidate[key] ?? fallback,
        ])
      ),
    }))
  const mixed = computeMixedValues(effectiveImages, selectedElementIds, [
    'alt',
    'decorative',
    'longDescription',
    ...Object.keys(IMAGE_VISUAL_DEFAULTS),
  ])
  const visualValue = (key) => element[key] ?? IMAGE_VISUAL_DEFAULTS[key]
  const mixedDescription = (key) => (mixed[key]?.isMixed ? `${mixedId}-${key}` : undefined)
  const mixedNotice = (key, label) =>
    locked && mixed[key]?.isMixed ? (
      <span id={`${mixedId}-${key}`} className="text-[11px] text-text-muted">
        Multiple values
      </span>
    ) : (
      <MixedValueNotice
        id={`${mixedId}-${key}`}
        isMixed={mixed[key]?.isMixed}
        label={label}
        onApply={() => onUpdate({ [key]: visualValue(key) })}
      />
    )
  const locked = element.locked === true
  return (
    <fieldset disabled={locked} className="mb-2.5 min-w-0">
      <div className="text-[11px] text-text-muted mb-1">Image source URL</div>
      <FocusedAuthoringTextInput
        key={`${element.id}-source`}
        data-testid="prop-image-source-url"
        aria-label="Image source URL"
        disabled={locked}
        data-mixed={mixed.src?.isMixed ? 'true' : undefined}
        aria-describedby={mixedDescription('src')}
        value={mixed.src?.isMixed ? '' : visualValue('src')}
        placeholder={mixed.src?.isMixed ? 'Multiple values' : 'https://… or /uploads/…'}
        className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs mb-2"
        onChange={(event) => onUpdate({ src: event.target.value })}
      />
      {mixedNotice('src', 'image source URL')}
      <div className="grid grid-cols-2 gap-2 mb-2.5">
        {[
          ['flipH', 'horizontal'],
          ['flipV', 'vertical'],
        ].map(([key, direction]) => (
          <div key={key}>
            <label className="flex items-center gap-1.5 text-xs text-text-secondary">
              <input
                type="checkbox"
                data-testid={`prop-image-flip-${direction}`}
                aria-label={`Image ${direction} flip`}
                disabled={locked}
                aria-describedby={mixedDescription(key)}
                data-mixed={mixed[key]?.isMixed ? 'true' : undefined}
                checked={visualValue(key)}
                ref={(control) => {
                  if (control) control.indeterminate = mixed[key]?.isMixed === true
                }}
                onChange={(event) => onUpdate({ [key]: event.target.checked })}
              />
              {direction === 'horizontal' ? 'Horizontal flip' : 'Vertical flip'}
            </label>
            {mixedNotice(key, `image ${direction} flip`)}
          </div>
        ))}
      </div>
      <div className="text-[11px] text-text-muted mb-1">Object Fit</div>
      <Select
        data-testid="prop-image-object-fit"
        aria-label="Image object fit"
        disabled={locked}
        className="w-full bg-card border border-border text-text-primary px-1.5 py-1 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted mb-2.5"
        value={mixed.objectFit?.isMixed ? '' : visualValue('objectFit')}
        aria-describedby={mixedDescription('objectFit')}
        onChange={(e) => onUpdate({ objectFit: e.target.value })}
      >
        {mixed.objectFit?.isMixed && (
          <option value="" disabled>
            Multiple values
          </option>
        )}
        {['contain', 'cover', 'fill', 'none'].map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </Select>
      {mixedNotice('objectFit', 'image object fit')}
      {IMAGE_RANGES.map(([label, key, testId, max, unit]) => (
        <div key={key} className="mb-2.5">
          <div className="text-[11px] text-text-muted mb-0.5">
            {label}: {mixed[key]?.isMixed ? 'Multiple values' : `${visualValue(key)}${unit}`}
          </div>
          <input
            data-testid={`prop-image-${testId}`}
            aria-label={`Image ${key === 'borderRadius' ? 'corner radius' : label.toLowerCase()}`}
            disabled={locked}
            aria-describedby={mixedDescription(key)}
            aria-valuetext={mixed[key]?.isMixed ? 'Multiple values' : undefined}
            data-mixed={mixed[key]?.isMixed ? 'true' : undefined}
            type="range"
            className="w-full accent-accent"
            min="0"
            max={max}
            value={visualValue(key)}
            onChange={(e) => {
              const value = clampNumber(e.target.value, 0, max, null)
              if (value !== null) onUpdate({ [key]: value })
            }}
          />
          {mixedNotice(key, `image ${label.toLowerCase()}`)}
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2 border-t border-border pt-2 mt-1 mb-2.5">
        <div>
          <div className="text-[11px] text-text-muted mb-1">Border Width</div>
          <Input
            data-testid="prop-image-border-width"
            aria-label="Image border width"
            className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent"
            type="number"
            min="0"
            max="20"
            step="0.5"
            value={mixed.borderWidth?.isMixed ? '' : visualValue('borderWidth')}
            placeholder={mixed.borderWidth?.isMixed ? 'Multiple values' : undefined}
            aria-describedby={mixedDescription('borderWidth')}
            onChange={(e) => {
              const value = clampNumber(e.target.value, 0, 20, null)
              if (value === null) return
              onUpdate({ borderWidth: value })
            }}
          />
          {mixedNotice('borderWidth', 'image border width')}
        </div>
        <div>
          <div className="text-[11px] text-text-muted mb-1">Border Color</div>
          <ColorPicker
            data-testid="prop-image-border-color"
            aria-label="Image border color"
            aria-describedby={mixedDescription('borderColor')}
            value={element.borderColor || '#000000'}
            onChange={(e) => onUpdate({ borderColor: e.target.value })}
            className="w-full h-7 border border-border rounded cursor-pointer"
          />
          {mixedNotice('borderColor', 'image border color')}
        </div>
      </div>
      <div className="border-t border-border pt-2 mt-1 mb-2.5">
        <div className="text-[11px] text-text-muted mb-1.5 font-medium">Accessibility</div>
        <label className="flex items-center gap-1.5 mb-2 cursor-pointer">
          <input
            aria-label="Decorative image"
            data-mixed={mixed.decorative?.isMixed ? 'true' : undefined}
            type="checkbox"
            checked={element.decorative === true}
            disabled={locked}
            onChange={(event) =>
              onUpdate({
                decorative: event.target.checked,
                ...(event.target.checked ? { alt: '', longDescription: '' } : {}),
              })
            }
            className="accent-accent"
          />
          <span className="text-xs text-text-secondary">Decorative image</span>
        </label>
        <div className="text-[11px] text-text-muted mb-1">Alternative text</div>
        <Input
          aria-label="Image alternative text"
          data-mixed={mixed.alt?.isMixed ? 'true' : undefined}
          disabled={locked || element.decorative === true}
          className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs mb-2"
          value={mixed.alt?.isMixed ? '' : element.alt || ''}
          placeholder={mixed.alt?.isMixed ? '—' : 'Describe the image'}
          onChange={(event) => onUpdate({ alt: event.target.value })}
        />
        <div className="text-[11px] text-text-muted mb-1">Long description</div>
        <textarea
          aria-label="Image long description"
          data-mixed={mixed.longDescription?.isMixed ? 'true' : undefined}
          disabled={locked || element.decorative === true}
          className="w-full min-h-[56px] bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs resize-y"
          value={mixed.longDescription?.isMixed ? '' : element.longDescription || ''}
          placeholder={mixed.longDescription?.isMixed ? '—' : 'Optional detailed description'}
          onChange={(event) => onUpdate({ longDescription: event.target.value })}
        />
      </div>
      <div className="border-t border-border pt-2 mt-1">
        <div className="text-[11px] text-text-muted mb-1.5 font-medium">Citation</div>
        <div className="text-[11px] text-text-muted mb-1">Citation Text</div>
        <Input
          data-testid="prop-image-citation-text"
          aria-label="Image citation text"
          className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted mb-2"
          type="text"
          value={element.citationText || ''}
          onChange={(e) => onUpdate({ citationText: e.target.value || null })}
          placeholder="Photo credit or source"
        />
        <div className="text-[11px] text-text-muted mb-1">Citation Link</div>
        <Input
          data-testid="prop-image-citation-link"
          aria-label="Image citation link"
          className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted mb-2"
          type="text"
          value={element.citationLink || ''}
          onChange={(e) => onUpdate({ citationLink: e.target.value || null })}
          placeholder="https://..."
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[11px] text-text-muted mb-1">Citation Color</div>
            <ColorPicker
              data-testid="prop-image-citation-color"
              aria-label="Image citation color"
              value={element.citationColor || '#808080'}
              onChange={(e) => onUpdate({ citationColor: e.target.value })}
              className="w-full h-7 border border-border rounded cursor-pointer"
            />
          </div>
          <div>
            <div className="text-[11px] text-text-muted mb-1">Alignment</div>
            <Select
              data-testid="prop-image-citation-align"
              aria-label="Image citation alignment"
              className="w-full bg-card border border-border text-text-primary px-1.5 py-1 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent"
              value={element.citationAlign || 'left'}
              onChange={(e) => onUpdate({ citationAlign: e.target.value })}
            >
              {['left', 'center', 'right'].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>
    </fieldset>
  )
}

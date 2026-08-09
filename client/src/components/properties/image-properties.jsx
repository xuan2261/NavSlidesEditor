import { Select, Input, ColorPicker } from '../../components/ui'
import { clampNumber } from '../../utils/number-input'
/**
 * Image-specific properties: object fit, brightness, contrast, grayscale, round corners.
 */

export default function ImageProperties({ element, onUpdate }) {
  return (
    <div className="mb-2.5">
      <div className="text-[11px] text-text-muted mb-1">Object Fit</div>
      <Select
        data-testid="prop-image-object-fit"
        className="w-full bg-card border border-border text-text-primary px-1.5 py-1 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted mb-2.5"
        value={element.objectFit || 'contain'}
        onChange={(e) => onUpdate({ objectFit: e.target.value })}
      >
        {['contain', 'cover', 'fill', 'none'].map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </Select>
      <div className="mb-1.5">
        <div className="text-[11px] text-text-muted mb-0.5">
          Brightness: {element.filterBrightness ?? 100}%
        </div>
        <input
          data-testid="prop-image-brightness"
          type="range"
          className="w-full accent-accent"
          min="0"
          max="200"
          value={element.filterBrightness ?? 100}
          onChange={(e) => {
            const value = clampNumber(e.target.value, 0, 200, null)
            if (value === null) return
            onUpdate({ filterBrightness: value })
          }}
        />
      </div>
      <div className="mb-1.5">
        <div className="text-[11px] text-text-muted mb-0.5">
          Contrast: {element.filterContrast ?? 100}%
        </div>
        <input
          data-testid="prop-image-contrast"
          type="range"
          className="w-full accent-accent"
          min="0"
          max="200"
          value={element.filterContrast ?? 100}
          onChange={(e) => {
            const value = clampNumber(e.target.value, 0, 200, null)
            if (value === null) return
            onUpdate({ filterContrast: value })
          }}
        />
      </div>
      <div className="mb-2.5">
        <div className="text-[11px] text-text-muted mb-0.5">
          Grayscale: {element.filterGrayscale ?? 0}%
        </div>
        <input
          data-testid="prop-image-grayscale"
          type="range"
          className="w-full accent-accent"
          min="0"
          max="100"
          value={element.filterGrayscale ?? 0}
          onChange={(e) => {
            const value = clampNumber(e.target.value, 0, 100, null)
            if (value === null) return
            onUpdate({ filterGrayscale: value })
          }}
        />
      </div>
      <div className="mb-2.5">
        <div className="text-[11px] text-text-muted mb-0.5">
          Saturation: {element.filterSaturate ?? 100}%
        </div>
        <input
          data-testid="prop-image-saturation"
          type="range"
          className="w-full accent-accent"
          min="0"
          max="200"
          value={element.filterSaturate ?? 100}
          onChange={(e) => {
            const value = clampNumber(e.target.value, 0, 200, null)
            if (value === null) return
            onUpdate({ filterSaturate: value })
          }}
        />
      </div>
      <div className="mb-2.5">
        <div className="text-[11px] text-text-muted mb-0.5">
          Round Corners: {element.borderRadius || 0}px
        </div>
        <input
          data-testid="prop-image-border-radius"
          type="range"
          className="w-full accent-accent"
          min="0"
          max="100"
          value={element.borderRadius || 0}
          onChange={(e) => {
            const value = clampNumber(e.target.value, 0, 100, null)
            if (value === null) return
            onUpdate({ borderRadius: value })
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-border pt-2 mt-1 mb-2.5">
        <div>
          <div className="text-[11px] text-text-muted mb-1">Border Width</div>
          <Input
            data-testid="prop-image-border-width"
            className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent"
            type="number"
            min="0"
            max="20"
            step="0.5"
            value={element.borderWidth ?? 0}
            onChange={(e) => {
              const value = clampNumber(e.target.value, 0, 20, null)
              if (value === null) return
              onUpdate({ borderWidth: value })
            }}
          />
        </div>
        <div>
          <div className="text-[11px] text-text-muted mb-1">Border Color</div>
          <ColorPicker
            data-testid="prop-image-border-color"
            value={element.borderColor || '#000000'}
            onChange={(e) => onUpdate({ borderColor: e.target.value })}
            className="w-full h-7 border border-border rounded cursor-pointer"
          />
        </div>
      </div>
      <div className="border-t border-border pt-2 mt-1">
        <div className="text-[11px] text-text-muted mb-1.5 font-medium">Citation</div>
        <div className="text-[11px] text-text-muted mb-1">Citation Text</div>
        <Input
          data-testid="prop-image-citation-text"
          className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted mb-2"
          type="text"
          value={element.citationText || ''}
          onChange={(e) => onUpdate({ citationText: e.target.value || null })}
          placeholder="Photo credit or source"
        />
        <div className="text-[11px] text-text-muted mb-1">Citation Link</div>
        <Input
          data-testid="prop-image-citation-link"
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
              value={element.citationColor || '#808080'}
              onChange={(e) => onUpdate({ citationColor: e.target.value })}
              className="w-full h-7 border border-border rounded cursor-pointer"
            />
          </div>
          <div>
            <div className="text-[11px] text-text-muted mb-1">Alignment</div>
            <Select
              data-testid="prop-image-citation-align"
              className="w-full bg-card border border-border text-text-primary px-1.5 py-1 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent"
              value={element.citationAlign || 'left'}
              onChange={(e) => onUpdate({ citationAlign: e.target.value })}
            >
              {['left', 'center', 'right'].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </Select>
          </div>
        </div>
      </div>
    </div>
  )
}

import { Input, Select, Button, ColorPicker } from '../../components/ui'
import { clampNumber, parseFiniteNumber } from '../../utils/number-input'
import { normalizeRotation } from '../../utils/element-update-fanout'
import { computeMixedValues } from '../../utils/selection-mixed-values'
import { ArrowDown, ArrowUp, Lock, Unlock } from 'lucide-react'
import { FRAGMENT_ANIMATION_TYPES } from '../../constants/fragment-animation-types'

/**
 * Common element controls shared across all element types:
 * Position (X/Y/W/H/Rotation), Lock, Fragment animation, Drop Shadow, Layer buttons, Delete.
 */

export default function CommonElementControls({
  element,
  onUpdate,
  onBringForward,
  onSendBackward,
  onDelete,
  elements,
  selectedElementIds,
}) {
  const updateFinite = (key, value, min = null, max = null) => {
    const next = clampNumber(value, min, max, null)
    if (next === null) return
    onUpdate({ [key]: next })
  }

  const mixed = computeMixedValues(elements || [], selectedElementIds || [], [
    'x',
    'y',
    'width',
    'height',
    'rotation',
    'opacity',
  ])
  // Blank a numeric field + show "—" when the selection diverges on that key;
  // editing still writes (the apply path fans the value to all selected).
  const numProps = (key, fallback) =>
    mixed[key]?.isMixed
      ? { value: '', placeholder: '—' }
      : { value: fallback }

  return (
    <>
      {/* Position */}
      <div className="grid grid-cols-3 gap-2 mb-2.5">
        <div className="flex flex-col gap-1">
          <div className="text-[11px] text-text-muted">X</div>
          <Input
            data-testid="prop-x"
            className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
            type="number"
            {...numProps('x', Math.round(element.x))}
            onChange={(e) => updateFinite('x', e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-[11px] text-text-muted">Y</div>
          <Input
            data-testid="prop-y"
            className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
            type="number"
            {...numProps('y', Math.round(element.y))}
            onChange={(e) => updateFinite('y', e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-[11px] text-text-muted">Rot</div>
          <Input
            data-testid="prop-rotation"
            className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
            type="number"
            step="1"
            {...numProps('rotation', Math.round(element.rotation || 0))}
            onChange={(e) => {
              const value = parseFiniteNumber(e.target.value, null)
              if (value === null) return
              onUpdate({ rotation: normalizeRotation(value) })
            }}
            title="Rotation angle in degrees"
          />
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-[11px] text-text-muted">W</div>
          <Input
            data-testid="prop-width"
            className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
            type="number"
            {...numProps('width', Math.round(element.width))}
            onChange={(e) => updateFinite('width', e.target.value, 1)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-[11px] text-text-muted">H</div>
          <Input
            data-testid="prop-height"
            className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
            type="number"
            {...numProps('height', Math.round(element.height))}
            onChange={(e) => updateFinite('height', e.target.value, 1)}
          />
        </div>
      </div>

      {/* Opacity (generic) — shape/line already expose it in ShapeProperties */}
      {element.type !== 'shape' && element.type !== 'line' && (
        <div className="mb-2.5">
          <div className="text-[11px] text-text-muted mb-1">
            Opacity:{' '}
            {mixed.opacity?.isMixed
              ? 'Multiple values'
              : `${Math.round((element.opacity ?? 1) * 100)}%`}
          </div>
          <input
            data-testid="prop-opacity"
            data-mixed={mixed.opacity?.isMixed ? 'true' : undefined}
            type="range"
            className="w-full accent-accent"
            min="0"
            max="100"
            // Mixed selection: mid thumb + aria so we do not claim a single authoritative %
            value={mixed.opacity?.isMixed ? 50 : Math.round((element.opacity ?? 1) * 100)}
            aria-valuetext={mixed.opacity?.isMixed ? 'mixed' : undefined}
            onChange={(e) => {
              const value = clampNumber(e.target.value, 0, 100, null)
              if (value === null) return
              onUpdate({ opacity: value / 100 })
            }}
          />
        </div>
      )}

      {/* Lock */}
      <label className="flex items-center gap-1.5 cursor-pointer mb-2 select-none">
        <input
          data-testid="prop-lock-toggle"
          type="checkbox"
          checked={element.locked || false}
          onChange={(e) => onUpdate({ locked: e.target.checked })}
          className="accent-accent"
        />
        <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
          {element.locked ? (
            <Lock size={13} aria-hidden="true" />
          ) : (
            <Unlock size={13} aria-hidden="true" />
          )}
          Lock element
        </span>
      </label>

      {/* Fragment animation */}
      <div className="mb-2.5">
        <label className="flex items-center gap-1.5 mb-1.5 cursor-pointer">
          <input
            data-testid="prop-fragment-toggle"
            type="checkbox"
            checked={element.fragment || false}
            onChange={(e) =>
              onUpdate({
                fragment: e.target.checked,
                fragmentIndex: element.fragmentIndex ?? 1,
              })
            }
            className="accent-accent cursor-pointer"
          />
          <span className="text-xs text-text-secondary">Fragment (animate in)</span>
        </label>
        {element.fragment && (
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <div className="text-[11px] text-text-muted">Order</div>
              <Input
                data-testid="prop-fragment-index"
                className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
                type="number"
                min="1"
                max="20"
                value={element.fragmentIndex ?? 1}
                onChange={(e) => updateFinite('fragmentIndex', e.target.value, 1, 20)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-[11px] text-text-muted">Animation</div>
              <Select
                data-testid="prop-fragment-animation"
                className="w-full bg-card border border-border text-text-primary px-1.5 py-1 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
                value={element.fragmentAnimation || 'fade-in'}
                onChange={(e) => onUpdate({ fragmentAnimation: e.target.value })}
              >
                {FRAGMENT_ANIMATION_TYPES.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Drop Shadow */}
      {element.type !== 'html' && element.type !== 'code' && (
        <div className="mb-2.5">
          <div className="text-[11px] text-text-muted mb-1">Drop Shadow</div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-2 items-start mt-2">
            <div className="flex flex-col gap-1">
              <div className="text-[10px] text-text-muted">X</div>
              <Input
                data-testid="prop-shadow-x"
                className="w-full bg-card border border-border text-text-primary px-2 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
                type="number"
                value={element.shadowX ?? 0}
                onChange={(e) => updateFinite('shadowX', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-[10px] text-text-muted">Y</div>
              <Input
                data-testid="prop-shadow-y"
                className="w-full bg-card border border-border text-text-primary px-2 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
                type="number"
                value={element.shadowY ?? 0}
                onChange={(e) => updateFinite('shadowY', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-[10px] text-text-muted">Blur</div>
              <Input
                data-testid="prop-shadow-blur"
                className="w-full bg-card border border-border text-text-primary px-2 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
                type="number"
                min="0"
                value={element.shadowBlur ?? 0}
                onChange={(e) => updateFinite('shadowBlur', e.target.value, 0)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-[10px] text-text-muted">Color</div>
              <ColorPicker
                data-testid="prop-shadow-color"
                className="w-full h-8 border border-border rounded cursor-pointer shrink-0"
                value={element.shadowColor || '#000000'}
                onChange={(e) => onUpdate({ shadowColor: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}

      {/* Layer buttons */}
      <div className="flex gap-1.5 mb-2.5">
        <Button
          data-testid="prop-layer-forward"
          variant="secondary"
          className="flex-1 text-[11px] py-1 justify-center"
          onClick={onBringForward}
        >
          <ArrowUp size={13} aria-hidden="true" />
          Forward
        </Button>
        <Button
          data-testid="prop-layer-backward"
          variant="secondary"
          className="flex-1 text-[11px] py-1 justify-center"
          onClick={onSendBackward}
        >
          <ArrowDown size={13} aria-hidden="true" />
          Backward
        </Button>
      </div>

      {/* Delete */}
      <Button
        data-testid="prop-delete"
        variant="danger"
        className="w-full justify-center text-xs"
        onClick={onDelete}
      >
        Delete Element
      </Button>
    </>
  )
}

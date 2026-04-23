import { Input, Select, Button, ColorPicker } from '../../components/ui'

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
}) {
  return (
    <>
      {/* Position */}
      <div className="grid grid-cols-3 gap-2 mb-2.5">
        <div className="flex flex-col gap-1">
          <div className="text-[11px] text-text-muted">X</div>
          <Input
            className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
            type="number"
            value={Math.round(element.x)}
            onChange={(e) => onUpdate({ x: Number(e.target.value) })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-[11px] text-text-muted">Y</div>
          <Input
            className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
            type="number"
            value={Math.round(element.y)}
            onChange={(e) => onUpdate({ y: Number(e.target.value) })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-[11px] text-text-muted">Rot</div>
          <Input
            className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
            type="number"
            step="1"
            value={Math.round(element.rotation || 0)}
            onChange={(e) => onUpdate({ rotation: Number(e.target.value) % 360 })}
            title="Rotation angle in degrees"
          />
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-[11px] text-text-muted">W</div>
          <Input
            className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
            type="number"
            value={Math.round(element.width)}
            onChange={(e) => onUpdate({ width: Number(e.target.value) })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-[11px] text-text-muted">H</div>
          <Input
            className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
            type="number"
            value={Math.round(element.height)}
            onChange={(e) => onUpdate({ height: Number(e.target.value) })}
          />
        </div>
      </div>

      {/* Lock */}
      <label className="flex items-center gap-1.5 cursor-pointer mb-2 select-none">
        <input
          type="checkbox"
          checked={element.locked || false}
          onChange={(e) => onUpdate({ locked: e.target.checked })}
          className="accent-accent"
        />
        <span className="text-xs text-text-secondary">
          {element.locked ? '🔒' : '🔓'} Lock element
        </span>
      </label>

      {/* Fragment animation */}
      <div className="mb-2.5">
        <label className="flex items-center gap-1.5 mb-1.5 cursor-pointer">
          <input
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
                className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
                type="number"
                min="1"
                max="20"
                value={element.fragmentIndex ?? 1}
                onChange={(e) => onUpdate({ fragmentIndex: Number(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-[11px] text-text-muted">Animation</div>
              <Select
                className="w-full bg-card border border-border text-text-primary px-1.5 py-1 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
                value={element.fragmentAnimation || 'fade-in'}
                onChange={(e) => onUpdate({ fragmentAnimation: e.target.value })}
              >
                <option value="fade-in">Fade In</option>
                <option value="fade-out">Fade Out</option>
                <option value="fade-up">Fade Up</option>
                <option value="fade-down">Fade Down</option>
                <option value="fade-left">Fade Left</option>
                <option value="fade-right">Fade Right</option>
                <option value="grow">Grow</option>
                <option value="shrink">Shrink</option>
                <option value="zoom-in">Zoom In</option>
                <option value="highlight-red">Highlight Red</option>
                <option value="highlight-green">Highlight Green</option>
                <option value="highlight-blue">Highlight Blue</option>
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
                className="w-full bg-card border border-border text-text-primary px-2 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
                type="number"
                value={element.shadowX ?? 0}
                onChange={(e) => onUpdate({ shadowX: Number(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-[10px] text-text-muted">Y</div>
              <Input
                className="w-full bg-card border border-border text-text-primary px-2 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
                type="number"
                value={element.shadowY ?? 0}
                onChange={(e) => onUpdate({ shadowY: Number(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-[10px] text-text-muted">Blur</div>
              <Input
                className="w-full bg-card border border-border text-text-primary px-2 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
                type="number"
                min="0"
                value={element.shadowBlur ?? 0}
                onChange={(e) => onUpdate({ shadowBlur: Number(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-[10px] text-text-muted">Color</div>
              <ColorPicker
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
          variant="secondary"
          className="flex-1 text-[11px] py-1 justify-center"
          onClick={onBringForward}
        >
          ↑ Forward
        </Button>
        <Button
          variant="secondary"
          className="flex-1 text-[11px] py-1 justify-center"
          onClick={onSendBackward}
        >
          ↓ Backward
        </Button>
      </div>

      {/* Delete */}
      <Button variant="danger" className="w-full justify-center text-xs" onClick={onDelete}>
        Delete Element
      </Button>
    </>
  )
}

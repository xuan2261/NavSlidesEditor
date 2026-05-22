import { useRef, useState } from 'react'
import {
  Wand2, Play, ChevronDown, ToggleLeft, ToggleRight,
} from 'lucide-react'
import RibbonSection from './ribbon-section'
import RibbonTabContentRow from './ribbon-tab-content-row'
import { Button } from '../ui'
import { FRAGMENT_ANIMATION_TYPES } from '../../constants/fragment-animation-types'
import RibbonFloatingOverlay from './ribbon-floating-overlay'

const ANIMATION_TYPES = FRAGMENT_ANIMATION_TYPES

function AnimationPicker({ open, anchorRef, current, onSelect, onClose }) {
  return (
    <RibbonFloatingOverlay
      open={open}
      anchorRef={anchorRef}
      onClose={onClose}
      dataRibbonPopup="animation-picker"
      className="bg-card border border-border rounded-lg p-2 shadow-xl w-[160px]"
    >
      <div className="text-[10px] font-semibold text-text-primary mb-1.5">Animation</div>
      <div className="flex flex-col gap-0.5 max-h-[200px] overflow-y-auto">
        {ANIMATION_TYPES.map(({ value, label }) => (
          <button
            key={value}
            className={`px-2 py-1 rounded text-[11px] text-left cursor-pointer transition-colors
              ${current === value ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary text-text-primary'}`}
            onMouseDown={(e) => { e.preventDefault(); onSelect(value); onClose() }}
          >
            {label}
          </button>
        ))}
      </div>
    </RibbonFloatingOverlay>
  )
}

const clampFragmentIndex = (value) => Math.min(20, Math.max(1, parseInt(value, 10) || 1))

export default function AnimationsTabContent({ selectedElement, slideElements = [], onUpdateElement }) {
  const [showPicker, setShowPicker] = useState(false)
  const animationTriggerRef = useRef(null)

  const hasAnimation = selectedElement?.fragment || false
  const currentAnimation = selectedElement?.fragmentAnimation || 'fade-in'
  const fragmentIndex = selectedElement?.fragmentIndex ?? 1
  const hasDuplicateOrder = !!selectedElement && slideElements.some(
    (element) =>
      element.id !== selectedElement.id &&
      element.fragment &&
      (element.fragmentIndex ?? 1) === fragmentIndex
  )

  const currentLabel = ANIMATION_TYPES.find((a) => a.value === currentAnimation)?.label || currentAnimation

  return (
    <RibbonTabContentRow>
      <RibbonSection label="Animation" className="border-r border-border">
        <div className="flex items-center gap-1">
          <Button variant="ribbon"
            className={`h-7 ${hasAnimation ? 'bg-primary-light text-accent' : ''}`}
            title={hasAnimation ? 'Remove animation' : 'Add animation'}
            aria-label="Toggle animation"
            aria-pressed={hasAnimation}
            onMouseDown={(e) => {
              e.preventDefault()
              if (!selectedElement) return
              onUpdateElement?.({ fragment: !hasAnimation, fragmentAnimation: currentAnimation, fragmentIndex })
            }}>
            {hasAnimation ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
            <span className="text-[11px] hidden lg:inline">{hasAnimation ? 'On' : 'Off'}</span>
          </Button>
          {hasAnimation && (
            <div className="relative">
              <Button variant="ribbon" className="h-7"
                ref={animationTriggerRef}
                title="Animation type" aria-label="Change animation type"
                onMouseDown={(e) => { e.preventDefault(); setShowPicker((v) => !v) }}>
                <Wand2 size={14} />
                <span className="text-[11px] hidden lg:inline">{currentLabel}</span>
                <ChevronDown size={10} />
              </Button>
              {showPicker && (
                <AnimationPicker
                  open={showPicker}
                  anchorRef={animationTriggerRef}
                  current={currentAnimation}
                  onSelect={(a) => onUpdateElement?.({ fragmentAnimation: a })}
                  onClose={() => setShowPicker(false)}
                />
              )}
            </div>
          )}
        </div>
      </RibbonSection>

      <RibbonSection label="Order" className="border-r border-border">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-text-muted">Step</span>
          <input
            type="number"
            className="w-10 rounded border border-border bg-secondary px-1 py-0.5 text-[11px] text-text-primary text-center focus:border-accent focus:outline-none disabled:opacity-50"
            value={fragmentIndex}
            onChange={(e) => onUpdateElement?.({ fragmentIndex: clampFragmentIndex(e.target.value) })}
            min={1}
            max={20}
            disabled={!selectedElement}
            aria-label="Animation order"
          />
          {hasDuplicateOrder && (
            <span className="text-[10px] text-warning" role="status">Duplicate order</span>
          )}
        </div>
      </RibbonSection>

      <RibbonSection label="Preview">
        <Button variant="ribbon" className="h-7"
          title="Preview animation" aria-label="Preview animation"
          onMouseDown={(e) => { e.preventDefault() }}>
          <Play size={14} />
          <span className="text-[11px] hidden lg:inline">Preview</span>
        </Button>
      </RibbonSection>
    </RibbonTabContentRow>
  )
}

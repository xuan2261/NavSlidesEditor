import { useState } from 'react'
import {
  Zap, Timer, Play, ChevronDown, RotateCcw,
} from 'lucide-react'
import RibbonSection from './ribbon-section'
import { Button } from '../ui'

const TRANSITIONS = ['none', 'fade', 'slide', 'convex', 'concave', 'zoom']

const SPEEDS = [
  { value: 'default', label: 'Default' },
  { value: 'fast', label: 'Fast' },
  { value: 'slow', label: 'Slow' },
]

const DIRECTIONS = ['default', 'left', 'right', 'up', 'down']

const clampDuration = (value) => Math.min(10000, Math.max(0, parseInt(value, 10) || 0))

function TransitionPicker({ current, onSelect }) {
  return (
    <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg p-2 shadow-xl z-[1000] w-[160px]"
      onMouseDown={(e) => e.stopPropagation()}>
      <div className="text-[10px] font-semibold text-text-primary mb-1.5">Transition</div>
      <div className="flex flex-col gap-0.5">
        {TRANSITIONS.map((t) => (
          <button
            key={t}
            className={`px-2 py-1 rounded text-[11px] capitalize text-left cursor-pointer transition-colors
              ${current === t ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary text-text-primary'}`}
            onMouseDown={(e) => { e.preventDefault(); onSelect(t) }}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function TransitionsTabContent({
  presentation,
  slide,
  onUpdatePresentation,
  onUpdateSlide,
}) {
  const [showPicker, setShowPicker] = useState(false)

  const hasSlideOverride = slide?.transition != null
  const currentTransition = slide?.transition || presentation?.transition || 'slide'
  const currentDirection = slide?.transitionDirection || 'default'
  const currentDuration = slide?.transitionDuration ?? ''
  const currentSpeed = presentation?.transitionSpeed || 'default'
  const autoSlide = presentation?.autoSlide || 0
  const updateTransition = (transition) => {
    if (onUpdateSlide && slide) onUpdateSlide({ transition })
    else onUpdatePresentation?.({ transition })
  }
  const clearSlideOverride = () => {
    onUpdateSlide?.({
      transition: undefined,
      transitionDirection: undefined,
      transitionDuration: undefined,
    })
  }

  return (
    <div className="flex items-stretch gap-0 h-full overflow-x-auto">
      <RibbonSection label="Transition" className="border-r border-border">
        <div className="relative">
          <Button variant="ribbon" className="h-7"
            title="Slide transition" aria-label="Change transition"
            onMouseDown={(e) => { e.preventDefault(); setShowPicker((v) => !v) }}>
            <Zap size={14} />
            <span className="text-[11px] capitalize hidden lg:inline">{currentTransition}</span>
            <ChevronDown size={10} />
          </Button>
          {showPicker && (
            <TransitionPicker
              current={currentTransition}
              onSelect={(t) => { updateTransition(t); setShowPicker(false) }}
            />
          )}
        </div>
        {slide && onUpdateSlide && (
          <Button variant="icon"
            className={`h-7 w-7 ${hasSlideOverride ? 'bg-primary-light text-accent' : ''}`}
            title="Use presentation default" aria-label="Use presentation transition default"
            onMouseDown={(e) => {
              e.preventDefault()
              clearSlideOverride()
            }}>
            <RotateCcw size={14} />
          </Button>
        )}
      </RibbonSection>

      {slide && onUpdateSlide && (
        <RibbonSection label="Slide" className="border-r border-border">
          <div className="flex items-center gap-1">
            <select
              className="h-7 rounded border border-border bg-secondary px-1 text-[11px] text-text-primary outline-none focus:border-accent"
              value={currentDirection}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => onUpdateSlide({ transitionDirection: e.target.value })}
              aria-label="Slide transition direction"
            >
              {DIRECTIONS.map((direction) => (
                <option key={direction} value={direction}>{direction}</option>
              ))}
            </select>
            <input
              type="number"
              className="w-14 rounded border border-border bg-secondary px-1 py-0.5 text-[11px] text-text-primary text-center focus:border-accent focus:outline-none"
              value={currentDuration}
              min={0}
              max={10000}
              placeholder="ms"
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => onUpdateSlide({ transitionDuration: clampDuration(e.target.value) })}
              aria-label="Slide transition duration milliseconds"
            />
          </div>
        </RibbonSection>
      )}

      <RibbonSection label="Speed" className="border-r border-border">
        <div className="flex items-center gap-0.5">
          {SPEEDS.map(({ value, label }) => (
            <Button key={value} variant="ribbon"
              className={`h-7 px-2 text-[11px] ${currentSpeed === value ? 'bg-primary-light text-accent' : ''}`}
              title={`Transition speed: ${label}`} aria-label={`Set speed ${label}`}
              onMouseDown={(e) => {
                e.preventDefault()
                onUpdatePresentation?.({ transitionSpeed: value })
              }}>
              {label}
            </Button>
          ))}
        </div>
      </RibbonSection>

      <RibbonSection label="Auto-Advance" className="border-r border-border">
        <div className="flex items-center gap-1">
          <Button variant="ribbon"
            className={`h-7 ${autoSlide ? 'bg-primary-light text-accent' : ''}`}
            title="Auto-advance slides" aria-label="Toggle auto-advance" aria-pressed={!!autoSlide}
            onMouseDown={(e) => {
              e.preventDefault()
              onUpdatePresentation?.({ autoSlide: autoSlide ? 0 : 5000 })
            }}>
            <Timer size={14} />
            <span className="text-[11px] hidden lg:inline">{autoSlide ? 'On' : 'Off'}</span>
          </Button>
          {autoSlide > 0 && (
            <div className="flex items-center gap-1">
              <input
                type="number"
                className="w-12 rounded border border-border bg-secondary px-1 py-0.5 text-[11px] text-text-primary text-center focus:border-accent focus:outline-none"
                value={Math.round(autoSlide / 1000)}
                onChange={(e) =>
                  onUpdatePresentation?.({ autoSlide: Math.max(1, parseInt(e.target.value) || 5) * 1000 })
                }
                min={1}
                max={120}
                aria-label="Auto-advance interval seconds"
              />
              <span className="text-[10px] text-text-muted">sec</span>
            </div>
          )}
        </div>
      </RibbonSection>

      <RibbonSection label="Preview">
        <Button variant="ribbon" className="h-7"
          title="Preview transition" aria-label="Preview transition"
          onMouseDown={(e) => { e.preventDefault() }}>
          <Play size={14} />
          <span className="text-[11px] hidden lg:inline">Preview</span>
        </Button>
      </RibbonSection>
    </div>
  )
}

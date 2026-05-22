import { useState } from 'react'
import {
  Palette, MonitorSmartphone, PanelBottom, Hash, Navigation, Upload, Grid3X3,
  Layout, Monitor, Square, MonitorPlay, MonitorSpeaker,
} from 'lucide-react'
import * as shared from 'revealjs-shared'
import RibbonSection from './ribbon-section'
import { Button } from '../ui'

const { BG_COLORS = [], GRADIENT_PRESETS = [] } = shared

const THEMES = [
  'black', 'white', 'league', 'beige', 'night',
  'serif', 'simple', 'solarized', 'blood', 'moon', 'dracula',
]

const SIZE_PRESETS = [
  { label: '16:9', w: 960, h: 540, icon: Monitor },
  { label: '4:3', w: 960, h: 720, icon: Square },
  { label: 'Wide', w: 1280, h: 720, icon: MonitorPlay },
  { label: 'Ultra', w: 1920, h: 1080, icon: MonitorSpeaker },
]

function ThemeGallery({ current, onSelect }) {
  return (
    <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg p-2 shadow-xl z-[1000] w-[220px]"
      onMouseDown={(e) => e.stopPropagation()}>
      <div className="text-[10px] font-semibold text-text-primary mb-1.5">Themes</div>
      <div className="grid grid-cols-3 gap-1">
        {THEMES.map((t) => (
          <button
            key={t}
            className={`px-1.5 py-1 rounded text-[10px] capitalize cursor-pointer transition-colors
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

function BackgroundControls({ slide, onUpdateSlide }) {
  const bg = slide?.background || { type: 'color', color: '#1e1e2e' }
  const bgType = bg.type || 'color'

  const setBgType = (type) => onUpdateSlide({ background: { ...bg, type } })
  const setBgColor = (color) => onUpdateSlide({ background: { ...bg, type: 'color', color } })
  const setBgGradient = (gradient) => onUpdateSlide({ background: { ...bg, type: 'gradient', gradient } })
  const setBgImage = (image) => onUpdateSlide({ background: { ...bg, type: 'image', image } })

  const uploadBgImage = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const image = event.target?.result
      if (typeof image === 'string') setBgImage(image)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg p-2 shadow-xl z-[1000] w-[200px]"
      onMouseDown={(e) => e.stopPropagation()}>
      <div className="text-[10px] font-semibold text-text-primary mb-1.5">Slide Background</div>
      <div className="flex gap-1 mb-2">
        {['color', 'gradient', 'image', 'none'].map((type) => (
          <button
            key={type}
            className={`px-1.5 py-0.5 rounded text-[10px] capitalize cursor-pointer transition-colors
              ${bgType === type ? 'bg-primary text-primary-foreground' : 'bg-secondary text-text-primary hover:bg-border'}`}
            onMouseDown={(e) => { e.preventDefault(); setBgType(type) }}
          >
            {type}
          </button>
        ))}
      </div>
      {bgType === 'color' && (
        <div className="grid grid-cols-8 gap-1">
          {BG_COLORS.map((color) => (
            <div
              key={color}
              role="button"
              tabIndex={0}
              aria-label={`Background ${color}`}
              className={`w-full aspect-square rounded cursor-pointer focus:outline-none focus:ring-2 focus:ring-focus
                ${bg.color === color ? 'border-2 border-white' : 'border border-border'}`}
              style={{ backgroundColor: color }}
              onMouseDown={(e) => { e.preventDefault(); setBgColor(color) }}
            />
          ))}
        </div>
      )}
      {bgType === 'gradient' && (
        <div className="grid grid-cols-4 gap-1">
          {GRADIENT_PRESETS.slice(0, 12).map((preset, i) => (
            <div
              key={i}
              role="button"
              tabIndex={0}
              aria-label={`Gradient ${i + 1}`}
              className={`w-full aspect-square rounded cursor-pointer focus:outline-none focus:ring-2 focus:ring-focus
                ${bg.gradient === preset ? 'border-2 border-white' : 'border border-border'}`}
              style={{ background: preset }}
              onMouseDown={(e) => { e.preventDefault(); setBgGradient(preset) }}
            />
          ))}
        </div>
      )}
      {bgType === 'none' && (
        <p className="text-[10px] text-text-muted">No background (uses theme default)</p>
      )}
      {bgType === 'image' && (
        <div className="space-y-2">
          {bg.image && (
            <div
              className="h-16 rounded border border-border bg-cover bg-center"
              style={{ backgroundImage: `url(${bg.image})` }}
              aria-label="Current background image preview"
            />
          )}
          <input
            className="w-full rounded border border-border bg-card px-2 py-1 text-[11px] text-text-primary outline-none focus:border-accent"
            value={bg.image || ''}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => setBgImage(e.target.value)}
            placeholder="Image URL or data URL"
            aria-label="Background image URL"
          />
          <label className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-[11px] text-text-secondary hover:bg-hover hover:text-text-primary">
            <Upload size={12} />
            Upload
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => uploadBgImage(e.target.files?.[0])}
            />
          </label>
        </div>
      )}
    </div>
  )
}

export default function DesignTabContent({
  presentation,
  slide,
  onUpdateSlide,
  onUpdatePresentation,
}) {
  const [showThemes, setShowThemes] = useState(false)
  const [showBg, setShowBg] = useState(false)

  const currentTheme = presentation?.theme || 'black'
  const presenterTools = presentation?.presenterTools || {}
  const updatePresenterTool = (key, value) => {
    onUpdatePresentation?.({ presenterTools: { ...presenterTools, [key]: value } })
  }

  return (
    <div className="flex items-stretch gap-0 h-full overflow-x-auto">
      <RibbonSection label="Themes" className="border-r border-border">
        <div className="relative">
          <Button variant="ribbon" className="h-7"
            title="Presentation theme" aria-label="Change theme"
            onMouseDown={(e) => { e.preventDefault(); setShowThemes((v) => !v) }}>
            <Palette size={14} />
            <span className="text-[11px] capitalize hidden lg:inline">{currentTheme}</span>
          </Button>
          {showThemes && (
            <ThemeGallery
              current={currentTheme}
              onSelect={(t) => { onUpdatePresentation?.({ theme: t }); setShowThemes(false) }}
            />
          )}
        </div>
      </RibbonSection>

      <RibbonSection label="Background" className="border-r border-border">
        <div className="relative">
          <Button variant="ribbon" className="h-7"
            title="Slide background" aria-label="Change slide background"
            onMouseDown={(e) => { e.preventDefault(); setShowBg((v) => !v) }}>
            <div
              className="w-3.5 h-3.5 rounded-sm shrink-0 border border-border"
              style={
                slide?.background?.type === 'image' && slide.background.image
                  ? {
                      backgroundImage: `url(${slide.background.image})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }
                  : slide?.background?.type === 'gradient'
                  ? { background: slide.background.gradient }
                  : { backgroundColor: slide?.background?.color || '#1e1e2e' }
              }
            />
            <span className="text-[11px] hidden lg:inline">Background</span>
          </Button>
          {showBg && slide && onUpdateSlide && (
            <BackgroundControls slide={slide} onUpdateSlide={onUpdateSlide} />
          )}
        </div>
      </RibbonSection>

      <RibbonSection label="Slide Size" className="border-r border-border">
        <div className="flex items-center gap-0.5">
          {SIZE_PRESETS.map((preset) => (
            <Button key={preset.label} variant="ribbon" className="h-7 px-1.5 text-[10px]"
              title={`${preset.w}×${preset.h}`} aria-label={`Set size ${preset.label}`}
              onMouseDown={(e) => {
                e.preventDefault()
                onUpdatePresentation?.({ resolution: { width: preset.w, height: preset.h } })
              }}>
              <preset.icon size={12} />
              <span className="hidden xl:inline">{preset.label}</span>
            </Button>
          ))}
        </div>
      </RibbonSection>

      <RibbonSection label="Footer" className="border-r border-border">
        <div className="flex items-center gap-1">
          <Button variant="ribbon" className="h-7"
            title="Show footer" aria-label="Toggle footer"
            onMouseDown={(e) => {
              e.preventDefault()
              onUpdatePresentation?.({ showFooter: !presentation?.showFooter })
            }}>
            <PanelBottom size={14} />
            <span className="text-[11px] hidden lg:inline">
              {presentation?.showFooter ? 'Footer On' : 'Footer Off'}
            </span>
          </Button>
          <Button variant="ribbon" className="h-7"
            title="Show page numbers" aria-label="Toggle page numbers"
            onMouseDown={(e) => {
              e.preventDefault()
              onUpdatePresentation?.({ showPageNumbers: !presentation?.showPageNumbers })
            }}>
            <Hash size={14} />
            <span className="text-[11px] hidden lg:inline">
              {presentation?.showPageNumbers ? 'Numbers On' : 'Numbers Off'}
            </span>
          </Button>
          <select
            className="h-7 rounded border border-border bg-secondary px-1 text-[11px] text-text-primary outline-none focus:border-accent"
            value={presentation?.pageNumberFormat || 'c/t'}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => onUpdatePresentation?.({ pageNumberFormat: e.target.value })}
            aria-label="Page number format"
          >
            <option value="c/t">1 / 10</option>
            <option value="n">1</option>
          </select>
        </div>
      </RibbonSection>

      <RibbonSection label="Navigation">
        <div className="flex items-center gap-0.5">
          <Button variant="icon"
            className={`h-7 w-7 ${presentation?.autoSlide ? 'bg-primary-light text-accent' : ''}`}
            title="Auto-advance (5s)" aria-label="Toggle auto-advance"
            onMouseDown={(e) => {
              e.preventDefault()
              onUpdatePresentation?.({ autoSlide: presentation?.autoSlide ? 0 : 5000 })
            }}>
            <Navigation size={14} />
          </Button>
          <Button variant="icon"
            className={`h-7 w-7 ${presentation?.autoSlideLoop ? 'bg-primary-light text-accent' : ''}`}
            title="Loop presentation" aria-label="Toggle loop"
            onMouseDown={(e) => {
              e.preventDefault()
              onUpdatePresentation?.({ autoSlideLoop: !presentation?.autoSlideLoop })
            }}>
            <Layout size={14} />
          </Button>
          <Button variant="icon"
            className={`h-7 w-7 ${presentation?.showPresentGrid ? 'bg-primary-light text-accent' : ''}`}
            title="Show presenter grid" aria-label="Toggle presenter grid"
            onMouseDown={(e) => {
              e.preventDefault()
              onUpdatePresentation?.({ showPresentGrid: !presentation?.showPresentGrid })
            }}>
            <Grid3X3 size={14} />
          </Button>
          <Button variant="icon"
            className={`h-7 w-7 ${presentation?.kioskMode ? 'bg-primary-light text-accent' : ''}`}
            title="Kiosk mode" aria-label="Toggle kiosk mode"
            onMouseDown={(e) => {
              e.preventDefault()
              onUpdatePresentation?.({ kioskMode: !presentation?.kioskMode })
            }}>
            <MonitorSmartphone size={14} />
          </Button>
          <Button variant="icon"
            className={`h-7 w-7 ${presenterTools.slideMenu ? 'bg-primary-light text-accent' : ''}`}
            title="Presenter slide menu" aria-label="Toggle presenter slide menu"
            onMouseDown={(e) => {
              e.preventDefault()
              updatePresenterTool('slideMenu', !presenterTools.slideMenu)
            }}>
            <Layout size={14} />
          </Button>
        </div>
      </RibbonSection>
    </div>
  )
}

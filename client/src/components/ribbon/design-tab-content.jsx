import { useRef, useState, useMemo } from 'react'
import {
  Palette, MonitorSmartphone, PanelBottom, Hash, Timer, Upload, Grid3x3,
  Repeat, Menu, Monitor, Square, MonitorPlay, MonitorSpeaker, Layers,
} from 'lucide-react'
import * as shared from 'revealjs-shared'
import RibbonSection from './ribbon-section'
import RibbonTabContentRow from './ribbon-tab-content-row'
import { Button } from '../ui'
import RibbonFloatingOverlay from './ribbon-floating-overlay'

const {
  BG_COLORS = [],
  GRADIENT_PRESETS = [],
  THEME_PRESETS = [],
  getDesignTokensForRevealTheme,
  listFx,
} = shared
const FX_LIST = typeof listFx === 'function' ? listFx() : []

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

function ThemeSwatch({ preset, active, onSelect }) {
  const c = preset.tokens.colors
  return (
    <button
      title={preset.label}
      aria-label={`Apply theme ${preset.label}`}
      className={`flex items-center gap-1.5 rounded px-1.5 py-1 text-left cursor-pointer transition-colors w-full
        ${active ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary text-text-primary'}`}
      onMouseDown={(e) => { e.preventDefault(); onSelect(preset) }}
    >
      <span
        className="flex h-5 w-7 shrink-0 items-center justify-center rounded-sm border border-border/60 text-[9px] font-bold"
        style={{ background: c.bg, color: c.text }}
      >
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c.accent }} />
      </span>
      <span className="truncate text-[10px] leading-tight">{preset.label}</span>
    </button>
  )
}

function ThemeGallery({ open, anchorRef, current, currentTokens, onSelect, onSelectPreset, onApplyToAll, onClose }) {
  const grouped = useMemo(() => {
    const byCat = {}
    for (const p of THEME_PRESETS) {
      ;(byCat[p.category] ||= []).push(p)
    }
    return byCat
  }, [])
  // A preset is "active" when its accent matches the deck's current accent token.
  const activeAccent = currentTokens?.colors?.accent

  return (
    <RibbonFloatingOverlay
      open={open}
      anchorRef={anchorRef}
      onClose={onClose}
      dataRibbonPopup="theme-gallery"
      className="bg-card border border-border rounded-lg p-2 shadow-xl w-[320px] max-h-[460px] overflow-y-auto"
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[10px] font-semibold text-text-primary">Theme Presets</div>
        <button
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-text-secondary hover:bg-secondary hover:text-text-primary cursor-pointer"
          title="Apply the current theme to every slide (clears per-slide overrides)"
          aria-label="Apply theme to all slides"
          onMouseDown={(e) => { e.preventDefault(); onApplyToAll() }}
        >
          <Layers size={11} /> Apply to all
        </button>
      </div>
      {Object.keys(grouped).sort().map((cat) => (
        <div key={cat} className="mb-1.5">
          <div className="text-[9px] uppercase tracking-wide text-text-muted mb-0.5 px-0.5">{cat}</div>
          <div className="grid grid-cols-2 gap-0.5">
            {grouped[cat].map((p) => (
              <ThemeSwatch
                key={p.id}
                preset={p}
                active={activeAccent != null && p.tokens.colors.accent === activeAccent}
                onSelect={onSelectPreset}
              />
            ))}
          </div>
        </div>
      ))}
      <div className="mt-1 border-t border-border pt-1.5">
        <div className="text-[9px] uppercase tracking-wide text-text-muted mb-0.5 px-0.5">Base reveal theme</div>
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
    </RibbonFloatingOverlay>
  )
}

function BackgroundControls({ open, anchorRef, slide, onUpdateSlide, onClose }) {
  const bg = slide?.background || { type: 'color', color: '#1e1e2e' }
  const bgType = bg.type || 'color'

  const setBgType = (type) => onUpdateSlide({ background: { ...bg, type } })
  const setBgColor = (color) => onUpdateSlide({ background: { ...bg, type: 'color', color } })
  const setBgGradient = (gradient) => onUpdateSlide({ background: { ...bg, type: 'gradient', gradient } })
  const setBgImage = (image) => onUpdateSlide({ background: { ...bg, type: 'image', image } })
  const setBgFx = (fxUpdates) =>
    onUpdateSlide({ background: { ...bg, type: 'fx', fx: { name: 'gradient-blob', ...(bg.fx || {}), ...fxUpdates } } })

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
    <RibbonFloatingOverlay
      open={open}
      anchorRef={anchorRef}
      onClose={onClose}
      dataRibbonPopup="background-controls"
      className="bg-card border border-border rounded-lg p-2 shadow-xl w-[200px]"
    >
      <div className="text-[10px] font-semibold text-text-primary mb-1.5">Slide Background</div>
      <div className="flex gap-1 mb-2 flex-wrap">
        {['color', 'gradient', 'image', 'fx', 'none'].map((type) => (
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
      {bgType === 'fx' && (
        <div className="space-y-2">
          <select
            className="w-full rounded border border-border bg-card px-2 py-1 text-[11px] text-text-primary outline-none focus:border-accent"
            value={bg.fx?.name || 'gradient-blob'}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => setBgFx({ name: e.target.value })}
            aria-label="Animated background effect"
          >
            {FX_LIST.map((m) => (
              <option key={m.name} value={m.name}>{m.label}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-[10px] text-text-secondary">
            Print fallback
            <input
              type="color"
              className="h-6 w-8 cursor-pointer rounded border border-border bg-transparent"
              value={bg.fx?.fallbackColor || '#0d0221'}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => setBgFx({ fallbackColor: e.target.value })}
              aria-label="Print fallback color"
            />
          </label>
          <p className="text-[9px] text-text-muted leading-snug">
            Animates in editor, present &amp; live. Honors reduced-motion; prints as the fallback color.
          </p>
        </div>
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
    </RibbonFloatingOverlay>
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
  const themeTriggerRef = useRef(null)
  const bgTriggerRef = useRef(null)

  const currentTheme = presentation?.theme || 'black'
  const presenterTools = presentation?.presenterTools || {}
  const updatePresenterTool = (key, value) => {
    onUpdatePresentation?.({ presenterTools: { ...presenterTools, [key]: value } })
  }

  return (
    <RibbonTabContentRow>
      <RibbonSection label="Themes" className="border-r border-border">
        <div className="relative">
          <Button variant="ribbon" className="h-7"
            ref={themeTriggerRef}
            title="Presentation theme" aria-label="Change theme"
            onMouseDown={(e) => { e.preventDefault(); setShowThemes((v) => !v) }}>
            <Palette size={14} />
            <span className="text-[11px] capitalize hidden lg:inline">{currentTheme}</span>
          </Button>
          {showThemes && (
            <ThemeGallery
              open={showThemes}
              anchorRef={themeTriggerRef}
              current={currentTheme}
              currentTokens={presentation?.designTokens}
              onSelect={(t) => {
                onUpdatePresentation?.({ theme: t, designTokens: getDesignTokensForRevealTheme?.(t) })
                setShowThemes(false)
              }}
              onSelectPreset={(preset) => {
                // Live-switch: set deck tokens + closest reveal theme. Recolors all
                // 'auto' content instantly (new decks + built-in templates).
                onUpdatePresentation?.({ designTokens: preset.tokens, theme: preset.revealTheme })
              }}
              onApplyToAll={() => {
                // One undoable step: set deck tokens (current or default) AND clear
                // every per-slide token override so the whole deck shares one theme.
                onUpdatePresentation?.((prev) => ({
                  ...prev,
                  designTokens: prev?.designTokens || undefined,
                  slides: (prev?.slides || []).map((s) =>
                    s.designTokens ? { ...s, designTokens: undefined } : s
                  ),
                }))
                setShowThemes(false)
              }}
              onClose={() => setShowThemes(false)}
            />
          )}
        </div>
      </RibbonSection>

      <RibbonSection label="Background" className="border-r border-border">
        <div className="relative">
          <Button variant="ribbon" className="h-7"
            ref={bgTriggerRef}
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
            <BackgroundControls
              open={showBg}
              anchorRef={bgTriggerRef}
              slide={slide}
              onUpdateSlide={onUpdateSlide}
              onClose={() => setShowBg(false)}
            />
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
            <Timer size={14} />
          </Button>
          <Button variant="icon"
            className={`h-7 w-7 ${presentation?.autoSlideLoop ? 'bg-primary-light text-accent' : ''}`}
            title="Loop presentation" aria-label="Toggle loop"
            onMouseDown={(e) => {
              e.preventDefault()
              onUpdatePresentation?.({ autoSlideLoop: !presentation?.autoSlideLoop })
            }}>
            <Repeat size={14} />
          </Button>
          <Button variant="icon"
            className={`h-7 w-7 ${presentation?.showPresentGrid ? 'bg-primary-light text-accent' : ''}`}
            title="Show presenter grid" aria-label="Toggle presenter grid"
            onMouseDown={(e) => {
              e.preventDefault()
              onUpdatePresentation?.({ showPresentGrid: !presentation?.showPresentGrid })
            }}>
            <Grid3x3 size={14} />
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
            <Menu size={14} />
          </Button>
        </div>
      </RibbonSection>
    </RibbonTabContentRow>
  )
}

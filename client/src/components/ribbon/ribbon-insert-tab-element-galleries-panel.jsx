import { useState } from 'react'
import {
  Type, Image as ImageIcon, Upload, Shapes, Minus, ArrowUpRight,
  BarChart3, Table2, FileCode, Code, Sigma, QrCode,
  Video, Music, FolderOpen, Monitor,
  Globe, Pencil, Scissors,
  Sparkles, Grid3x3, Clapperboard, Box, Clock,
  Gamepad2, MessageSquare, Smile, Package,
} from 'lucide-react'
import * as shared from 'revealjs-shared'
import RibbonSection from './ribbon-section'
import RibbonDropdownMenuGroup from './ribbon-dropdown-menu-group-trigger'
import { Button } from '../ui'
import { GAME_TYPES } from '../../constants/game-element-types-constants'
import PromptPopover from '../PromptPopover'
import { api } from '../../utils/api'

const { SHAPES = [] } = shared

const SHAPE_GROUPS = {
  Geometric: ['rect', 'rounded-rect', 'circle', 'triangle', 'diamond', 'hexagon', 'pentagon'],
  Directional: ['arrow-right', 'line'],
  Organic: ['cloud', 'star', 'bracket'],
  '3D': ['cylinder', 'parallelogram', 'trapezoid'],
}

function ShapeGallery({ onSelect, onClose }) {
  return (
    <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg p-3 shadow-xl z-[1000] w-[280px]"
      onMouseDown={(e) => e.stopPropagation()}>
      <div className="text-xs font-semibold text-text-primary mb-2">Shapes</div>
      {Object.entries(SHAPE_GROUPS).map(([group, shapes]) => (
        <div key={group} className="mb-2">
          <div className="text-[10px] text-text-muted mb-1">{group}</div>
          <div className="grid grid-cols-7 gap-1">
            {shapes.map((shapeType) => {
              const shape = SHAPES.find((s) => (s.type || s.id) === shapeType)
              const shapeLabel = shape?.label || shape?.name || shapeType
              return (
                <Button
                  key={shapeType}
                  variant="ghost"
                  className="w-8 h-8 p-0 flex items-center justify-center"
                  title={shapeLabel}
                  aria-label={shapeLabel}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onSelect(shapeType)
                    onClose()
                  }}
                  onKeyDown={(e) => handleKeyboardActivation(e, () => {
                    onSelect(shapeType)
                    onClose()
                  })}
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                    {shape?.svgPath ? <path d={shape.svgPath} /> : <rect x="2" y="2" width="20" height="20" />}
                  </svg>
                </Button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

const GAME_LABELS = {
  'name-picker': 'Name Picker',
  'hot-potato': 'Hot Potato',
  'jeopardy': 'Jeopardy',
  'four-corners': 'Four Corners',
  'relay-race': 'Relay Race',
  'trivia-champ': 'Trivia',
  'scattergories': 'Scattergories',
}

const isActivationKey = (event) => event.key === 'Enter' || event.key === ' '

const handleKeyboardActivation = (event, action) => {
  if (!isActivationKey(event)) return
  event.preventDefault()
  action?.()
}

function GameGalleryDropdown({ onSelect, onClose }) {
  return (
    <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg p-2 shadow-xl z-[1000] w-[160px]"
      onMouseDown={(e) => e.stopPropagation()}>
      <div className="text-[10px] font-semibold text-text-primary mb-1.5">Games</div>
      <div className="flex flex-col gap-0.5">
        {GAME_TYPES.all.map((type) => (
          <button
            key={type}
            className="flex items-center gap-2 px-2 py-1 rounded text-[11px] text-left cursor-pointer transition-colors hover:bg-secondary text-text-primary"
            onMouseDown={(e) => {
              e.preventDefault()
              onSelect(type)
              onClose()
            }}
            onKeyDown={(e) => handleKeyboardActivation(e, () => {
              onSelect(type)
              onClose()
            })}
          >
            <Gamepad2 size={12} />
            {GAME_LABELS[type] || type}
          </button>
        ))}
      </div>
    </div>
  )
}

function TableSizePicker({ onSelect, onClose }) {
  const [hoverR, setHoverR] = useState(0)
  const [hoverC, setHoverC] = useState(0)

  return (
    <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg p-2 shadow-xl z-[1000]"
      onMouseDown={(e) => e.stopPropagation()}
      onMouseLeave={() => { setHoverR(0); setHoverC(0); onClose() }}>
      <div className="text-[10px] text-text-muted mb-1">
        {hoverR > 0 ? `${hoverR}×${hoverC}` : '3×3 default'}
      </div>
      <div className="grid grid-cols-8 gap-0.5">
        {Array.from({ length: 6 }, (_, r) =>
          Array.from({ length: 8 }, (_, c) => (
            <div
              key={`${r}-${c}`}
              className={`w-3 h-3 rounded-sm cursor-pointer ${
                r < hoverR && c < hoverC ? 'bg-primary' : 'bg-border'
              }`}
              onMouseEnter={() => { setHoverR(r + 1); setHoverC(c + 1) }}
              onMouseDown={(e) => {
                e.preventDefault()
                onSelect(r + 1, c + 1)
                onClose()
              }}
              onKeyDown={(e) => handleKeyboardActivation(e, () => {
                onSelect(r + 1, c + 1)
                onClose()
              })}
              role="button"
              tabIndex={0}
              aria-label={`Insert ${r + 1} by ${c + 1} table`}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default function InsertTabContent({
  onAddText,
  onAddImage,
  onAddImageUpload,
  onAddShape,
  onAddLine,
  onAddCallout,
  onAddIcon,
  onAddChart,
  onAddTable,
  onAddCode,
  onAddMarkdown,
  onAddLatex,
  onAddQrCode,
  onAddVideo,
  onAddAudio,
  onOpenMediaLibrary,
  onOpenFileBrowser,
  onAddHtml,
  onAddSvg,
  onAddDrawing,
  onAddDivider,
  onAddKineticText,
  onAddMathGrid,
  onAddAnime,
  onAddThree,
  onAddTimeline,
  onAddGame,
}) {
  const [showShapeGallery, setShowShapeGallery] = useState(false)
  const [showTablePicker, setShowTablePicker] = useState(false)
  const [showVideoPrompt, setShowVideoPrompt] = useState(false)
  const [showGameGallery, setShowGameGallery] = useState(false)
  const [uploadError, setUploadError] = useState(null)

  const handleFileUpload = (accept, handler) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (file) handler(file)
    }
    input.click()
  }

  const handleMediaUpload = async (file) => {
    try {
      setUploadError(null)
      const result = await api.uploadFile(file)
      if (!result?.url) {
        setUploadError(result?.error || 'Upload failed')
        return
      }
      if (file.type.startsWith('video/')) onAddVideo?.(result.url)
      else onAddAudio?.(result.url)
    } catch (err) {
      console.error('Upload failed:', err)
      setUploadError('Upload failed. Check your connection.')
    }
  }

  const handleSvgFileUpload = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.svg,image/svg+xml'
    input.onchange = async (ev) => {
      const file = ev.target.files[0]
      if (!file) return
      const text = await file.text()
      onAddSvg?.(text)
    }
    input.click()
  }

  return (
    <div className="flex items-stretch gap-0 h-full overflow-x-auto">
      <RibbonSection label="Basic" className="border-r border-border px-1">
        <div className="flex items-center gap-0.5">
          <Button variant="ribbon" title="Add text" aria-label="Add text"
            onMouseDown={(e) => { e.preventDefault(); onAddText?.() }}
            onKeyDown={(e) => handleKeyboardActivation(e, onAddText)}>
            <Type size={14} />
          </Button>
          <Button variant="icon" className="h-7 w-7" title="Add image (URL)" aria-label="Add image"
            onMouseDown={(e) => { e.preventDefault(); onAddImage?.() }}
            onKeyDown={(e) => handleKeyboardActivation(e, onAddImage)}>
            <ImageIcon size={14} />
          </Button>
          <Button variant="icon" className="h-7 w-7" title="Upload image" aria-label="Upload image"
            onMouseDown={(e) => { e.preventDefault(); handleFileUpload('image/*', (f) => onAddImageUpload?.(f)) }}
            onKeyDown={(e) => handleKeyboardActivation(e, () => handleFileUpload('image/*', (f) => onAddImageUpload?.(f)))}>
            <Upload size={14} />
          </Button>
        </div>
      </RibbonSection>

      <RibbonSection label="Shapes" className="border-r border-border px-1">
        <div className="flex items-center gap-0.5 relative">
          <Button variant="ribbon" title="Shapes" aria-label="Insert shape"
            onMouseDown={(e) => { e.preventDefault(); setShowShapeGallery((v) => !v) }}
            onKeyDown={(e) => handleKeyboardActivation(e, () => setShowShapeGallery((v) => !v))}>
            <Shapes size={14} />
          </Button>
          {showShapeGallery && (
            <ShapeGallery
              onSelect={(type) => onAddShape?.(type)}
              onClose={() => setShowShapeGallery(false)}
            />
          )}
          <Button variant="icon" className="h-7 w-7" title="Line" aria-label="Add line"
            onMouseDown={(e) => { e.preventDefault(); onAddLine?.() }}
            onKeyDown={(e) => handleKeyboardActivation(e, onAddLine)}>
            <Minus size={14} />
          </Button>
          <Button variant="icon" className="h-7 w-7" title="Arrow" aria-label="Add arrow"
            onMouseDown={(e) => { e.preventDefault(); onAddLine?.({ arrowEnd: 'arrow' }) }}
            onKeyDown={(e) => handleKeyboardActivation(e, () => onAddLine?.({ arrowEnd: 'arrow' }))}>
            <ArrowUpRight size={14} />
          </Button>
          <Button variant="icon" className="h-7 w-7" title="Callout" aria-label="Add callout"
            onMouseDown={(e) => { e.preventDefault(); onAddCallout?.() }}
            onKeyDown={(e) => handleKeyboardActivation(e, onAddCallout)}>
            <MessageSquare size={14} />
          </Button>
          <Button variant="icon" className="h-7 w-7" title="Icon" aria-label="Add icon"
            onMouseDown={(e) => { e.preventDefault(); onAddIcon?.() }}
            onKeyDown={(e) => handleKeyboardActivation(e, onAddIcon)}>
            <Smile size={14} />
          </Button>
        </div>
      </RibbonSection>

      <RibbonSection label="Content" className="border-r border-border px-1">
        <div className="flex items-center gap-0.5">
          <Button variant="icon" className="h-7 w-7" title="Chart" aria-label="Add chart"
            onMouseDown={(e) => { e.preventDefault(); onAddChart?.() }}
            onKeyDown={(e) => handleKeyboardActivation(e, onAddChart)}>
            <BarChart3 size={14} />
          </Button>
          <div className="relative">
            <Button variant="icon" className="h-7 w-7" title="Table" aria-label="Add table"
              onMouseDown={(e) => { e.preventDefault(); setShowTablePicker((v) => !v) }}
              onKeyDown={(e) => handleKeyboardActivation(e, () => setShowTablePicker((v) => !v))}>
              <Table2 size={14} />
            </Button>
            {showTablePicker && (
              <TableSizePicker
                onSelect={(r, c) => onAddTable?.(r, c)}
                onClose={() => setShowTablePicker(false)}
              />
            )}
          </div>
          <Button variant="icon" className="h-7 w-7" title="Code block" aria-label="Add code block"
            onMouseDown={(e) => { e.preventDefault(); onAddCode?.() }}
            onKeyDown={(e) => handleKeyboardActivation(e, onAddCode)}>
            <Code size={14} />
          </Button>
          <Button variant="icon" className="h-7 w-7" title="Markdown" aria-label="Add markdown"
            onMouseDown={(e) => { e.preventDefault(); onAddMarkdown?.() }}
            onKeyDown={(e) => handleKeyboardActivation(e, onAddMarkdown)}>
            <FileCode size={14} />
          </Button>
          <Button variant="icon" className="h-7 w-7" title="LaTeX" aria-label="Add LaTeX"
            onMouseDown={(e) => { e.preventDefault(); onAddLatex?.() }}
            onKeyDown={(e) => handleKeyboardActivation(e, onAddLatex)}>
            <Sigma size={14} />
          </Button>
          <Button variant="icon" className="h-7 w-7" title="QR Code" aria-label="Add QR code"
            onMouseDown={(e) => { e.preventDefault(); onAddQrCode?.() }}
            onKeyDown={(e) => handleKeyboardActivation(e, onAddQrCode)}>
            <QrCode size={14} />
          </Button>
        </div>
      </RibbonSection>

      <RibbonSection label="Media" className="border-r border-border px-1">
        <div className="flex items-center gap-0.5">
          <Button variant="icon" className="h-7 w-7" title="Add video" aria-label="Add video"
            onMouseDown={(e) => { e.preventDefault(); setShowVideoPrompt(true) }}
            onKeyDown={(e) => handleKeyboardActivation(e, () => setShowVideoPrompt(true))}>
            <Video size={14} />
          </Button>
          <Button variant="icon" className="h-7 w-7" title="Audio / Upload" aria-label="Audio / Upload"
            onMouseDown={(e) => { e.preventDefault(); handleFileUpload('audio/*,video/*', handleMediaUpload) }}
            onKeyDown={(e) => handleKeyboardActivation(e, () => handleFileUpload('audio/*,video/*', handleMediaUpload))}>
            <Music size={14} />
          </Button>
          <Button variant="icon" className="h-7 w-7" title="Open media library" aria-label="Open media library"
            onMouseDown={(e) => { e.preventDefault(); onOpenMediaLibrary?.() }}
            onKeyDown={(e) => handleKeyboardActivation(e, onOpenMediaLibrary)}>
            <FolderOpen size={14} />
          </Button>
          {onOpenFileBrowser && (
            <Button variant="icon" className="h-7 w-7" title="Open file browser" aria-label="Open file browser"
              onMouseDown={(e) => { e.preventDefault(); onOpenFileBrowser?.() }}
              onKeyDown={(e) => handleKeyboardActivation(e, onOpenFileBrowser)}>
              <Monitor size={14} />
            </Button>
          )}
        </div>
      </RibbonSection>

      <RibbonSection label="Embed" className="border-r border-border px-1">
        <div className="flex items-center gap-0.5">
          <Button variant="icon" className="h-7 w-7" title="Add HTML embed" aria-label="Add HTML embed"
            onMouseDown={(e) => { e.preventDefault(); onAddHtml?.() }}
            onKeyDown={(e) => handleKeyboardActivation(e, onAddHtml)}>
            <Globe size={14} />
          </Button>
          <Button variant="icon" className="h-7 w-7" title="Add SVG" aria-label="Add SVG"
            onMouseDown={(e) => { e.preventDefault(); handleSvgFileUpload() }}
            onKeyDown={(e) => handleKeyboardActivation(e, handleSvgFileUpload)}>
            <Pencil size={14} />
          </Button>
          <Button variant="icon" className="h-7 w-7" title="Add drawing" aria-label="Add drawing"
            onMouseDown={(e) => { e.preventDefault(); onAddDrawing?.() }}
            onKeyDown={(e) => handleKeyboardActivation(e, onAddDrawing)}>
            <Pencil size={14} />
          </Button>
          <Button variant="icon" className="h-7 w-7" title="Add divider" aria-label="Add divider"
            onMouseDown={(e) => { e.preventDefault(); onAddDivider?.() }}
            onKeyDown={(e) => handleKeyboardActivation(e, onAddDivider)}>
            <Scissors size={14} />
          </Button>
        </div>
      </RibbonSection>

      <RibbonSection label="Advanced" className="px-1">
        <RibbonDropdownMenuGroup
          icon={Package}
          label="Advanced"
          items={[
            { id: 'kinetic', icon: Sparkles, label: 'Kinetic Text', onAction: () => onAddKineticText?.() },
            { id: 'mathgrid', icon: Grid3x3, label: 'Math Grid', onAction: () => onAddMathGrid?.() },
            { id: 'anime', icon: Clapperboard, label: 'Anime.js', onAction: () => onAddAnime?.() },
            { id: 'three', icon: Box, label: 'Three.js', onAction: () => onAddThree?.() },
            { id: 'timeline', icon: Clock, label: 'Timeline', onAction: () => onAddTimeline?.() },
            { id: 'games', icon: Gamepad2, label: 'Games...', onAction: () => setShowGameGallery(true) },
          ]}
          menuClassName="w-[260px] min-w-[260px]"
          itemsClassName="grid grid-cols-2 gap-1"
        />
      </RibbonSection>

      {showVideoPrompt && (
        <PromptPopover
          title="Video URL"
          defaultValue=""
          placeholder="https://..."
          onSubmit={(url) => {
            onAddVideo?.(url)
            setShowVideoPrompt(false)
          }}
          onCancel={() => setShowVideoPrompt(false)}
          className="fixed top-20 left-1/2 -translate-x-1/2"
        />
      )}
      {showGameGallery && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[1100]">
          <GameGalleryDropdown
            onSelect={(type) => onAddGame?.(type)}
            onClose={() => setShowGameGallery(false)}
          />
        </div>
      )}
      {uploadError && (
        <div className="fixed top-20 left-1/2 z-[1100] -translate-x-1/2 rounded-md border border-danger bg-danger/10 px-3 py-2 text-xs text-danger">
          {uploadError}
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import {
  Type, Image as ImageIcon, Shapes, Minus, ArrowUpRight,
  BarChart3, Table2, FileCode, Code, Sigma, QrCode,
  Video, Music, FolderOpen, HardDrive,
  Globe, Pencil, SeparatorHorizontal, FileImage,
  Wand2, Grid3x3, Clapperboard, Box, Clock,
  Gamepad2, MessageSquare, Sticker, Package, Link,
} from 'lucide-react'
import * as shared from 'revealjs-shared'
import RibbonSection from './ribbon-section'
import RibbonTabContentRow from './ribbon-tab-content-row'
import RibbonDropdownMenuGroup from './ribbon-dropdown-menu-group-trigger'
import RibbonFloatingOverlay from './ribbon-floating-overlay'
import RibbonBigButton from './ribbon-big-button'
import IconGallery from '../IconGallery'
import { Button } from '../ui'
import { GAME_TYPES } from '../../constants/game-element-types-constants'
import PromptPopover from '../PromptPopover'
import { api } from '../../utils/api'

const { SHAPES = [], shapeSvgString = () => '' } = shared

const SHAPE_GROUPS = {
  Geometric: ['rect', 'rounded-rect', 'circle', 'triangle', 'diamond', 'hexagon', 'pentagon'],
  Directional: ['arrow-right', 'line'],
  Organic: ['cloud', 'star', 'bracket'],
  '3D': ['cylinder', 'parallelogram', 'trapezoid'],
}

function renderShapePreviewMarkup(shapeType) {
  return shapeSvgString({
    shape: shapeType,
    width: 20,
    height: 20,
    fill: 'currentColor',
    stroke: 'currentColor',
    strokeWidth: shapeType === 'line' || shapeType === 'bracket' ? 2 : 0,
  })
}

function ShapeGallery({ open, anchorRef, onSelect, onClose }) {
  return (
    <RibbonFloatingOverlay
      open={open}
      anchorRef={anchorRef}
      onClose={onClose}
      dataRibbonPopup="shape-gallery"
      className="bg-card border border-border rounded-lg p-3 shadow-xl w-[280px]"
    >
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
                  className="ribbon-shape-gallery-button p-0 flex items-center justify-center border border-border bg-secondary"
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
                  <span
                    className="ribbon-shape-gallery-icon relative inline-block text-text-primary"
                    aria-hidden="true"
                    dangerouslySetInnerHTML={{ __html: renderShapePreviewMarkup(shapeType) }}
                  />
                </Button>
              )
            })}
          </div>
        </div>
      ))}
    </RibbonFloatingOverlay>
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

function GameGalleryDropdown({ open, anchorRef, onSelect, onClose }) {
  const firstGameButtonRef = useRef(null)

  useEffect(() => {
    if (!open) return
    firstGameButtonRef.current?.focus()
  }, [open])

  const handleSelect = (type) => {
    onSelect(type)
    anchorRef?.current?.focus?.()
    onClose()
  }

  return (
    <RibbonFloatingOverlay
      open={open}
      anchorRef={anchorRef}
      onClose={onClose}
      dataRibbonPopup="games-gallery"
      className="bg-card border border-border rounded-lg p-2 shadow-xl w-[160px]"
    >
      <div className="text-[10px] font-semibold text-text-primary mb-1.5">Games</div>
      <div className="flex flex-col gap-0.5">
        {GAME_TYPES.all.map((type, index) => (
          <button
            key={type}
            ref={index === 0 ? firstGameButtonRef : undefined}
            className="flex items-center gap-2 px-2 py-1 rounded text-[11px] text-left cursor-pointer transition-colors hover:bg-secondary text-text-primary"
            onMouseDown={(e) => {
              e.preventDefault()
              handleSelect(type)
            }}
            onKeyDown={(e) => handleKeyboardActivation(e, () => {
              handleSelect(type)
            })}
          >
            <Gamepad2 size={12} />
            {GAME_LABELS[type] || type}
          </button>
        ))}
      </div>
    </RibbonFloatingOverlay>
  )
}

function TableSizePicker({ open, anchorRef, onSelect, onClose }) {
  const [hoverR, setHoverR] = useState(0)
  const [hoverC, setHoverC] = useState(0)

  return (
    <RibbonFloatingOverlay
      open={open}
      anchorRef={anchorRef}
      onClose={onClose}
      dataRibbonPopup="table-picker"
      className="bg-card border border-border rounded-lg p-2 shadow-xl"
    >
      <div onMouseLeave={() => { setHoverR(0); setHoverC(0); onClose() }}>
      <div className="text-[10px] text-text-muted mb-1">
        {hoverR > 0 ? `${hoverR}×${hoverC}` : '3×3 default'}
      </div>
      <div className="grid grid-cols-8 gap-0.5">
        {Array.from({ length: 6 }, (_, r) =>
          Array.from({ length: 8 }, (_, c) => (
            <div
              key={`${r}-${c}`}
              className={`ribbon-table-picker-cell rounded-sm cursor-pointer ${
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
    </RibbonFloatingOverlay>
  )
}

function AdvancedActionButton({ label, title, icon: Icon, onAction }) {
  return (
    <Button
      variant="icon"
      className="h-6 w-6"
      title={title}
      aria-label={label}
      onMouseDown={(e) => { e.preventDefault(); onAction?.() }}
      onKeyDown={(e) => handleKeyboardActivation(e, onAction)}
    >
      <Icon size={13} />
    </Button>
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
  pluginTypes = [],
  onAddPluginElement,
}) {
  const [showShapeGallery, setShowShapeGallery] = useState(false)
  const [showIconGallery, setShowIconGallery] = useState(false)
  const [showTablePicker, setShowTablePicker] = useState(false)
  const [showVideoPrompt, setShowVideoPrompt] = useState(false)
  const [showGameGallery, setShowGameGallery] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const shapeTriggerRef = useRef(null)
  const iconTriggerRef = useRef(null)
  const tableTriggerRef = useRef(null)
  const advancedLauncherRef = useRef(null)

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
    <RibbonTabContentRow>
      <RibbonSection label="Basic" className="border-r border-border px-1">
        <div className="flex items-center gap-0.5">
          <RibbonBigButton icon={Type} label="Text Box" title="Add text" aria-label="Add text"
            data-testid="ribbon-insert-text"
            onMouseDown={(e) => { e.preventDefault(); onAddText?.() }} />
          <RibbonBigButton icon={ImageIcon} label="Picture" title="Insert picture" aria-label="Picture"
            onMouseDown={(e) => { e.preventDefault(); handleFileUpload('image/*', (f) => onAddImageUpload?.(f)) }} />
          <Button variant="icon" className="h-7 w-7" title="Add image (URL)" aria-label="Add image"
            onMouseDown={(e) => { e.preventDefault(); onAddImage?.() }}
            onKeyDown={(e) => handleKeyboardActivation(e, onAddImage)}>
            <Link size={14} />
          </Button>
        </div>
      </RibbonSection>

      <RibbonSection label="Shapes" className="border-r border-border px-1">
        <div className="flex items-center gap-0.5 relative">
          <Button variant="ribbon" title="Shapes" aria-label="Insert shape"
            data-testid="ribbon-insert-shape"
            ref={shapeTriggerRef}
            onMouseDown={(e) => { e.preventDefault(); setShowShapeGallery((v) => !v) }}
            onKeyDown={(e) => handleKeyboardActivation(e, () => setShowShapeGallery((v) => !v))}>
            <Shapes size={14} />
          </Button>
          {showShapeGallery && (
            <ShapeGallery
              open={showShapeGallery}
              anchorRef={shapeTriggerRef}
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
            ref={iconTriggerRef}
            onMouseDown={(e) => { e.preventDefault(); setShowIconGallery((v) => !v) }}
            onKeyDown={(e) => handleKeyboardActivation(e, () => setShowIconGallery((v) => !v))}>
            <Sticker size={14} />
          </Button>
          {showIconGallery && (
            <IconGallery
              open={showIconGallery}
              anchorRef={iconTriggerRef}
              onSelect={(name) => onAddIcon?.(name)}
              onClose={() => setShowIconGallery(false)}
            />
          )}
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
              ref={tableTriggerRef}
              onMouseDown={(e) => { e.preventDefault(); setShowTablePicker((v) => !v) }}
              onKeyDown={(e) => handleKeyboardActivation(e, () => setShowTablePicker((v) => !v))}>
              <Table2 size={14} />
            </Button>
            {showTablePicker && (
              <TableSizePicker
                open={showTablePicker}
                anchorRef={tableTriggerRef}
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
              <HardDrive size={14} />
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
            <FileImage size={14} />
          </Button>
          <Button variant="icon" className="h-7 w-7" title="Add drawing" aria-label="Add drawing"
            onMouseDown={(e) => { e.preventDefault(); onAddDrawing?.() }}
            onKeyDown={(e) => handleKeyboardActivation(e, onAddDrawing)}>
            <Pencil size={14} />
          </Button>
          <Button variant="icon" className="h-7 w-7" title="Add divider" aria-label="Add divider"
            onMouseDown={(e) => { e.preventDefault(); onAddDivider?.() }}
            onKeyDown={(e) => handleKeyboardActivation(e, onAddDivider)}>
            <SeparatorHorizontal size={14} />
          </Button>
        </div>
      </RibbonSection>

      <RibbonSection label="Advanced" className="px-1">
        <div className="flex items-center gap-0.5">
          <AdvancedActionButton label="Add kinetic text" title="Kinetic Text" icon={Wand2} onAction={onAddKineticText} />
          <AdvancedActionButton label="Add math grid" title="Math Grid" icon={Grid3x3} onAction={onAddMathGrid} />
          <AdvancedActionButton label="Add Anime.js" title="Anime.js" icon={Clapperboard} onAction={onAddAnime} />
          <AdvancedActionButton label="Add Three.js" title="Three.js" icon={Box} onAction={onAddThree} />
          <AdvancedActionButton label="Add timeline" title="Timeline" icon={Clock} onAction={onAddTimeline} />
          <RibbonDropdownMenuGroup
            triggerRef={advancedLauncherRef}
            triggerTestId="ribbon-insert-game"
            icon={Package}
            label="More advanced insert options"
            triggerVariant="icon"
            triggerClassName="h-6 w-6"
            items={[
              { id: 'games', icon: Gamepad2, label: 'Games...', onAction: () => setShowGameGallery(true) },
              ...pluginTypes.map((plugin) => ({
                id: plugin.fullType,
                icon: Package,
                label: plugin.label,
                onAction: () => onAddPluginElement?.(plugin.fullType),
              })),
            ]}
            menuClassName="w-[260px] min-w-[260px]"
            itemsClassName="grid grid-cols-2 gap-1"
          />
        </div>
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
        <GameGalleryDropdown
          open={showGameGallery}
          anchorRef={advancedLauncherRef}
          onSelect={(type) => onAddGame?.(type)}
          onClose={() => setShowGameGallery(false)}
        />
      )}
      {uploadError && (
        <div className="fixed top-20 left-1/2 z-[1100] -translate-x-1/2 rounded-md border border-danger bg-danger/10 px-3 py-2 text-xs text-danger">
          {uploadError}
        </div>
      )}
    </RibbonTabContentRow>
  )
}

import { useState, useEffect, useRef } from 'react'
import { api } from '../utils/api'
import PromptPopover from './PromptPopover'
import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignHorizontalJustifyCenter,
  AlignVerticalJustifyCenter,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  AlignStartVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignEndHorizontal,
  List,
  ListOrdered,
  Code,
  FileCode,
  Quote,
  Link,
  Unlink,
  Image,
  Type,
  RemoveFormatting,
  Upload,
  Grid,
  Table2,
  Magnet,
  Highlighter,
  Ruler,
  Group,
  Ungroup,
  Minus,
  ArrowUpRight,
  Sigma,
  FunctionSquare,
} from 'lucide-react'
import * as shared from 'revealjs-shared'
import InsertMenu from './InsertMenu'
import { Button } from '../components/ui'

// eslint-disable-next-line unused-imports/no-unused-vars
const { SHAPES } = shared

const COLOR_PALETTE = [
  '#ffffff',
  '#e2e8f0',
  '#94a3b8',
  '#64748b',
  '#334155',
  '#1e293b',
  '#0f172a',
  '#000000',
  '#fca5a5',
  '#f87171',
  '#ef4444',
  '#dc2626',
  '#fcd34d',
  '#fbbf24',
  '#f59e0b',
  '#d97706',
  '#86efac',
  '#4ade80',
  '#22c55e',
  '#16a34a',
  '#6ee7b7',
  '#34d399',
  '#10b981',
  '#059669',
  '#93c5fd',
  '#60a5fa',
  '#3b82f6',
  '#2563eb',
  '#a5b4fc',
  '#818cf8',
  '#6366f1',
  '#4f46e5',
  '#d8b4fe',
  '#c084fc',
  '#a855f7',
  '#7c3aed',
  '#f5d0fe',
  '#f0abfc',
  '#e879f9',
  '#d946ef',
]

const COLOR_SWATCHES_BG = [
  '#1e1e2e',
  '#0a0a0f',
  '#1a1a4e',
  '#0d3349',
  '#1a3a1a',
  '#3a1a1a',
  '#2d1b69',
  '#000000',
  '#ffffff',
  '#f8f9fa',
  '#4a4a6a',
  '#6b3fa0',
]

const GRADIENT_PRESETS_BG = [
  'linear-gradient(135deg, #1e1e2e, #4a0e8f)',
  'linear-gradient(135deg, #0f2027, #203a43, #2c5364)',
  'linear-gradient(135deg, #360033, #0b8793)',
  'radial-gradient(ellipse at center, #1e3c72 0%, #2a5298 100%)',
  'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
  'linear-gradient(135deg, #2c3e50, #3498db)',
]

export default function Toolbar({
  editor,
  editingElementId,
  showGrid,
  onToggleGrid,
  gridSize,
  onGridSizeChange,
  onAddText,
  onAddImage,
  onAddImageUpload,
  onAddShape,
  onAddHtml,
  onAddCode,
  onAddLatex,
  onAddMarkdown,
  onAddChart,
  onAddCallout,
  onAddIcon,
  onAddVideo,
  onAddAudio,
  onAddTable,
  onAddDrawing,
  onAddLine,
  onAddSvg,
  onOpenMediaLibrary,
  onAddQrCode,
  onAddDivider,
  selectedCount,
  onAlignElements,
  smartGuidesEnabled,
  onToggleSmartGuides,
  slide,
  onUpdateSlide,
  onGroupElements,
  onUngroupElements,
  showRulers,
  onToggleRulers,
}) {
  // eslint-disable-next-line unused-imports/no-unused-vars
  const [showShapeMenu, setShowShapeMenu] = useState(false)
  const [showTableMenu, setShowTableMenu] = useState(false)
  const [showColorPalette, setShowColorPalette] = useState(false)
  const [showHighlightPalette, setShowHighlightPalette] = useState(false)
  const [showBgMenu, setShowBgMenu] = useState(false)
  // eslint-disable-next-line unused-imports/no-unused-vars
  const [showIconPicker, setShowIconPicker] = useState(false)
  // eslint-disable-next-line unused-imports/no-unused-vars
  const [iconSearch, setIconSearch] = useState('')
  const [uploading, setUploading] = useState(false)
  const bgFileRef = useRef(null)
  // Prompt popover state
  const [promptState, setPromptState] = useState(null) // { type, defaultValue, title }

  useEffect(() => {
    if (!showColorPalette) return
    const close = () => setShowColorPalette(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showColorPalette])

  useEffect(() => {
    if (!showHighlightPalette) return
    const close = () => setShowHighlightPalette(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showHighlightPalette])

  useEffect(() => {
    if (!showBgMenu) return
    const close = (e) => {
      // Don't close if clicking inside the popup
      if (e.target.closest?.('.bg-popup-container')) return
      setShowBgMenu(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showBgMenu])

  function handleLink() {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href
    setPromptState({
      type: 'link',
      defaultValue: previousUrl || 'https://',
      title: 'Enter URL',
    })
  }

  function handleImage() {
    if (!editor) return
    setPromptState({
      type: 'image',
      defaultValue: '',
      title: 'Image URL',
    })
  }

  function handlePromptSubmit(value) {
    if (!editor || !promptState) return
    const { type } = promptState
    if (type === 'link') {
      if (!value) editor.chain().focus().unsetLink().run()
      else editor.chain().focus().toggleLink({ href: value }).run()
    } else if (type === 'image') {
      if (value) editor.chain().focus().setImage({ src: value }).run()
    } else if (type === 'latex-inline') {
      if (value) editor.chain().focus().insertMath(value, false).run()
    } else if (type === 'latex-display') {
      if (value) editor.chain().focus().insertMath(value, true).run()
    } else if (type === 'table-insert') {
      // value format: 'rows,cols'
      const [r, c] = value.split(',').map(Number)
      if (r > 0 && c > 0)
        editor.chain().focus().insertTable({ rows: r, cols: c, withHeaderRow: true }).run()
    }
    setPromptState(null)
  }

  function handleClearFormatting() {
    if (!editor) return
    editor.chain().focus().clearNodes().unsetAllMarks().run()
  }

  const currentColor = editor ? editor.getAttributes('textStyle').color || '#ffffff' : '#ffffff'

  return (
    <div className="relative z-[100] flex h-14 w-full flex-wrap items-center gap-1 border-b border-border bg-panel px-4 py-1.5 tour-step-toolbar">
      {/* Insert dropdown — replaces all element insertion buttons */}
      <InsertMenu
        onAddText={onAddText}
        onAddImage={onAddImage}
        onAddImageUpload={onAddImageUpload}
        onAddHtmlElement={onAddHtml}
        onAddCodeElement={onAddCode}
        onAddLatexElement={onAddLatex}
        onAddMarkdownElement={onAddMarkdown}
        onAddChart={onAddChart}
        onAddVideo={onAddVideo}
        onAddAudio={onAddAudio}
        onOpenMediaLibrary={onOpenMediaLibrary}
        onAddShape={onAddShape}
        onAddLine={onAddLine}
        onAddSvgElement={onAddSvg}
        onAddIcon={onAddIcon}
        onAddCallout={onAddCallout}
        onAddTable={onAddTable}
        onAddDrawing={onAddDrawing}
        onAddQrCode={onAddQrCode}
        onAddDivider={onAddDivider}
      />

      <Button
        variant="icon"
        title="Draw Line"
        onClick={() => {
          if (typeof onAddLine === 'function') onAddLine()
        }}
      >
        <Minus size={18} />
      </Button>

      <Button
        variant="icon"
        title="Draw Arrow"
        onClick={() => {
          if (typeof onAddLine === 'function') {
            onAddLine({ arrowEnd: 'arrow' })
          }
        }}
      >
        <ArrowUpRight size={18} />
      </Button>

      <span className="mx-2 h-6 w-[1px] shrink-0 bg-border" />

      {/* Slide Background popup */}
      {slide &&
        onUpdateSlide &&
        (() => {
          const bg = slide.background || { type: 'color', color: '#1e1e2e' }
          const bgType = bg.type || 'color'
          const setBgType = (type) => onUpdateSlide({ background: { ...bg, type } })
          const setBgColor = (color) =>
            onUpdateSlide({ background: { ...bg, type: 'color', color } })
          const setBgGradient = (gradient) =>
            onUpdateSlide({ background: { ...bg, type: 'gradient', gradient } })
          const setBgImage = (image) =>
            onUpdateSlide({
              background: {
                ...bg,
                type: 'image',
                image,
                size: bg.size || 'cover',
                position: bg.position || 'center',
              },
            })
          return (
            <div style={{ position: 'relative' }}>
              <Button
                variant="icon"
                className={showBgMenu ? 'bg-primary-light text-accent' : ''}
                style={{
                  width: 'auto',
                  padding: '0 8px',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                title="Slide Background"
                onClick={() => setShowBgMenu((v) => !v)}
              >
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    flexShrink: 0,
                    border: '1px solid rgba(255,255,255,0.3)',
                    ...(bgType === 'color'
                      ? { backgroundColor: bg.color || '#1e1e2e' }
                      : bgType === 'gradient'
                        ? { background: bg.gradient || '#1e1e2e' }
                        : bgType === 'image'
                          ? { backgroundImage: `url(${bg.image})`, backgroundSize: 'cover' }
                          : { backgroundColor: '#1e1e2e' }),
                  }}
                />
                BG
              </Button>
              {showBgMenu && (
                <div
                  className="bg-popup-container absolute left-0 top-full mt-1 w-[260px] rounded-lg border border-border bg-card p-3 shadow-xl z-[1000]"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: 8,
                    }}
                  >
                    Slide Background
                  </div>
                  <div className="flex gap-1 mb-2">
                    {['color', 'gradient', 'image', 'none'].map((type) => (
                      <Button
                        variant="ghost"
                        key={type}
                        className={`bg-type-tab px-2 py-1 text-xs rounded-md ${bgType === type ? 'bg-active text-accent' : 'text-text-secondary hover:bg-hover'}`}
                        onClick={() => setBgType(type)}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Button>
                    ))}
                  </div>

                  {bgType === 'color' && (
                    <>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                        <input
                          type="color"
                          value={bg.color || '#1e1e2e'}
                          onChange={(e) => setBgColor(e.target.value)}
                          style={{
                            width: 32,
                            height: 28,
                            border: '1px solid var(--border)',
                            borderRadius: 4,
                            background: 'var(--bg-card)',
                            cursor: 'pointer',
                            padding: 1,
                          }}
                        />
                        <input
                          className="w-full flex-1 rounded border border-border bg-secondary px-1.5 py-1 text-xs text-text-primary focus:border-accent focus:outline-none"
                          type="text"
                          value={bg.color || '#1e1e2e'}
                          onChange={(e) => setBgColor(e.target.value)}
                        />
                      </div>
                      <div
                        style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}
                      >
                        {COLOR_SWATCHES_BG.map((color) => (
                          <div
                            key={color}
                            onClick={() => setBgColor(color)}
                            title={color}
                            style={{
                              width: '100%',
                              aspectRatio: '1',
                              borderRadius: 4,
                              cursor: 'pointer',
                              backgroundColor: color,
                              border:
                                bg.color === color
                                  ? '2px solid white'
                                  : color === '#ffffff' || color === '#f8f9fa'
                                    ? '1px solid var(--border)'
                                    : '1px solid transparent',
                            }}
                          />
                        ))}
                      </div>
                    </>
                  )}

                  {bgType === 'gradient' && (
                    <>
                      <div
                        style={{
                          height: 32,
                          borderRadius: 4,
                          background: bg.gradient || 'linear-gradient(135deg, #1e1e2e, #4a0e8f)',
                          marginBottom: 8,
                          border: '1px solid var(--border)',
                        }}
                      />
                      <input
                        className="w-full rounded border border-border bg-secondary px-1.5 py-1 mb-2 text-xs text-text-primary focus:border-accent focus:outline-none"
                        type="text"
                        value={bg.gradient || ''}
                        onChange={(e) => setBgGradient(e.target.value)}
                        placeholder="linear-gradient(...)"
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {GRADIENT_PRESETS_BG.map((preset, i) => (
                          <Button
                            variant="ghost"
                            key={i}
                            onClick={() => setBgGradient(preset)}
                            style={{
                              height: 24,
                              borderRadius: 4,
                              background: preset,
                              cursor: 'pointer',
                              border:
                                bg.gradient === preset
                                  ? '2px solid white'
                                  : '1px solid var(--border)',
                            }}
                            title={preset}
                          />
                        ))}
                      </div>
                    </>
                  )}

                  {bgType === 'image' && (
                    <>
                      {bg.image && (
                        <div
                          style={{
                            height: 60,
                            borderRadius: 4,
                            backgroundImage: `url(${bg.image})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            marginBottom: 8,
                            border: '1px solid var(--border)',
                          }}
                        />
                      )}
                      <input
                        className="w-full rounded border border-border bg-secondary px-1.5 py-1 mb-1.5 text-[11px] text-text-primary focus:border-accent focus:outline-none"
                        type="text"
                        value={bg.image || ''}
                        onChange={(e) => setBgImage(e.target.value)}
                        placeholder="https://example.com/image.jpg"
                      />
                      <Button
                        variant="secondary"
                        style={{
                          width: '100%',
                          justifyContent: 'center',
                          marginBottom: 6,
                          fontSize: 11,
                          padding: '4px 8px',
                        }}
                        onClick={() => bgFileRef.current?.click()}
                        disabled={uploading}
                      >
                        <Upload size={12} />
                        {uploading ? 'Uploading...' : 'Upload Image'}
                      </Button>
                      <input
                        ref={bgFileRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          setUploading(true)
                          try {
                            const res = await api.uploadFile(file)
                            if (res.url) setBgImage(res.url)
                          } catch (err) {
                            console.error('Upload failed', err)
                          } finally {
                            setUploading(false)
                            if (bgFileRef.current) bgFileRef.current.value = ''
                          }
                        }}
                      />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <div style={{ flex: 1 }}>
                          <div
                            style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}
                          >
                            Size
                          </div>
                          <select
                            className="w-full rounded border border-border bg-secondary px-1 py-0.5 text-[11px] text-text-primary focus:border-accent focus:outline-none"
                            value={bg.size || 'cover'}
                            onChange={(e) =>
                              onUpdateSlide({ background: { ...bg, size: e.target.value } })
                            }
                          >
                            <option value="cover">Cover</option>
                            <option value="contain">Contain</option>
                            <option value="auto">Auto</option>
                            <option value="100% 100%">Stretch</option>
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div
                            style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}
                          >
                            Position
                          </div>
                          <select
                            className="w-full rounded border border-border bg-secondary px-1 py-0.5 text-[11px] text-text-primary focus:border-accent focus:outline-none"
                            value={bg.position || 'center'}
                            onChange={(e) =>
                              onUpdateSlide({ background: { ...bg, position: e.target.value } })
                            }
                          >
                            <option value="center">Center</option>
                            <option value="top">Top</option>
                            <option value="bottom">Bottom</option>
                            <option value="left">Left</option>
                            <option value="right">Right</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                  {bgType === 'none' && (
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      No background (uses theme default)
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })()}

      {/* Grid toggle */}
      <Button
        variant="icon"
        className={showGrid ? 'bg-primary-light text-accent' : ''}
        onClick={onToggleGrid}
        title={showGrid ? 'Hide grid / disable snap' : 'Show grid + snap to grid'}
      >
        <Grid size={18} />
      </Button>
      {showGrid && (
        <input
          type="number"
          min="5"
          max="200"
          step="5"
          value={gridSize}
          onChange={(e) =>
            onGridSizeChange(Math.max(5, Math.min(200, Number(e.target.value) || 40)))
          }
          title="Grid size (px)"
          style={{
            width: 48,
            padding: '3px 6px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            borderRadius: 4,
            fontSize: 12,
            textAlign: 'center',
          }}
        />
      )}

      {/* Smart guides toggle */}
      <Button
        variant="icon"
        className={smartGuidesEnabled ? 'bg-primary-light text-accent' : ''}
        onClick={onToggleSmartGuides}
        title={smartGuidesEnabled ? 'Disable smart guides' : 'Enable smart guides'}
      >
        <Magnet size={18} />
      </Button>

      {/* Ruler toggle */}
      <Button
        variant="icon"
        className={showRulers ? 'bg-primary-light text-accent' : ''}
        onClick={onToggleRulers}
        title={showRulers ? 'Hide rulers' : 'Show rulers (drag to add guides)'}
      >
        <Ruler size={18} />
      </Button>

      {selectedCount >= 2 && (
        <>
          <span className="mx-2 h-6 w-[1px] shrink-0 bg-border" />
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Align:</span>
          {[
            ['left', AlignStartVertical, 'Align left'],
            ['center-h', AlignHorizontalJustifyCenter, 'Center H'],
            ['right', AlignEndVertical, 'Align right'],
            ['top', AlignStartHorizontal, 'Align top'],
            ['center-v', AlignVerticalJustifyCenter, 'Center V'],
            ['bottom', AlignEndHorizontal, 'Align bottom'],
            ['distribute-h', AlignHorizontalDistributeCenter, 'Distribute H'],
            ['distribute-v', AlignVerticalDistributeCenter, 'Distribute V'],
          ].map(([type, Icon, title]) => (
            <Button
              variant="icon"
              key={type}
              title={title}
              style={{ padding: '0 3px', width: 28, height: 28 }}
              onClick={() => onAlignElements(type)}
            >
              <Icon size={18} />
            </Button>
          ))}
          <span className="mx-2 h-6 w-[1px] shrink-0 bg-border" />
          <Button
            variant="icon"
            title="Group selected elements"
            onClick={onGroupElements}
            style={{ width: 'auto', padding: '0 6px', fontSize: 11 }}
          >
            <Group size={18} />
          </Button>
          <Button
            variant="icon"
            title="Ungroup elements"
            onClick={onUngroupElements}
            style={{ width: 'auto', padding: '0 6px', fontSize: 11 }}
          >
            <Ungroup size={18} />
          </Button>
        </>
      )}

      <span className="mx-2 h-6 w-[1px] shrink-0 bg-border" />

      {/* Hint when no text element is being edited */}
      {!editingElementId && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '0 8px' }}>
          Double-click a text box to edit
        </span>
      )}

      {editor && (
        <>
          {/* Font Family */}
          <select
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              padding: '3px 6px',
              borderRadius: 4,
              fontSize: 12,
              maxWidth: 120,
              cursor: 'pointer',
            }}
            value={editor.getAttributes('textStyle').fontFamily || ''}
            onChange={(e) =>
              e.target.value
                ? editor.chain().focus().setFontFamily(e.target.value).run()
                : editor.chain().focus().unsetFontFamily().run()
            }
            title="Font family"
          >
            <option value="">Default</option>
            <optgroup label="Sans-serif">
              <option value="Arial, sans-serif">Arial</option>
              <option value="'Helvetica Neue', sans-serif">Helvetica</option>
              <option value="Verdana, sans-serif">Verdana</option>
              <option value="Tahoma, sans-serif">Tahoma</option>
              <option value="'Trebuchet MS', sans-serif">Trebuchet</option>
              <option value="Inter, sans-serif">Inter</option>
              <option value="Roboto, sans-serif">Roboto</option>
              <option value="'Open Sans', sans-serif">Open Sans</option>
              <option value="'Source Sans Pro', sans-serif">Source Sans Pro</option>
              <option value="'Computer Modern Sans', sans-serif">Computer Modern Sans</option>
            </optgroup>
            <optgroup label="Serif">
              <option value="Georgia, serif">Georgia</option>
              <option value="'Times New Roman', serif">Times New Roman</option>
              <option value="'Playfair Display', serif">Playfair Display</option>
              <option value="Merriweather, serif">Merriweather</option>
              <option value="'Computer Modern Serif', serif">Computer Modern</option>
              <option value="'Latin Modern Roman', serif">Latin Modern Roman</option>
            </optgroup>
            <optgroup label="Monospace">
              <option value="'Courier New', monospace">Courier New</option>
              <option value="'Fira Code', monospace">Fira Code</option>
              <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
            </optgroup>
            <optgroup label="Display">
              <option value="Impact, sans-serif">Impact</option>
            </optgroup>
          </select>

          {/* Font Size */}
          <select
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              padding: '3px 6px',
              borderRadius: 4,
              fontSize: 12,
              width: 60,
              cursor: 'pointer',
            }}
            value={editor.getAttributes('textStyle').fontSize || ''}
            onChange={(e) =>
              e.target.value
                ? editor.chain().focus().setFontSize(e.target.value).run()
                : editor.chain().focus().unsetFontSize().run()
            }
            title="Font size"
          >
            <option value="">Auto</option>
            {[
              '10px',
              '12px',
              '14px',
              '16px',
              '18px',
              '20px',
              '24px',
              '28px',
              '32px',
              '36px',
              '40px',
              '48px',
              '56px',
              '64px',
              '72px',
              '96px',
            ].map((s) => (
              <option key={s} value={s}>
                {s.replace('px', '')}
              </option>
            ))}
          </select>

          <span className="mx-2 h-6 w-[1px] shrink-0 bg-border" />

          {/* Undo / Redo */}
          <Button
            variant="icon"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo"
          >
            <Undo2 size={18} />
          </Button>
          <Button
            variant="icon"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo"
          >
            <Redo2 size={18} />
          </Button>

          <span className="mx-2 h-6 w-[1px] shrink-0 bg-border" />

          {/* Headings */}
          <Button
            variant="ghost"
            className={
              editor.isActive('heading', { level: 1 }) ? 'bg-primary-light text-accent' : ''
            }
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            title="Heading 1"
            style={{ fontSize: 12, fontWeight: 700, width: 'auto', padding: '0 6px' }}
          >
            H1
          </Button>
          <Button
            variant="ghost"
            className={
              editor.isActive('heading', { level: 2 }) ? 'bg-primary-light text-accent' : ''
            }
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            title="Heading 2"
            style={{ fontSize: 12, fontWeight: 700, width: 'auto', padding: '0 6px' }}
          >
            H2
          </Button>
          <Button
            variant="ghost"
            className={
              editor.isActive('heading', { level: 3 }) ? 'bg-primary-light text-accent' : ''
            }
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            title="Heading 3"
            style={{ fontSize: 12, fontWeight: 700, width: 'auto', padding: '0 6px' }}
          >
            H3
          </Button>
          <Button
            variant="icon"
            className={
              editor.isActive('paragraph') && !editor.isActive('heading')
                ? 'bg-primary-light text-accent'
                : ''
            }
            onClick={() => editor.chain().focus().setParagraph().run()}
            title="Normal text"
          >
            <Type size={18} />
          </Button>

          <span className="mx-2 h-6 w-[1px] shrink-0 bg-border" />

          {/* Text formatting */}
          <Button
            variant="icon"
            className={editor.isActive('bold') ? 'bg-primary-light text-accent' : ''}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold (Ctrl+B)"
          >
            <Bold size={18} />
          </Button>
          <Button
            variant="icon"
            className={editor.isActive('italic') ? 'bg-primary-light text-accent' : ''}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic (Ctrl+I)"
          >
            <Italic size={18} />
          </Button>
          <Button
            variant="icon"
            className={editor.isActive('underline') ? 'bg-primary-light text-accent' : ''}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="Underline (Ctrl+U)"
          >
            <Underline size={18} />
          </Button>
          <Button
            variant="icon"
            className={editor.isActive('strike') ? 'bg-primary-light text-accent' : ''}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="Strikethrough"
          >
            <Strikethrough size={18} />
          </Button>

          <span className="mx-2 h-6 w-[1px] shrink-0 bg-border" />

          {/* Text color palette */}
          <div style={{ position: 'relative' }}>
            <Button
              variant="icon"
              className={showColorPalette ? 'bg-primary-light text-accent' : ''}
              style={{ position: 'relative' }}
              onClick={() => setShowColorPalette((v) => !v)}
              title="Text color"
            >
              <Type size={18} />
              <span className="inline-block w-4 h-1 rounded-sm mt-0.5" style={{ background: currentColor }} />
            </Button>
            {showColorPalette && (
              <div
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 1000,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 8,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(8, 22px)',
                  gap: 3,
                }}
              >
                {COLOR_PALETTE.map((color) => (
                  <Button
                    variant="ghost"
                    key={color}
                    title={color}
                    style={{
                      width: 22,
                      height: 22,
                      background: color,
                      padding: 0,
                      border:
                        currentColor.toLowerCase() === color.toLowerCase()
                          ? '2px solid white'
                          : '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 4,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      editor.chain().focus().setColor(color).run()
                      setShowColorPalette(false)
                    }}
                  />
                ))}
                <div
                  style={{
                    gridColumn: '1 / -1',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 4,
                    paddingTop: 6,
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    Custom
                  </span>
                  <div className="flex-1">
                    <div
                      style={{
                        width: '100%',
                        height: 22,
                        borderRadius: 4,
                        background: currentColor,
                        border: '1px solid rgba(255,255,255,0.15)',
                        cursor: 'pointer',
                      }}
                    />
                    <input
                      type="color"
                      value={currentColor}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        opacity: 0,
                        cursor: 'pointer',
                        width: '100%',
                        height: '100%',
                      }}
                      onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Highlight color palette */}
          <div style={{ position: 'relative' }}>
            <Button
              variant="icon"
              className={showHighlightPalette ? 'bg-primary-light text-accent' : ''}
              style={{ position: 'relative' }}
              onClick={() => setShowHighlightPalette((v) => !v)}
              title="Highlight color"
            >
              <Highlighter size={18} />
              <span
                className="inline-block w-4 h-1 rounded-sm mt-0.5"
                style={{
                  background: editor.getAttributes('highlight').color || 'transparent',
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
              />
            </Button>
            {showHighlightPalette && (
              <div
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 1000,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 8,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(6, 26px)',
                  gap: 3,
                }}
              >
                {[
                  '#fef08a',
                  '#fde047',
                  '#facc15',
                  '#bbf7d0',
                  '#86efac',
                  '#4ade80',
                  '#bfdbfe',
                  '#93c5fd',
                  '#60a5fa',
                  '#fbcfe8',
                  '#f9a8d4',
                  '#f472b6',
                  '#fed7aa',
                  '#fdba74',
                  '#fb923c',
                  '#e9d5ff',
                  '#d8b4fe',
                  '#c084fc',
                  '#fecaca',
                  '#fca5a5',
                  '#f87171',
                  '#e2e8f0',
                  '#94a3b8',
                  '#64748b',
                ].map((color) => (
                  <Button
                    variant="ghost"
                    key={color}
                    title={color}
                    style={{
                      width: 26,
                      height: 26,
                      background: color,
                      padding: 0,
                      border: '1px solid rgba(0,0,0,0.15)',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      editor.chain().focus().setHighlight({ color }).run()
                      setShowHighlightPalette(false)
                    }}
                  />
                ))}
                <Button
                  variant="ghost"
                  title="Remove highlight"
                  style={{
                    gridColumn: '1 / -1',
                    padding: '4px 8px',
                    marginTop: 4,
                    background: 'var(--bg-hover)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    cursor: 'pointer',
                    color: 'var(--text-primary)',
                    fontSize: 11,
                    textAlign: 'center',
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    editor.chain().focus().unsetHighlight().run()
                    setShowHighlightPalette(false)
                  }}
                >
                  Remove highlight
                </Button>
              </div>
            )}
          </div>

          <span className="mx-2 h-6 w-[1px] shrink-0 bg-border" />

          {/* Alignment */}
          <Button
            variant="ghost"
            className={editor.isActive({ textAlign: 'left' }) ? 'bg-primary-light text-accent' : ''}
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            title="Align left"
          >
            <AlignLeft size={18} />
          </Button>
          <Button
            variant="ghost"
            className={
              editor.isActive({ textAlign: 'center' }) ? 'bg-primary-light text-accent' : ''
            }
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            title="Align center"
          >
            <AlignCenter size={18} />
          </Button>
          <Button
            variant="ghost"
            className={
              editor.isActive({ textAlign: 'right' }) ? 'bg-primary-light text-accent' : ''
            }
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            title="Align right"
          >
            <AlignRight size={18} />
          </Button>

          <span className="mx-2 h-6 w-[1px] shrink-0 bg-border" />

          {/* Lists */}
          <Button
            variant="icon"
            className={editor.isActive('bulletList') ? 'bg-primary-light text-accent' : ''}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet list"
          >
            <List size={18} />
          </Button>
          <Button
            variant="icon"
            className={editor.isActive('orderedList') ? 'bg-primary-light text-accent' : ''}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Ordered list"
          >
            <ListOrdered size={18} />
          </Button>

          <span className="mx-2 h-6 w-[1px] shrink-0 bg-border" />

          {/* Code */}
          <Button
            variant="icon"
            className={editor.isActive('code') ? 'bg-primary-light text-accent' : ''}
            onClick={() => editor.chain().focus().toggleCode().run()}
            title="Inline code"
          >
            <Code size={18} />
          </Button>
          <Button
            variant="icon"
            className={editor.isActive('codeBlock') ? 'bg-primary-light text-accent' : ''}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            title="Code block"
          >
            <FileCode size={18} />
          </Button>
          <Button
            variant="icon"
            className={editor.isActive('blockquote') ? 'bg-primary-light text-accent' : ''}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="Blockquote"
          >
            <Quote size={18} />
          </Button>

          <span className="mx-2 h-6 w-[1px] shrink-0 bg-border" />

          {/* Table */}
          <div style={{ position: 'relative' }}>
            <Button
              variant="icon"
              className={editor.isActive('table') ? 'bg-primary-light text-accent' : ''}
              title="Table"
              onClick={() => setShowTableMenu((v) => !v)}
              style={{ fontSize: 13 }}
            >
              <Table2 size={18} />
            </Button>
            {showTableMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: 4,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 4,
                  zIndex: 1000,
                  width: 160,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
                onMouseLeave={() => setShowTableMenu(false)}
              >
                {[
                  [
                    'Insert Table',
                    () => {
                      setPromptState({
                        type: 'table-insert',
                        defaultValue: '3,3',
                        title: 'Rows,Cols (e.g. 3,3)',
                      })
                    },
                  ],
                  ['Add Row Before', () => editor.chain().focus().addRowBefore().run()],
                  ['Add Row After', () => editor.chain().focus().addRowAfter().run()],
                  ['Delete Row', () => editor.chain().focus().deleteRow().run()],
                  ['Add Col Before', () => editor.chain().focus().addColumnBefore().run()],
                  ['Add Col After', () => editor.chain().focus().addColumnAfter().run()],
                  ['Delete Col', () => editor.chain().focus().deleteColumn().run()],
                  ['Delete Table', () => editor.chain().focus().deleteTable().run()],
                ].map(([label, action]) => (
                  <Button
                    variant="ghost"
                    key={label}
                    style={{
                      padding: '6px 10px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontSize: 12,
                      cursor: 'pointer',
                      textAlign: 'left',
                      borderRadius: 4,
                    }}
                    onMouseEnter={(e) => (e.target.style.background = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.target.style.background = 'none')}
                    onClick={() => {
                      action()
                      setShowTableMenu(false)
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <span className="mx-2 h-6 w-[1px] shrink-0 bg-border" />

          {/* Link */}
          <Button
            variant="icon"
            className={editor.isActive('link') ? 'bg-primary-light text-accent' : ''}
            onClick={handleLink}
            title="Add link"
          >
            <Link size={18} />
          </Button>
          {editor.isActive('link') && (
            <Button
              variant="icon"
              onClick={() => editor.chain().focus().unsetLink().run()}
              title="Remove link"
            >
              <Unlink size={18} />
            </Button>
          )}

          {/* Image in text */}
          <Button variant="icon" onClick={handleImage} title="Insert image in text">
            <Image size={18} />
          </Button>

          <span className="mx-2 h-6 w-[1px] shrink-0 bg-border" />

          {/* Math */}
          <Button
            variant="icon"
            title="Insert inline math ($…$)"
            onClick={() =>
              setPromptState({
                type: 'latex-inline',
                defaultValue: 'E = mc^2',
                title: 'LaTeX (inline)',
              })
            }
            style={{ fontFamily: 'serif', fontWeight: 'bold', fontSize: 18 }}
          >
            <Sigma size={18} />
          </Button>
          <Button
            variant="icon"
            title="Insert display math ($$…$$)"
            onClick={() =>
              setPromptState({
                type: 'latex-display',
                defaultValue: '\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}',
                title: 'LaTeX (display)',
              })
            }
            style={{ fontFamily: 'serif', fontWeight: 'bold', fontSize: 18 }}
          >
            <FunctionSquare size={18} />
          </Button>

          <span className="mx-2 h-6 w-[1px] shrink-0 bg-border" />

          {/* Clear formatting */}
          <Button variant="icon" onClick={handleClearFormatting} title="Clear formatting">
            <RemoveFormatting size={18} />
          </Button>
        </>
      )}

      {/* Prompt Popover */}
      {promptState && (
        <PromptPopover
          title={promptState.title}
          defaultValue={promptState.defaultValue}
          onSubmit={handlePromptSubmit}
          onCancel={() => setPromptState(null)}
          style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)' }}
        />
      )}
    </div>
  )
}

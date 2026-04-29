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

const { TEXT_COLORS = [], BG_COLORS = [], GRADIENT_PRESETS = [], isLightColor = () => false } = shared

function getBackgroundColorStyle(color) {
  return { backgroundColor: color }
}

function getBackgroundStyle(background) {
  return { background }
}

function getBackgroundImageStyle(image) {
  return { backgroundImage: `url(${image})` }
}

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
  onAddGame,
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
  const savedSelectionRef = useRef(null)
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
      if (e.target.closest?.('#bg-menu-popup')) return
      setShowBgMenu(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showBgMenu])

  function rememberSelection() {
    if (!editor) return
    const { from, to } = editor.state.selection
    savedSelectionRef.current = { from, to }
  }

  function getSelectionChain() {
    if (!editor) return null
    const selection = savedSelectionRef.current
    const maxPos = editor.state.doc.content.size
    let chain = editor.chain().focus()

    if (selection && selection.from <= maxPos && selection.to <= maxPos) {
      chain = chain.setTextSelection(selection)
    }

    return chain
  }

  function runTextCommand(command) {
    if (!editor) return
    const chain = getSelectionChain()
    if (!chain) return
    command(chain).run()
    rememberSelection()
  }

  function handleTextCommandMouseDown(command, afterRun) {
    return (e) => {
      e.preventDefault()
      rememberSelection()
      runTextCommand(command)
      afterRun?.()
    }
  }

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
      if (!value) runTextCommand((chain) => chain.unsetLink())
      else runTextCommand((chain) => chain.toggleLink({ href: value }))
    } else if (type === 'image') {
      if (value) runTextCommand((chain) => chain.setImage({ src: value }))
    } else if (type === 'latex-inline') {
      if (value) runTextCommand((chain) => chain.insertMath(value, false))
    } else if (type === 'latex-display') {
      if (value) runTextCommand((chain) => chain.insertMath(value, true))
    } else if (type === 'table-insert') {
      // value format: 'rows,cols'
      const [r, c] = value.split(',').map(Number)
      if (r > 0 && c > 0) {
        runTextCommand((chain) => chain.insertTable({ rows: r, cols: c, withHeaderRow: true }))
      }
    }
    setPromptState(null)
  }

  function handleClearFormatting() {
    runTextCommand((chain) => chain.clearNodes().unsetAllMarks())
  }

  const currentColor = editor ? editor.getAttributes('textStyle').color || '#ffffff' : '#ffffff'

  return (
    <div className="relative z-[100] w-full border-b border-border bg-panel tour-step-toolbar">
      <div className="flex min-h-14 flex-wrap items-center gap-1 px-4 py-1.5">
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
        onAddGame={onAddGame}
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
            <div className="relative">
              <Button
                variant="icon"
                className={`w-auto px-2 text-xs flex items-center gap-1 ${showBgMenu ? 'bg-primary-light text-accent' : ''}`}
                title="Slide Background"
                onClick={() => setShowBgMenu((v) => !v)}
              >
                <div
                  className="w-3.5 h-3.5 rounded-sm shrink-0 border border-white/30"
                  style={
                    bgType === 'color'
                      ? { backgroundColor: bg.color || '#1e1e2e' }
                      : bgType === 'gradient'
                        ? { background: bg.gradient || '#1e1e2e' }
                        : bgType === 'image'
                          ? { backgroundImage: `url(${bg.image})`, backgroundSize: 'cover' }
                          : { backgroundColor: '#1e1e2e' }
                  }
                />
                BG
              </Button>
              {showBgMenu && (
                <div
                  id="bg-menu-popup"
                  className="bg-popup-container absolute left-0 top-full mt-1 w-[260px] rounded-lg border border-border bg-card p-3 shadow-xl z-[1000] max-h-[80vh] overflow-y-auto"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="text-xs font-semibold text-text-primary mb-2">
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
                      <div className="flex gap-1.5 mb-2">
                        <input
                          type="color"
                          value={bg.color || '#1e1e2e'}
                          onChange={(e) => setBgColor(e.target.value)}
                          className="w-8 h-7 border border-border rounded bg-card cursor-pointer p-px"
                        />
                        <input
                          className="w-full flex-1 rounded border border-border bg-secondary px-1.5 py-1 text-xs text-text-primary focus:border-accent focus:outline-none"
                          type="text"
                          value={bg.color || '#1e1e2e'}
                          onChange={(e) => setBgColor(e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-6 gap-1">
                        {BG_COLORS.map((color) => (
                          <div
                            key={color}
                            onClick={() => setBgColor(color)}
                            title={color}
                          className={`w-full aspect-square rounded cursor-pointer ${
                            bg.color === color
                              ? 'border-2 border-white'
                              : isLightColor(color)
                                  ? 'border border-border'
                                  : 'border border-transparent'
                          }`}
                            style={getBackgroundColorStyle(color)}
                          />
                        ))}
                      </div>
                    </>
                  )}

                  {bgType === 'gradient' && (
                    <>
                      <div
                        className="h-8 rounded border border-border mb-2"
                        style={getBackgroundStyle(
                          bg.gradient || 'linear-gradient(135deg, #1e1e2e, #4a0e8f)'
                        )}
                      />
                      <input
                        className="w-full rounded border border-border bg-secondary px-1.5 py-1 mb-2 text-xs text-text-primary focus:border-accent focus:outline-none"
                        type="text"
                        value={bg.gradient || ''}
                        onChange={(e) => setBgGradient(e.target.value)}
                        placeholder="linear-gradient(...)"
                      />
                      <div className="flex flex-col gap-1">
                        {GRADIENT_PRESETS.map((preset, i) => (
                          <Button
                            variant="ghost"
                            key={i}
                            onClick={() => setBgGradient(preset)}
                            className={`h-6 rounded cursor-pointer ${
                              bg.gradient === preset
                                ? 'border-2 border-white'
                                : 'border border-border'
                            }`}
                            style={getBackgroundStyle(preset)}
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
                          className="h-[60px] rounded border border-border mb-2 bg-cover bg-center"
                          style={getBackgroundImageStyle(bg.image)}
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
                        className="w-full justify-center mb-1.5 text-[11px] px-2 py-1"
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
                        className="hidden"
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
                      <div className="flex gap-1.5">
                        <div className="flex-1">
                          <div
                            className="text-[10px] text-text-muted mb-0.5"
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
                        <div className="flex-1">
                          <div
                            className="text-[10px] text-text-muted mb-0.5"
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
                    <p className="text-[11px] text-text-muted">
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
          className="w-12 px-1.5 py-0.5 bg-card border border-border text-text-primary rounded text-xs text-center"
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
          <span className="text-[10px] text-text-muted">Align:</span>
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
              className="px-0.5 w-7 h-7"
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
            className="w-auto px-1.5 text-[11px]"
          >
            <Group size={18} />
          </Button>
          <Button
            variant="icon"
            title="Ungroup elements"
            onClick={onUngroupElements}
            className="w-auto px-1.5 text-[11px]"
          >
            <Ungroup size={18} />
          </Button>
        </>
      )}

      <span className="mx-2 h-6 w-[1px] shrink-0 bg-border" />

      {/* Hint when no text element is being edited */}
      {!editingElementId && (
        <span className="text-[11px] text-text-muted px-2">
          Double-click a text box to edit
        </span>
      )}
      </div>

      {editor && (
        <div className="flex flex-wrap items-center gap-1 border-t border-border px-4 py-1.5">
          {/* Font Family */}
          <select
            className="bg-card border border-border text-text-primary px-1.5 py-0.5 rounded text-xs max-w-[120px] cursor-pointer"
            value={editor.getAttributes('textStyle').fontFamily || ''}
            onMouseDown={() => rememberSelection()}
            onChange={(e) =>
              e.target.value
                ? runTextCommand((chain) => chain.setFontFamily(e.target.value))
                : runTextCommand((chain) => chain.unsetFontFamily())
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
            className="bg-card border border-border text-text-primary px-1.5 py-0.5 rounded text-xs w-[60px] cursor-pointer"
            value={editor.getAttributes('textStyle').fontSize || ''}
            onMouseDown={() => rememberSelection()}
            onChange={(e) =>
              e.target.value
                ? runTextCommand((chain) => chain.setFontSize(e.target.value))
                : runTextCommand((chain) => chain.unsetFontSize())
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
            onMouseDown={handleTextCommandMouseDown((chain) => chain.undo())}
            disabled={!editor.can().undo()}
            title="Undo"
          >
            <Undo2 size={18} />
          </Button>
          <Button
            variant="icon"
            onMouseDown={handleTextCommandMouseDown((chain) => chain.redo())}
            disabled={!editor.can().redo()}
            title="Redo"
          >
            <Redo2 size={18} />
          </Button>

          <span className="mx-2 h-6 w-[1px] shrink-0 bg-border" />

          {/* Headings */}
          <Button
            variant="ghost"
            className={`text-xs font-bold w-auto px-1.5 ${editor.isActive('heading', { level: 1 }) ? 'bg-primary-light text-accent' : ''}`}
            onMouseDown={handleTextCommandMouseDown((chain) => chain.toggleHeading({ level: 1 }))}
            title="Heading 1"
          >
            H1
          </Button>
          <Button
            variant="ghost"
            className={`text-xs font-bold w-auto px-1.5 ${editor.isActive('heading', { level: 2 }) ? 'bg-primary-light text-accent' : ''}`}
            onMouseDown={handleTextCommandMouseDown((chain) => chain.toggleHeading({ level: 2 }))}
            title="Heading 2"
          >
            H2
          </Button>
          <Button
            variant="ghost"
            className={`text-xs font-bold w-auto px-1.5 ${editor.isActive('heading', { level: 3 }) ? 'bg-primary-light text-accent' : ''}`}
            onMouseDown={handleTextCommandMouseDown((chain) => chain.toggleHeading({ level: 3 }))}
            title="Heading 3"
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
            onMouseDown={handleTextCommandMouseDown((chain) => chain.setParagraph())}
            title="Normal text"
          >
            <Type size={18} />
          </Button>

          <span className="mx-2 h-6 w-[1px] shrink-0 bg-border" />

          {/* Text formatting */}
          <Button
            variant="icon"
            className={editor.isActive('bold') ? 'bg-primary-light text-accent' : ''}
            onMouseDown={handleTextCommandMouseDown((chain) => chain.toggleBold())}
            title="Bold (Ctrl+B)"
          >
            <Bold size={18} />
          </Button>
          <Button
            variant="icon"
            className={editor.isActive('italic') ? 'bg-primary-light text-accent' : ''}
            onMouseDown={handleTextCommandMouseDown((chain) => chain.toggleItalic())}
            title="Italic (Ctrl+I)"
          >
            <Italic size={18} />
          </Button>
          <Button
            variant="icon"
            className={editor.isActive('underline') ? 'bg-primary-light text-accent' : ''}
            onMouseDown={handleTextCommandMouseDown((chain) => chain.toggleUnderline())}
            title="Underline (Ctrl+U)"
          >
            <Underline size={18} />
          </Button>
          <Button
            variant="icon"
            className={editor.isActive('strike') ? 'bg-primary-light text-accent' : ''}
            onMouseDown={handleTextCommandMouseDown((chain) => chain.toggleStrike())}
            title="Strikethrough"
          >
            <Strikethrough size={18} />
          </Button>

          <span className="mx-2 h-6 w-[1px] shrink-0 bg-border" />

          {/* Text color palette */}
          <div className="relative">
            <Button
              variant="icon"
              className={`relative ${showColorPalette ? 'bg-primary-light text-accent' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault()
                rememberSelection()
                setShowColorPalette((v) => !v)
              }}
              title="Text color"
              aria-expanded={showColorPalette}
              aria-haspopup="listbox"
              aria-label="Text color palette"
            >
              <Type size={18} />
              <span
                className="inline-block w-4 h-1 rounded-sm mt-0.5"
                style={getBackgroundStyle(currentColor)}
              />
            </Button>
            {showColorPalette && (
              <div
                role="listbox"
                aria-label="Text color palette"
                onMouseDown={(e) => e.stopPropagation()}
                className="absolute top-[calc(100%+4px)] left-1/2 -translate-x-1/2 z-[1000] bg-card border border-border rounded-lg p-2 shadow-xl grid grid-cols-[repeat(8,22px)] gap-[3px]"
              >
                {TEXT_COLORS.map((color) => (
                  <Button
                    variant="ghost"
                    key={color}
                    title={color}
                    role="option"
                    aria-selected={currentColor.toLowerCase() === color.toLowerCase()}
                    aria-label={`Color ${color}`}
                    className={`w-[22px] h-[22px] p-0 rounded cursor-pointer shrink-0 ${
                      currentColor.toLowerCase() === color.toLowerCase()
                        ? 'border-2 border-white'
                        : 'border border-white/[0.12]'
                    }`}
                    style={getBackgroundStyle(color)}
                    onMouseDown={handleTextCommandMouseDown(
                      (chain) => chain.setColor(color),
                      () => setShowColorPalette(false)
                    )}
                  />
                ))}
                <div
                  className="col-span-full flex items-center gap-1.5 mt-1 pt-1.5 border-t border-border"
                >
                  <span className="text-[11px] text-text-muted whitespace-nowrap">
                    Custom
                  </span>
                  <div className="flex-1">
                    <div
                      className="w-full h-[22px] rounded border border-white/[0.15] cursor-pointer"
                      style={getBackgroundStyle(currentColor)}
                    />
                    <input
                      type="color"
                      value={currentColor}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      onMouseDown={(e) => {
                        e.stopPropagation()
                        rememberSelection()
                      }}
                      onChange={(e) => runTextCommand((chain) => chain.setColor(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Highlight color palette */}
          <div className="relative">
            <Button
              variant="icon"
              className={`relative ${showHighlightPalette ? 'bg-primary-light text-accent' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault()
                rememberSelection()
                setShowHighlightPalette((v) => !v)
              }}
              title="Highlight color"
            >
              <Highlighter size={18} />
              <span
                className="inline-block w-4 h-1 rounded-sm mt-0.5 border border-white/20"
                style={getBackgroundStyle(
                  editor.getAttributes('highlight').color || 'transparent'
                )}
              />
            </Button>
            {showHighlightPalette && (
              <div
                onMouseDown={(e) => e.stopPropagation()}
                className="absolute top-[calc(100%+4px)] left-1/2 -translate-x-1/2 z-[1000] bg-card border border-border rounded-lg p-2 shadow-xl grid grid-cols-[repeat(6,26px)] gap-[3px]"
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
                    className="w-[26px] h-[26px] p-0 border border-black/[0.15] rounded cursor-pointer"
                    style={getBackgroundStyle(color)}
                    onMouseDown={handleTextCommandMouseDown(
                      (chain) => chain.setHighlight({ color }),
                      () => setShowHighlightPalette(false)
                    )}
                  />
                ))}
                <Button
                  variant="ghost"
                  title="Remove highlight"
                  className="col-span-full px-2 py-1 mt-1 bg-hover border border-border rounded cursor-pointer text-text-primary text-[11px] text-center"
                  onMouseDown={handleTextCommandMouseDown(
                    (chain) => chain.unsetHighlight(),
                    () => setShowHighlightPalette(false)
                  )}
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
            onMouseDown={handleTextCommandMouseDown((chain) => chain.setTextAlign('left'))}
            title="Align left"
          >
            <AlignLeft size={18} />
          </Button>
          <Button
            variant="ghost"
            className={
              editor.isActive({ textAlign: 'center' }) ? 'bg-primary-light text-accent' : ''
            }
            onMouseDown={handleTextCommandMouseDown((chain) => chain.setTextAlign('center'))}
            title="Align center"
          >
            <AlignCenter size={18} />
          </Button>
          <Button
            variant="ghost"
            className={
              editor.isActive({ textAlign: 'right' }) ? 'bg-primary-light text-accent' : ''
            }
            onMouseDown={handleTextCommandMouseDown((chain) => chain.setTextAlign('right'))}
            title="Align right"
          >
            <AlignRight size={18} />
          </Button>

          <span className="mx-2 h-6 w-[1px] shrink-0 bg-border" />

          {/* Lists */}
          <Button
            variant="icon"
            className={editor.isActive('bulletList') ? 'bg-primary-light text-accent' : ''}
            onMouseDown={handleTextCommandMouseDown((chain) => chain.toggleBulletList())}
            title="Bullet list"
          >
            <List size={18} />
          </Button>
          <Button
            variant="icon"
            className={editor.isActive('orderedList') ? 'bg-primary-light text-accent' : ''}
            onMouseDown={handleTextCommandMouseDown((chain) => chain.toggleOrderedList())}
            title="Ordered list"
          >
            <ListOrdered size={18} />
          </Button>

          <span className="mx-2 h-6 w-[1px] shrink-0 bg-border" />

          {/* Code */}
          <Button
            variant="icon"
            className={editor.isActive('code') ? 'bg-primary-light text-accent' : ''}
            onMouseDown={handleTextCommandMouseDown((chain) => chain.toggleCode())}
            title="Inline code"
          >
            <Code size={18} />
          </Button>
          <Button
            variant="icon"
            className={editor.isActive('codeBlock') ? 'bg-primary-light text-accent' : ''}
            onMouseDown={handleTextCommandMouseDown((chain) => chain.toggleCodeBlock())}
            title="Code block"
          >
            <FileCode size={18} />
          </Button>
          <Button
            variant="icon"
            className={editor.isActive('blockquote') ? 'bg-primary-light text-accent' : ''}
            onMouseDown={handleTextCommandMouseDown((chain) => chain.toggleBlockquote())}
            title="Blockquote"
          >
            <Quote size={18} />
          </Button>

          <span className="mx-2 h-6 w-[1px] shrink-0 bg-border" />

          {/* Table */}
          <div className="relative">
            <Button
              variant="icon"
              className={`text-[13px] ${editor.isActive('table') ? 'bg-primary-light text-accent' : ''}`}
              title="Table"
              onMouseDown={(e) => {
                e.preventDefault()
                rememberSelection()
                setShowTableMenu((v) => !v)
              }}
            >
              <Table2 size={18} />
            </Button>
            {showTableMenu && (
              <div
                className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg p-1 z-[1000] w-40 flex flex-col gap-0.5"
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
                    false,
                  ],
                  ['Add Row Before', (chain) => chain.addRowBefore(), true],
                  ['Add Row After', (chain) => chain.addRowAfter(), true],
                  ['Delete Row', (chain) => chain.deleteRow(), true],
                  ['Add Col Before', (chain) => chain.addColumnBefore(), true],
                  ['Add Col After', (chain) => chain.addColumnAfter(), true],
                  ['Delete Col', (chain) => chain.deleteColumn(), true],
                  ['Delete Table', (chain) => chain.deleteTable(), true],
                ].map(([label, action, isTextCommand]) => (
                  <Button
                    variant="ghost"
                    key={label}
                    className="px-2.5 py-1.5 bg-transparent border-none text-text-primary text-xs cursor-pointer text-left rounded"
                    onMouseEnter={(e) => (e.target.style.background = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.target.style.background = 'none')}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      rememberSelection()
                      if (isTextCommand) runTextCommand(action)
                      else action()
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
            onMouseDown={(e) => {
              e.preventDefault()
              rememberSelection()
              handleLink()
            }}
            title="Add link"
          >
            <Link size={18} />
          </Button>
          {editor.isActive('link') && (
            <Button
              variant="icon"
              onMouseDown={handleTextCommandMouseDown((chain) => chain.unsetLink())}
              title="Remove link"
            >
              <Unlink size={18} />
            </Button>
          )}

          {/* Image in text */}
          <Button
            variant="icon"
            onMouseDown={(e) => {
              e.preventDefault()
              rememberSelection()
              handleImage()
            }}
            title="Insert image in text"
          >
            <Image size={18} />
          </Button>

          <span className="mx-2 h-6 w-[1px] shrink-0 bg-border" />

          {/* Math */}
          <Button
            variant="icon"
            title="Insert inline math ($…$)"
            onMouseDown={(e) => {
              e.preventDefault()
              rememberSelection()
              setPromptState({
                type: 'latex-inline',
                defaultValue: 'E = mc^2',
                title: 'LaTeX (inline)',
              })
            }}
            className="font-serif font-bold text-lg"
          >
            <Sigma size={18} />
          </Button>
          <Button
            variant="icon"
            title="Insert display math ($$…$$)"
            onMouseDown={(e) => {
              e.preventDefault()
              rememberSelection()
              setPromptState({
                type: 'latex-display',
                defaultValue: '\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}',
                title: 'LaTeX (display)',
              })
            }}
            className="font-serif font-bold text-lg"
          >
            <FunctionSquare size={18} />
          </Button>

          <span className="mx-2 h-6 w-[1px] shrink-0 bg-border" />

          {/* Clear formatting */}
          <Button
            variant="icon"
            onMouseDown={(e) => {
              e.preventDefault()
              rememberSelection()
              handleClearFormatting()
            }}
            title="Clear formatting"
          >
            <RemoveFormatting size={18} />
          </Button>
        </div>
      )}

      {/* Prompt Popover */}
      {promptState && (
        <PromptPopover
          title={promptState.title}
          defaultValue={promptState.defaultValue}
          onSubmit={handlePromptSubmit}
          onCancel={() => setPromptState(null)}
          className="fixed top-20 left-1/2 -translate-x-1/2"
        />
      )}
    </div>
  )
}

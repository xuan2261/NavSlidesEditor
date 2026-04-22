import { useState, useEffect, useRef } from 'react'
import PromptPopover from './PromptPopover'
import {
  Plus,
  Type,
  Image as ImageIcon,
  Upload,
  FileCode,
  Code,
  Video,
  Music,
  Table2,
  Shapes,
  ChevronRight,
  FolderOpen,
  Pencil,
  ArrowUpRight,
  BarChart3,
  QrCode,
  Minus,
} from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import * as shared from 'revealjs-shared'
const { SHAPES } = shared

// Dynamic Lucide icon list — all named exports that are React components
const ICON_NAMES = Object.keys(LucideIcons)
  .filter((name) => /^[A-Z]/.test(name)) // PascalCase = component
  .filter(
    (name) =>
      ![
        'createContext',
        'useCallback',
        'useContext',
        'useEffect',
        'useMemo',
        'useRef',
        'useState',
        'useReducer',
        'createElement',
        'forwardRef',
        'lazy',
        'memo',
        'Suspense',
        'Fragment',
      ].includes(name)
  )

export default function InsertMenu({
  onAddText,
  onAddImage,
  onAddImageUpload,
  onAddHtmlElement,
  onAddCodeElement,
  onAddLatexElement,
  onAddMarkdownElement,
  onAddChart,
  onAddVideo,
  onAddAudio,
  onOpenMediaLibrary,
  onAddShape,
  onAddLine,
  onAddSvgElement,
  onAddIcon,
  onAddCallout,
  onAddTable,
  onAddDrawing,
  onAddQrCode,
  onAddDivider,
}) {
  const [open, setOpen] = useState(false)
  const [subMenu, setSubMenu] = useState(null) // 'shape' | 'icon'
  const [iconSearch, setIconSearch] = useState('')
  const [iconPage, setIconPage] = useState(1)
  const ICON_PAGE_SIZE = 20
  const [tableSize, setTableSize] = useState({ r: 0, c: 0 })
  const [videoPrompt, setVideoPrompt] = useState(false)
  const menuRef = useRef(null)
  const fileRef = useRef(null)
  const svgRef = useRef(null)
  const mediaRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false)
        setSubMenu(null)
      }
    }
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setSubMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open])

  const doAction = (fn, ...args) => {
    fn?.(...args)
    setOpen(false)
    setSubMenu(null)
  }

  return (
    <div className="insert-menu relative" ref={menuRef}>
      <button
        className={`insert-trigger inline-flex cursor-pointer items-center gap-1.5 rounded-sm bg-accent px-3 py-1.5 text-[13px] font-medium text-white transition-all hover:bg-accent-hover ${open ? 'bg-accent-hover' : ''}`}
        onClick={() => {
          setOpen((v) => !v)
          setSubMenu(null)
        }}
      >
        <Plus size={14} /> Insert
      </button>

      {open && (
        <div className="insert-dropdown absolute left-0 top-[calc(100%+4px)] z-[110] max-h-[520px] w-[240px] overflow-y-auto rounded-md border border-border-strong bg-card p-1 shadow-xl">
          {/* BASIC */}
          <div className="insert-category mt-1 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Basic
          </div>
          <button
            className="insert-item flex w-full cursor-pointer items-center gap-2.5 rounded px-3 py-2 text-left text-[13px] text-text-primary transition-colors hover:bg-hover"
            onClick={() => doAction(onAddText)}
          >
            <Type size={15} /> <span>Text</span>
          </button>
          <button
            className="insert-item flex w-full cursor-pointer items-center gap-2.5 rounded px-3 py-2 text-left text-[13px] text-text-primary transition-colors hover:bg-hover"
            onClick={() => doAction(onAddImage)}
          >
            <ImageIcon size={15} /> <span>Image (URL)</span>
          </button>
          <button
            className="insert-item flex w-full cursor-pointer items-center gap-2.5 rounded px-3 py-2 text-left text-[13px] text-text-primary transition-colors hover:bg-hover"
            onClick={() => {
              fileRef.current?.click()
            }}
          >
            <Upload size={15} /> <span>Upload Image</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) {
                onAddImageUpload?.(f)
                setOpen(false)
                setSubMenu(null)
              }
              e.target.value = ''
            }}
          />

          <div className="insert-separator my-1 h-[1px] bg-border-light" />

          {/* CONTENT */}
          <div className="insert-category mt-1 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Content
          </div>
          <button
            className="insert-item flex w-full cursor-pointer items-center gap-2.5 rounded px-3 py-2 text-left text-[13px] text-text-primary transition-colors hover:bg-hover"
            onClick={() => doAction(onAddHtmlElement)}
          >
            <FileCode size={15} /> <span>Embed HTML</span>
          </button>
          <button
            className="insert-item flex w-full cursor-pointer items-center gap-2.5 rounded px-3 py-2 text-left text-[13px] text-text-primary transition-colors hover:bg-hover"
            onClick={() => doAction(onAddQrCode)}
          >
            <QrCode size={15} /> <span>QR Code</span>
          </button>
          <button
            className="insert-item flex w-full cursor-pointer items-center gap-2.5 rounded px-3 py-2 text-left text-[13px] text-text-primary transition-colors hover:bg-hover"
            onClick={() => doAction(onAddCodeElement)}
          >
            <Code size={15} /> <span>Code Block</span>
          </button>
          <button
            className="insert-item flex w-full cursor-pointer items-center gap-2.5 rounded px-3 py-2 text-left text-[13px] text-text-primary transition-colors hover:bg-hover"
            onClick={() => doAction(onAddLatexElement)}
          >
            <span
              style={{
                fontSize: 14,
                fontFamily: 'serif',
                fontWeight: 700,
                width: 15,
                textAlign: 'center',
                flexShrink: 0,
              }}
            >
              T<sub style={{ fontSize: 9 }}>E</sub>X
            </span>
            <span>LaTeX / TikZ</span>
          </button>
          <button
            className="insert-item flex w-full cursor-pointer items-center gap-2.5 rounded px-3 py-2 text-left text-[13px] text-text-primary transition-colors hover:bg-hover"
            onClick={() => doAction(onAddMarkdownElement)}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                width: 15,
                textAlign: 'center',
                flexShrink: 0,
              }}
            >
              M↓
            </span>
            <span>Markdown</span>
          </button>
          <button
            className="insert-item flex w-full cursor-pointer items-center gap-2.5 rounded px-3 py-2 text-left text-[13px] text-text-primary transition-colors hover:bg-hover"
            onClick={() => doAction(onAddChart)}
          >
            <BarChart3 size={15} /> <span>Chart</span>
          </button>

          <div className="insert-separator my-1 h-[1px] bg-border-light" />

          {/* MEDIA */}
          <div className="insert-category mt-1 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Media
          </div>
          <button
            className="insert-item flex w-full cursor-pointer items-center gap-2.5 rounded px-3 py-2 text-left text-[13px] text-text-primary transition-colors hover:bg-hover"
            onClick={() => setVideoPrompt(true)}
          >
            <Video size={15} /> <span>Video</span>
          </button>
          <button
            className="insert-item flex w-full cursor-pointer items-center gap-2.5 rounded px-3 py-2 text-left text-[13px] text-text-primary transition-colors hover:bg-hover"
            onClick={() => mediaRef.current?.click()}
          >
            <Music size={15} /> <span>Audio / Upload</span>
          </button>
          <input
            ref={mediaRef}
            type="file"
            accept="audio/*,video/*"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              e.target.value = ''
              const fd = new FormData()
              fd.append('file', f)
              const res = await fetch('/api/upload', { method: 'POST', body: fd }).then((r) =>
                r.json()
              )
              if (res.url) {
                if (f.type.startsWith('video/')) onAddVideo?.(res.url)
                else onAddAudio?.(res.url)
              }
              setOpen(false)
              setSubMenu(null)
            }}
          />
          <button
            className="insert-item flex w-full cursor-pointer items-center gap-2.5 rounded px-3 py-2 text-left text-[13px] text-text-primary transition-colors hover:bg-hover"
            onClick={() => doAction(onOpenMediaLibrary)}
          >
            <FolderOpen size={15} /> <span>Media Library</span>
          </button>

          <div className="insert-separator my-1 h-[1px] bg-border-light" />

          {/* SHAPES & LINES */}
          <div className="insert-category mt-1 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Shapes & Lines
          </div>
          <button
            className="insert-item flex w-full cursor-pointer items-center gap-2.5 rounded px-3 py-2 text-left text-[13px] text-text-primary transition-colors hover:bg-hover"
            onMouseEnter={() => setSubMenu('shape')}
            onClick={() => setSubMenu(subMenu === 'shape' ? null : 'shape')}
          >
            <Shapes size={15} /> <span>Shape</span>
            <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.4 }} />
          </button>
          {subMenu === 'shape' && (
            <div className="insert-sub-panel shape-picker-grid absolute left-full top-[50%] ml-1 grid w-[200px] grid-cols-4 gap-1 rounded-md border border-border-strong bg-card p-2 shadow-xl z-[120]">
              {SHAPES.map((s) => (
                <button
                  key={s.id}
                  title={s.name}
                  className="shape-pick-btn p-1.5 rounded-md hover:bg-hover text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center"
                  onClick={() => doAction(onAddShape, s.id)}
                >
                  <span>{s.icon}</span>
                  <span style={{ fontSize: 8 }}>{s.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          )}
          <button
            className="insert-item flex w-full cursor-pointer items-center gap-2.5 rounded px-3 py-2 text-left text-[13px] text-text-primary transition-colors hover:bg-hover"
            onClick={() => doAction(onAddLine)}
          >
            <ArrowUpRight size={15} /> <span>Line / Arrow</span>
          </button>
          <button
            className="insert-item flex w-full cursor-pointer items-center gap-2.5 rounded px-3 py-2 text-left text-[13px] text-text-primary transition-colors hover:bg-hover"
            onClick={() => svgRef.current?.click()}
          >
            <span style={{ fontSize: 13, width: 15, textAlign: 'center', flexShrink: 0 }}>◇</span>
            <span>SVG</span>
          </button>
          <input
            ref={svgRef}
            type="file"
            accept=".svg,image/svg+xml"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) return
              e.target.value = ''
              const reader = new FileReader()
              reader.onload = (ev) => onAddSvgElement?.(ev.target.result)
              reader.readAsText(f)
              setOpen(false)
              setSubMenu(null)
            }}
          />
          <button
            className="insert-item flex w-full cursor-pointer items-center gap-2.5 rounded px-3 py-2 text-left text-[13px] text-text-primary transition-colors hover:bg-hover"
            onMouseEnter={() => setSubMenu('icon')}
            onClick={() => setSubMenu(subMenu === 'icon' ? null : 'icon')}
          >
            <span style={{ fontSize: 14, width: 15, textAlign: 'center', flexShrink: 0 }}>★</span>
            <span>Icon</span>
            <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.4 }} />
          </button>
          {subMenu === 'icon' && (
            <div className="absolute left-full top-[50%] ml-1 w-[280px] rounded-md border border-border-strong bg-card p-2 shadow-xl z-[120] flex flex-col gap-2 max-h-[400px] overflow-y-auto">
              <input
                type="text"
                placeholder="Search icons..."
                value={iconSearch}
                onChange={(e) => {
                  setIconSearch(e.target.value)
                  setIconPage(1)
                }}
                className="w-full rounded border border-border-strong bg-secondary px-2 py-1 text-xs text-text-primary focus:border-accent focus:outline-none mb-2"
                autoFocus
              />
              <div className="grid grid-cols-5 gap-1">
                {ICON_NAMES.filter(
                  (n) => !iconSearch || n.toLowerCase().includes(iconSearch.toLowerCase())
                )
                  .slice(0, iconPage * ICON_PAGE_SIZE)
                  .map((name) => {
                    const IconComp = LucideIcons[name]
                    return (
                      <button
                        key={name}
                        title={name}
                        className="p-1.5 rounded-md hover:bg-hover text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center"
                        onClick={() => {
                          doAction(onAddIcon, name)
                          setIconSearch('')
                        }}
                      >
                        {IconComp ? <IconComp size={14} /> : name.slice(0, 3)}
                      </button>
                    )
                  })}
              </div>
              {(() => {
                const total = ICON_NAMES.filter(
                  (n) => !iconSearch || n.toLowerCase().includes(iconSearch.toLowerCase())
                ).length
                const shown = iconPage * ICON_PAGE_SIZE
                if (shown >= total) return null
                return (
                  <button
                    className="w-full rounded bg-secondary py-1.5 mt-2 text-center text-xs font-medium text-text-secondary hover:bg-hover hover:text-text-primary transition-colors"
                    onClick={() => setIconPage((p) => p + 1)}
                  >
                    +{Math.min(ICON_PAGE_SIZE, total - shown)} more ({total - shown} left)
                  </button>
                )
              })()}
            </div>
          )}
          <button
            className="insert-item flex w-full cursor-pointer items-center gap-2.5 rounded px-3 py-2 text-left text-[13px] text-text-primary transition-colors hover:bg-hover"
            onClick={() => doAction(onAddCallout)}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 15,
                height: 15,
                borderRadius: '50%',
                background: '#ef4444',
                color: 'white',
                fontSize: 9,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              1
            </span>
            <span>Callout</span>
          </button>

          <div className="insert-separator my-1 h-[1px] bg-border-light" />

          {/* LAYOUT */}
          <div className="insert-category mt-1 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Layout
          </div>
          <button
            className="insert-item flex w-full cursor-pointer items-center gap-2.5 rounded px-3 py-2 text-left text-[13px] text-text-primary transition-colors hover:bg-hover"
            onClick={() => doAction(onAddDivider)}
          >
            <Minus size={15} /> <span>Divider</span>
          </button>
          <div
            className="insert-item flex w-full cursor-pointer items-center gap-2.5 rounded px-3 py-2 text-left text-[13px] text-text-primary transition-colors hover:bg-hover"
            style={{ cursor: 'default', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}
            onMouseEnter={() => setSubMenu('table')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Table2 size={15} /> <span>Table</span>
            </div>
            {subMenu === 'table' && (
              <div className="table-size-picker pt-1" onClick={(e) => e.stopPropagation()}>
                <div className="table-size-label mb-1.5 text-center text-[11px] font-medium text-text-secondary">
                  {tableSize.r > 0 ? `${tableSize.r} × ${tableSize.c}` : 'Select size'}
                </div>
                <div className="table-size-grid grid grid-cols-8 gap-[2px]">
                  {Array.from({ length: 8 }, (_, r) =>
                    Array.from({ length: 8 }, (_, c) => (
                      <div
                        key={`${r}-${c}`}
                        className={`table-cell h-[18px] w-[18px] cursor-pointer rounded-sm border transition-all duration-75 hover:border-accent ${r < tableSize.r && c < tableSize.c ? 'border-accent bg-accent' : 'border-border-strong'}`}
                        onMouseEnter={() => setTableSize({ r: r + 1, c: c + 1 })}
                        onClick={() => {
                          onAddTable?.(tableSize.r, tableSize.c)
                          setOpen(false)
                          setSubMenu(null)
                          setTableSize({ r: 0, c: 0 })
                        }}
                      />
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <button
            className="insert-item flex w-full cursor-pointer items-center gap-2.5 rounded px-3 py-2 text-left text-[13px] text-text-primary transition-colors hover:bg-hover"
            onClick={() => doAction(onAddDrawing)}
          >
            <Pencil size={15} /> <span>Drawing Canvas</span>
          </button>
        </div>
      )}
      {videoPrompt && (
        <PromptPopover
          title="Video URL"
          defaultValue=""
          placeholder="https://..."
          onSubmit={(url) => {
            onAddVideo?.(url)
            setVideoPrompt(false)
            setOpen(false)
            setSubMenu(null)
          }}
          onCancel={() => setVideoPrompt(false)}
          style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)' }}
        />
      )}
    </div>
  )
}

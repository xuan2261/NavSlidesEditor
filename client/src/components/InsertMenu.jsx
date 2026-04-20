import { useState, useEffect, useRef } from 'react'
import PromptPopover from './PromptPopover'
import {
  Plus, Type, Image as ImageIcon, Upload, FileCode, Code,
  Video, Music, Table2, Shapes, ChevronRight, FolderOpen,
  Pencil, ArrowUpRight, BarChart3, QrCode, Minus
} from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import * as shared from 'revealjs-shared'
const { SHAPES } = shared

// Dynamic Lucide icon list — all named exports that are React components
const ICON_NAMES = Object.keys(LucideIcons)
  .filter((name) => /^[A-Z]/.test(name)) // PascalCase = component
  .filter((name) => !['createContext', 'useCallback', 'useContext', 'useEffect',
    'useMemo', 'useRef', 'useState', 'useReducer', 'createElement',
    'forwardRef', 'lazy', 'memo', 'Suspense', 'Fragment'].includes(name))

export default function InsertMenu({
  onAddText, onAddImage, onAddImageUpload, onAddHtmlElement,
  onAddCodeElement, onAddLatexElement, onAddMarkdownElement,
  onAddChart, onAddVideo, onAddAudio, onOpenMediaLibrary,
  onAddShape, onAddLine, onAddSvgElement, onAddIcon,
  onAddCallout, onAddTable, onAddDrawing,
  onAddQrCode, onAddDivider,
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
      if (e.key === 'Escape') { setOpen(false); setSubMenu(null) }
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
    <div className="insert-menu" ref={menuRef}>
      <button
        className={`insert-trigger ${open ? 'open' : ''}`}
        onClick={() => { setOpen((v) => !v); setSubMenu(null) }}
      >
        <Plus size={14} /> Insert
      </button>

      {open && (
        <div className="insert-dropdown">
          {/* BASIC */}
          <div className="insert-category">Basic</div>
          <button className="insert-item" onClick={() => doAction(onAddText)}>
            <Type size={15} /> <span>Text</span>
          </button>
          <button className="insert-item" onClick={() => doAction(onAddImage)}>
            <ImageIcon size={15} /> <span>Image (URL)</span>
          </button>
          <button className="insert-item" onClick={() => {
            fileRef.current?.click()
          }}>
            <Upload size={15} /> <span>Upload Image</span>
          </button>
          <input
            ref={fileRef} type="file" accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) { onAddImageUpload?.(f); setOpen(false); setSubMenu(null) }
              e.target.value = ''
            }}
          />

          <div className="insert-separator" />

          {/* CONTENT */}
          <div className="insert-category">Content</div>
          <button className="insert-item" onClick={() => doAction(onAddHtmlElement)}>
            <FileCode size={15} /> <span>Embed HTML</span>
          </button>
          <button className="insert-item" onClick={() => doAction(onAddQrCode)}>
            <QrCode size={15} /> <span>QR Code</span>
          </button>
          <button className="insert-item" onClick={() => doAction(onAddCodeElement)}>
            <Code size={15} /> <span>Code Block</span>
          </button>
          <button className="insert-item" onClick={() => doAction(onAddLatexElement)}>
            <span style={{ fontSize: 14, fontFamily: 'serif', fontWeight: 700, width: 15, textAlign: 'center', flexShrink: 0 }}>
              T<sub style={{ fontSize: 9 }}>E</sub>X
            </span>
            <span>LaTeX / TikZ</span>
          </button>
          <button className="insert-item" onClick={() => doAction(onAddMarkdownElement)}>
            <span style={{ fontSize: 13, fontWeight: 700, width: 15, textAlign: 'center', flexShrink: 0 }}>M↓</span>
            <span>Markdown</span>
          </button>
          <button className="insert-item" onClick={() => doAction(onAddChart)}>
            <BarChart3 size={15} /> <span>Chart</span>
          </button>

          <div className="insert-separator" />

          {/* MEDIA */}
          <div className="insert-category">Media</div>
          <button className="insert-item" onClick={() => setVideoPrompt(true)}>
            <Video size={15} /> <span>Video</span>
          </button>
          <button className="insert-item" onClick={() => mediaRef.current?.click()}>
            <Music size={15} /> <span>Audio / Upload</span>
          </button>
          <input
            ref={mediaRef} type="file" accept="audio/*,video/*"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              e.target.value = ''
              const fd = new FormData()
              fd.append('file', f)
              const res = await fetch('/api/upload', { method: 'POST', body: fd }).then((r) => r.json())
              if (res.url) {
                if (f.type.startsWith('video/')) onAddVideo?.(res.url)
                else onAddAudio?.(res.url)
              }
              setOpen(false); setSubMenu(null)
            }}
          />
          <button className="insert-item" onClick={() => doAction(onOpenMediaLibrary)}>
            <FolderOpen size={15} /> <span>Media Library</span>
          </button>

          <div className="insert-separator" />

          {/* SHAPES & LINES */}
          <div className="insert-category">Shapes & Lines</div>
          <button
            className="insert-item"
            onMouseEnter={() => setSubMenu('shape')}
            onClick={() => setSubMenu(subMenu === 'shape' ? null : 'shape')}
          >
            <Shapes size={15} /> <span>Shape</span>
            <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.4 }} />
          </button>
          {subMenu === 'shape' && (
            <div className="insert-sub-panel shape-picker-grid">
              {SHAPES.map((s) => (
                <button
                  key={s.id} title={s.name}
                  className="shape-pick-btn"
                  onClick={() => doAction(onAddShape, s.id)}
                >
                  <span>{s.icon}</span>
                  <span style={{ fontSize: 8 }}>{s.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          )}
          <button className="insert-item" onClick={() => doAction(onAddLine)}>
            <ArrowUpRight size={15} /> <span>Line / Arrow</span>
          </button>
          <button className="insert-item" onClick={() => svgRef.current?.click()}>
            <span style={{ fontSize: 13, width: 15, textAlign: 'center', flexShrink: 0 }}>◇</span>
            <span>SVG</span>
          </button>
          <input
            ref={svgRef} type="file" accept=".svg,image/svg+xml"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) return
              e.target.value = ''
              const reader = new FileReader()
              reader.onload = (ev) => onAddSvgElement?.(ev.target.result)
              reader.readAsText(f)
              setOpen(false); setSubMenu(null)
            }}
          />
          <button
            className="insert-item"
            onMouseEnter={() => setSubMenu('icon')}
            onClick={() => setSubMenu(subMenu === 'icon' ? null : 'icon')}
          >
            <span style={{ fontSize: 14, width: 15, textAlign: 'center', flexShrink: 0 }}>★</span>
            <span>Icon</span>
            <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.4 }} />
          </button>
          {subMenu === 'icon' && (
            <div className="insert-sub-panel icon-picker-panel">
              <input
                type="text" placeholder="Search icons..."
                value={iconSearch} onChange={(e) => { setIconSearch(e.target.value); setIconPage(1) }}
                className="icon-search-input" autoFocus
              />
              <div className="icon-grid">
                {ICON_NAMES
                  .filter((n) => !iconSearch || n.toLowerCase().includes(iconSearch.toLowerCase()))
                  .slice(0, iconPage * ICON_PAGE_SIZE)
                  .map((name) => {
                    const IconComp = LucideIcons[name]
                    return (
                      <button
                        key={name} title={name} className="icon-pick-btn"
                        onClick={() => { doAction(onAddIcon, name); setIconSearch('') }}
                      >
                        {IconComp ? <IconComp size={14} /> : name.slice(0, 3)}
                      </button>
                    )
                  })}
              </div>
              {(() => {
                const total = ICON_NAMES.filter((n) => !iconSearch || n.toLowerCase().includes(iconSearch.toLowerCase())).length
                const shown = iconPage * ICON_PAGE_SIZE
                if (shown >= total) return null
                return (
                  <button
                    className="icon-show-more"
                    onClick={() => setIconPage((p) => p + 1)}
                  >
                    +{Math.min(ICON_PAGE_SIZE, total - shown)} more ({total - shown} left)
                  </button>
                )
              })()}
            </div>
          )}
          <button className="insert-item" onClick={() => doAction(onAddCallout)}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 15, height: 15, borderRadius: '50%', background: '#ef4444',
              color: 'white', fontSize: 9, fontWeight: 700, flexShrink: 0,
            }}>1</span>
            <span>Callout</span>
          </button>

          <div className="insert-separator" />

          {/* LAYOUT */}
          <div className="insert-category">Layout</div>
          <button className="insert-item" onClick={() => doAction(onAddDivider)}>
            <Minus size={15} /> <span>Divider</span>
          </button>
          <div
            className="insert-item"
            style={{ cursor: 'default', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}
            onMouseEnter={() => setSubMenu('table')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Table2 size={15} /> <span>Table</span>
            </div>
            {subMenu === 'table' && (
              <div className="table-size-picker" onClick={(e) => e.stopPropagation()}>
                <div className="table-size-label">
                  {tableSize.r > 0 ? `${tableSize.r} × ${tableSize.c}` : 'Select size'}
                </div>
                <div className="table-size-grid">
                  {Array.from({ length: 8 }, (_, r) =>
                    Array.from({ length: 8 }, (_, c) => (
                      <div
                        key={`${r}-${c}`}
                        className={`table-cell ${r < tableSize.r && c < tableSize.c ? 'active' : ''}`}
                        onMouseEnter={() => setTableSize({ r: r + 1, c: c + 1 })}
                        onClick={() => {
                          onAddTable?.(tableSize.r, tableSize.c)
                          setOpen(false); setSubMenu(null)
                          setTableSize({ r: 0, c: 0 })
                        }}
                      />
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <button className="insert-item" onClick={() => doAction(onAddDrawing)}>
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

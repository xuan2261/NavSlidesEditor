import { useState, useEffect, useRef } from 'react'
import PromptPopover from './PromptPopover'
import {
  // ── Menu items (used directly in JSX) ──
  Plus, Type, Image as ImageIcon, Upload, FileCode, Code, Video, Music, Table2,
  Shapes, ChevronRight, FolderOpen, Pencil, ArrowUpRight, BarChart3, QrCode,
  Minus, Sigma,
  // ── Icon picker catalog (~100 curated icons) ──
  Search, Settings, Bell, Bookmark, Calendar, Camera, Check, CheckCircle,
  ChevronDown, ChevronLeft, ChevronUp, Circle, Clock, Cloud,
  Copy, Download, Edit, Eye, EyeOff, Globe, Hash, Heart, Home, Info,
  Layers, Layout, Link, Lock, Mail, MapPin, Menu, MessageSquare,
  MinusCircle, MoreHorizontal, MoreVertical, Move, Package, Palette, Pause,
  Play, PlayCircle, PlusCircle, Power, RefreshCw, Repeat, RotateCcw,
  RotateCw, Save, Send, Settings2, Share2, Shield, ShoppingCart,
  Sidebar, Star, Sun, Tag, Target, Thermometer, ThumbsUp, ToggleLeft,
  ToggleRight, Trash2, TrendingUp, Truck, Umbrella, Unlock,
  User, Users, Volume2, VolumeX, Wifi, Wind, X, XCircle, Zap,
  ZoomIn, ZoomOut, File, Folder, FileText, CreditCard, DollarSign, Award,
  Flag, ExternalLink, Maximize, Minimize, PlusSquare, Shuffle, SkipBack,
  SkipForward, Square, Triangle, Hexagon, Pentagon, Octagon, Command,
  Crosshair, Feather, Crown, Gem, Flame, Leaf, Moon, Sunrise, Sunset,
} from 'lucide-react'
import * as shared from 'revealjs-shared'
const { SHAPES = [] } = shared

// Curated subset (~100) — avoids importing entire ~1000-icon lucide-react bundle
const ICON_CATALOG = [
  'Search', 'Settings', 'Bell', 'Bookmark', 'Calendar', 'Camera', 'Check', 'CheckCircle',
  'ChevronDown', 'ChevronLeft', 'ChevronRight', 'ChevronUp', 'Circle', 'Clock', 'Cloud',
  'Copy', 'Download', 'Edit', 'Eye', 'EyeOff', 'Globe', 'Hash', 'Heart', 'Home', 'Info',
  'Layers', 'Layout', 'Link', 'Lock', 'Mail', 'MapPin', 'Menu', 'MessageSquare',
  'MinusCircle', 'MoreHorizontal', 'MoreVertical', 'Move', 'Package', 'Palette', 'Pause',
  'Play', 'PlayCircle', 'PlusCircle', 'Power', 'RefreshCw', 'Repeat', 'RotateCcw',
  'RotateCw', 'Save', 'Send', 'Settings2', 'Share2', 'Shield', 'ShoppingCart',
  'Sidebar', 'Star', 'Sun', 'Tag', 'Target', 'Thermometer', 'ThumbsUp', 'ToggleLeft',
  'ToggleRight', 'Trash2', 'TrendingUp', 'Truck', 'Umbrella', 'Unlock', 'User', 'Users',
  'Volume2', 'VolumeX', 'Wifi', 'Wind', 'X', 'XCircle', 'Zap', 'ZoomIn', 'ZoomOut',
  'File', 'Folder', 'FileText', 'CreditCard', 'DollarSign', 'Award', 'Flag',
  'ExternalLink', 'Maximize', 'Minimize', 'PlusSquare', 'Shuffle', 'SkipBack',
  'SkipForward', 'Square', 'Triangle', 'Hexagon', 'Pentagon', 'Octagon', 'Command',
  'Crosshair', 'Feather', 'Crown', 'Gem', 'Flame', 'Leaf', 'Moon', 'Sunrise', 'Sunset',
]

// Icon map: name → component (used by icon picker grid renderer)
const ICON_MAP = {
  Search, Settings, Bell, Bookmark, Calendar, Camera, Check, CheckCircle,
  ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Circle, Clock, Cloud,
  Copy, Download, Edit, Eye, EyeOff, Globe, Hash, Heart, Home, Info,
  Layers, Layout, Link, Lock, Mail, MapPin, Menu, MessageSquare,
  MinusCircle, MoreHorizontal, MoreVertical, Move, Package, Palette, Pause,
  Play, PlayCircle, PlusCircle, Power, RefreshCw, Repeat, RotateCcw,
  RotateCw, Save, Send, Settings2, Share2, Shield, ShoppingCart,
  Sidebar, Star, Sun, Tag, Target, Thermometer, ThumbsUp, ToggleLeft,
  ToggleRight, Trash2, TrendingUp, Truck, Umbrella, Unlock, User, Users,
  Volume2, VolumeX, Wifi, Wind, X, XCircle, Zap, ZoomIn, ZoomOut,
  File, Folder, FileText, CreditCard, DollarSign, Award, Flag,
  ExternalLink, Maximize, Minimize, PlusSquare, Shuffle, SkipBack,
  SkipForward, Square, Triangle, Hexagon, Pentagon, Octagon, Command,
  Crosshair, Feather, Crown, Gem, Flame, Leaf, Moon, Sunrise, Sunset,
}
const ICON_NAMES = ICON_CATALOG

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
  onAddGame,
}) {
  const [open, setOpen] = useState(false)
  const [subMenu, setSubMenu] = useState(null) // 'shape' | 'icon'
  const [iconSearch, setIconSearch] = useState('')
  const [iconPage, setIconPage] = useState(1)
  const ICON_PAGE_SIZE = 20
  const [tableSize, setTableSize] = useState({ r: 0, c: 0 })
  const [videoPrompt, setVideoPrompt] = useState(false)
  const [uploadError, setUploadError] = useState(null)
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
        <div className="insert-dropdown absolute left-0 top-[calc(100%+4px)] z-[110] w-[240px] overflow-visible rounded-md border border-border-strong bg-card p-1 shadow-xl">
          <div className="overflow-y-auto max-h-[520px] w-full flex flex-col">
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
            className="hidden"
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

          <div className="insert-separator my-1 h-[1px] bg-border" />

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
            <Sigma size={15} />
            <span>LaTeX / TikZ</span>
          </button>
          <button
            className="insert-item flex w-full cursor-pointer items-center gap-2.5 rounded px-3 py-2 text-left text-[13px] text-text-primary transition-colors hover:bg-hover"
            onClick={() => doAction(onAddMarkdownElement)}
          >
            <span className="text-[13px] font-bold w-[15px] text-center shrink-0">
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

          <div className="insert-separator my-1 h-[1px] bg-border" />

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
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              e.target.value = ''
              const fd = new FormData()
              fd.append('file', f)
              try {
                const res = await fetch('/api/upload', { method: 'POST', body: fd })
                const data = await res.json()
                if (!res.ok || !data.url) {
                  console.error('Upload failed:', data.error || `HTTP ${res.status}`)
                  setUploadError(data.error || 'Upload failed')
                  return
                }
                if (f.type.startsWith('video/')) onAddVideo?.(data.url)
                else onAddAudio?.(data.url)
              } catch (err) {
                console.error('Upload failed:', err)
                setUploadError('Upload failed. Check your connection.')
              } finally {
                setOpen(false)
                setSubMenu(null)
              }
            }}
          />
          {uploadError && (
            <div className="mx-3 mb-1 rounded bg-red-500/10 px-2 py-1 text-xs text-red-400">
              {uploadError}
            </div>
          )}
          <button
            className="insert-item flex w-full cursor-pointer items-center gap-2.5 rounded px-3 py-2 text-left text-[13px] text-text-primary transition-colors hover:bg-hover"
            onClick={() => doAction(onOpenMediaLibrary)}
          >
            <FolderOpen size={15} /> <span>Media Library</span>
          </button>

          <div className="insert-separator my-1 h-[1px] bg-border" />

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
            <ChevronRight size={12} className="ml-auto opacity-40" />
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
                  <span className="text-[8px]">{s.name.split(' ')[0]}</span>
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
            <span className="text-[13px] w-[15px] text-center shrink-0">◇</span>
            <span>SVG</span>
          </button>
          <input
            ref={svgRef}
            type="file"
            accept=".svg,image/svg+xml"
            className="hidden"
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
            <span className="text-sm w-[15px] text-center shrink-0">★</span>
            <span>Icon</span>
            <ChevronRight size={12} className="ml-auto opacity-40" />
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
                    const IconComp = ICON_MAP[name]
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
            <span className="inline-flex items-center justify-center w-[15px] h-[15px] rounded-full bg-danger text-white text-[9px] font-bold shrink-0">
              1
            </span>
            <span>Callout</span>
          </button>

          <div className="insert-separator my-1 h-[1px] bg-border" />

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
            className="insert-item flex w-full cursor-default flex-col items-start rounded px-3 py-2 text-left text-[13px] text-text-primary transition-colors hover:bg-hover gap-1.5"
            onMouseEnter={() => setSubMenu('table')}
          >
            <div className="flex items-center gap-2.5">
              <Table2 size={15} /> <span>Table</span>
            </div>
            {subMenu === 'table' && (
              <div className="table-size-picker pt-2 pb-1" onClick={(e) => e.stopPropagation()}>
                {/* Preset quick buttons */}
                <div className="flex gap-1 mb-2 flex-wrap">
                  {[2, 3, 4, 5, 6, 8].map((n) => (
                    <button
                      key={n}
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium border border-border bg-surface-2 text-text-secondary hover:border-accent hover:text-accent transition-colors cursor-pointer"
                      onClick={() => setTableSize({ r: n, c: n })}
                    >
                      {n}×{n}
                    </button>
                  ))}
                </div>

                {/* Numeric inputs */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-1">
                    <label className="text-[10px] text-text-muted">Rows</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={tableSize.r || ''}
                      placeholder="1"
                      className="w-10 bg-surface-2 border border-border rounded px-1 py-0.5 text-[11px] text-text-primary text-center focus:outline-none focus:border-accent"
                      onChange={(e) => {
                        const v = Math.max(1, Math.min(20, Number(e.target.value) || 1))
                        setTableSize((s) => ({ ...s, r: v }))
                      }}
                    />
                  </div>
                  <span className="text-text-muted text-xs">×</span>
                  <div className="flex items-center gap-1">
                    <label className="text-[10px] text-text-muted">Cols</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={tableSize.c || ''}
                      placeholder="1"
                      className="w-10 bg-surface-2 border border-border rounded px-1 py-0.5 text-[11px] text-text-primary text-center focus:outline-none focus:border-accent"
                      onChange={(e) => {
                        const v = Math.max(1, Math.min(20, Number(e.target.value) || 1))
                        setTableSize((s) => ({ ...s, c: v }))
                      }}
                    />
                  </div>
                </div>

                {/* Visual grid preview (max 8x8) */}
                <div className="table-size-grid grid gap-[2px] mb-2" style={{ gridTemplateColumns: `repeat(${Math.min(tableSize.c || 3, 8)}, 1fr)` }}>
                  {Array.from({ length: Math.min(tableSize.r || 3, 8) }, (_, r) =>
                    Array.from({ length: Math.min(tableSize.c || 3, 8) }, (_, c) => (
                      <div
                        key={`${r}-${c}`}
                        className="aspect-square rounded-sm border border-border-strong bg-surface-2"
                      />
                    ))
                  )}
                </div>

                {/* Insert button */}
                <button
                  className="w-full py-1 rounded text-[11px] font-medium bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={!tableSize.r || !tableSize.c}
                  onClick={() => {
                    if (tableSize.r > 0 && tableSize.c > 0) {
                      onAddTable?.(tableSize.r, tableSize.c)
                      setOpen(false)
                      setSubMenu(null)
                      setTableSize({ r: 0, c: 0 })
                    }
                  }}
                >
                  Insert {tableSize.r > 0 && tableSize.c > 0 ? `${tableSize.r}×${tableSize.c}` : ''} Table
                </button>
              </div>
            )}
          </div>
          <button
            className="insert-item flex w-full cursor-pointer items-center gap-2.5 rounded px-3 py-2 text-left text-[13px] text-text-primary transition-colors hover:bg-hover"
            onClick={() => doAction(onAddDrawing)}
          >
            <Pencil size={15} /> <span>Drawing Canvas</span>
          </button>

          <div className="insert-separator my-1 h-[1px] bg-border" />

          {/* GAMES */}
          <div className="insert-category mt-1 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Games
          </div>
          {[
            ['name-picker', '🎡', 'Name Picker'],
            ['hot-potato', '🔥', 'Hot Potato Quiz'],
            ['jeopardy', '🏆', 'Jeopardy'],
            ['four-corners', '🧭', 'Four Corners'],
            ['relay-race', '🏃', 'Relay Race'],
            ['trivia-champ', '💡', 'Trivia Championship'],
            ['scattergories', '📝', 'Scattergories'],
          ].map(([type, icon, label]) => (
            <button
              key={type}
              className="insert-item flex w-full cursor-pointer items-center gap-2.5 rounded px-3 py-2 text-left text-[13px] text-text-primary transition-colors hover:bg-hover"
              onClick={() => doAction(onAddGame, type)}
            >
              <span className="text-sm w-[15px] text-center shrink-0">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
          </div>
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
          className="fixed top-20 left-1/2 -translate-x-1/2"
        />
      )}
    </div>
  )
}

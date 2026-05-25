import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  Sun,
  Moon,
  Layout,
  Settings2,
  Search,
  Clock,
  FolderOpen,
  Grid3x3,
  List,
  Rocket,
  BookOpen,
  FileUp,
  LayoutTemplate,
  Trash,
  Sparkles,
  RotateCcw,
  Globe,
  AlertCircle,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../utils/api'
import { markdownToSlidesWithWarnings } from '../utils/markdown-import'
import { parseProjectFile, rehydrateImportedPresentation, validateProjectFile } from '../utils/import-project'
import { summarizePptxImportWarnings } from '../utils/pptx-import-summary'
import TemplatePreview from '../components/dashboard/TemplatePreview'
import { Button, Input, ModalShell, Select } from '../components/ui'
import SlideThumbnail from '../components/SlideThumbnail'

const THEMES = [
  'black',
  'white',
  'league',
  'beige',
  'sky',
  'night',
  'serif',
  'simple',
  'solarized',
  'moon',
  'dracula',
]
const TRANSITIONS = ['none', 'fade', 'slide', 'convex', 'concave', 'zoom']

const PRESET_THEMES = [
  {
    id: 'deck-blank-light',
    title: 'Blank Light',
    category: 'minimal',
    theme: 'white',
    transition: 'slide',
    thumbnail: { type: 'color', color: '#ffffff' },
    description: 'Clean minimal light theme',
  },
  {
    id: 'deck-blank-dark',
    title: 'Blank Dark',
    category: 'minimal',
    theme: 'black',
    transition: 'fade',
    thumbnail: { type: 'color', color: '#111111' },
    description: 'Clean minimal dark theme',
  },
  {
    id: 'deck-palette',
    title: 'Palette',
    category: 'creative',
    theme: 'solarized',
    transition: 'zoom',
    thumbnail: { type: 'color', color: '#fdf6e3' },
    description: 'Vibrant and creative colors',
  },
  {
    id: 'deck-bento',
    title: 'Bento',
    category: 'creative',
    theme: 'white',
    transition: 'convex',
    thumbnail: { type: 'gradient', gradient: 'linear-gradient(135deg, #f3f4f6, #e5e7eb)' },
    description: 'Grid-based bento box design',
  },
  {
    id: 'deck-serif',
    title: 'Serif',
    category: 'academic',
    theme: 'serif',
    transition: 'slide',
    thumbnail: { type: 'color', color: '#fcfcfc' },
    description: 'Classic typography for reading',
  },
  {
    id: 'deck-bold',
    title: 'Bold',
    category: 'corporate',
    theme: 'blood',
    transition: 'none',
    thumbnail: { type: 'color', color: '#222222' },
    description: 'High contrast for impact',
  },
  {
    id: 'deck-minimal',
    title: 'Minimalist',
    category: 'minimal',
    theme: 'simple',
    transition: 'fade',
    thumbnail: { type: 'color', color: '#fafafa' },
    description: 'Focus entirely on content',
  },
  {
    id: 'deck-code',
    title: 'Code',
    category: 'engineering',
    theme: 'night',
    transition: 'slide',
    thumbnail: { type: 'color', color: '#1a1b26' },
    description: 'Developer focused template',
  },
  {
    id: 'deck-desk',
    title: 'Desk',
    category: 'corporate',
    theme: 'league',
    transition: 'slide',
    thumbnail: { type: 'color', color: '#2b2b2b' },
    description: 'Professional office environment',
  },
  {
    id: 'deck-ellipse',
    title: 'Ellipse',
    category: 'creative',
    theme: 'sky',
    transition: 'concave',
    thumbnail: { type: 'gradient', gradient: 'radial-gradient(circle, #f6f8fd, #e9eff9)' },
    description: 'Soft rounded shapes',
  },
]

const TEMPLATE_CATEGORIES = [
  'All',
  'Creative',
  'Academic',
  'Corporate',
  'Kỹ thuật số',
  'Vi xử lý',
  'Lý thuyết mạch',
  'Điện tử',
  'Tự động hoá',
  'Điện',
  'Đo lường',
  'ĐTCS',
  'Cơ khí',
  'VKT',
  'Thuỷ khí',
]

const LIGHT_PRESET_COLORS = new Set(['#ffffff', '#fafafa', '#fcfcfc'])

function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString(navigator.language, { month: 'short', day: 'numeric', year: 'numeric' })
}

function getCardBg(thumbnail) {
  if (!thumbnail) return '#1e1e28'
  if (thumbnail.type === 'color' && thumbnail.color) return thumbnail.color
  if (thumbnail.type === 'gradient' && thumbnail.gradient) return thumbnail.gradient
  if (thumbnail.type === 'image' && thumbnail.image) return `url(${thumbnail.image})`
  return '#1e1e28'
}

function isGradientOrImage(thumbnail) {
  return thumbnail && (thumbnail.type === 'gradient' || thumbnail.type === 'image')
}

function getPresetTextTone(thumbnail) {
  const isLightPreset = LIGHT_PRESET_COLORS.has((thumbnail?.color || '').toLowerCase())
  return isLightPreset
    ? {
        titleClassName: 'text-base font-bold text-[#333] opacity-85',
        metaClassName: 'text-[10px] text-[#666]',
      }
    : {
        titleClassName: 'text-base font-bold text-white opacity-85',
        metaClassName: 'text-[10px] text-white/50',
      }
}

function getTemplateStartButtonStateClassName(isSelected) {
  return isSelected
    ? '!bg-accent !border-accent !text-white'
    : 'bg-card border-border text-text-primary hover:bg-hover hover:border-border-strong'
}

function handleKeyboardClick(event, callback) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  callback(event)
}

const DASHBOARD_CARD_CLASS =
  'group bg-card border border-border rounded-lg overflow-hidden transition-[background-color,border-color,box-shadow,opacity] duration-150 hover:border-border-strong hover:shadow-[0_12px_28px_rgba(36,25,21,0.14)] focus-within:ring-2 focus-within:ring-focus/25'

const DASHBOARD_ACTION_TILE_CLASS =
  'flex items-center gap-2.5 px-5 py-3.5 bg-card border border-border rounded-md text-text-primary text-sm font-medium cursor-pointer transition-[background-color,border-color,box-shadow,color] duration-150 hover:bg-hover hover:border-accent hover:shadow-[0_8px_20px_rgba(36,25,21,0.12)]'

const CATEGORY_PILL_CLASS =
  'px-3.5 py-1.5 rounded-full text-xs font-medium bg-card border border-border text-text-secondary cursor-pointer transition-[background-color,border-color,color,box-shadow] duration-150 hover:border-border-strong hover:text-text-primary focus-visible:ring-2 focus-visible:ring-focus/30'

// Sidebar navigation items
const SIDEBAR_VIEWS = [
  { key: 'recent', label: 'Recent', icon: Clock },
  { key: 'all', label: 'All Presentations', icon: FolderOpen },
]

// Import file refs
// eslint-disable-next-line unused-imports/no-unused-vars
let pdfInputRef = null
// eslint-disable-next-line unused-imports/no-unused-vars
let mdInputRef = null

export default function HomePage({ onOpen, theme, onToggleTheme }) {
  const navigate = useNavigate()
  const [presentations, setPresentations] = useState([])
  const [templates, setTemplates] = useState([])
  const [trashItems, setTrashItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    title: '',
    theme: 'black',
    transition: 'slide',
    templateId: null,
  })
  const [creating, setCreating] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState(null) // { title, message, onConfirm, variant }
  const pptxImportRef = useRef(null)

  // Dashboard state
  const [sidebarView, setSidebarView] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('updatedAt')
  const [viewMode, setViewMode] = useState('grid')
  const [templateCategory, setTemplateCategory] = useState('All')

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => () => {
    const activeImport = pptxImportRef.current
    activeImport?.es?.close()
    if (activeImport?.jobId) api.cancelPptxJob(activeImport.jobId).catch(() => {})
    pptxImportRef.current = null
  }, [])

  async function loadData() {
    try {
      const [presData, tmplData, trashData] = await Promise.all([
        api.getPresentations(),
        api.getTemplates(),
        api.getTrash(),
      ])
      setPresentations(Array.isArray(presData) ? presData : [])
      setTemplates(Array.isArray(tmplData) ? tmplData : [])
      setTrashItems(Array.isArray(trashData) ? trashData : [])
    } catch (err) {
      console.error('Failed to load data', err)
      setPresentations([])
      setTemplates([])
      setTrashItems([])
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setCreating(true)
    try {
      const payload = { ...form }
      if (payload.templateId === null) {
        delete payload.templateId
      }
      const pres = await api.createPresentation(payload)
      setShowModal(false)
      setForm({ title: '', theme: 'black', transition: 'slide', templateId: null })
      onOpen(pres.id)
    } catch (err) {
      console.error('Failed to create presentation', err)
    } finally {
      setCreating(false)
    }
  }

  async function handleCreateFromTemplate(templateId, isPreset = false) {
    setCreating(true)
    try {
      if (isPreset) {
        let presetData = PRESET_THEMES.find((p) => p.id === templateId)
        if (!presetData) return

        try {
          const fullTemplate = await api.getMarketplaceTemplate(templateId)
          if (fullTemplate) {
            presetData = fullTemplate
          }
        } catch (err) {
          console.warn(
            'Failed to fetch full template data from backend, using metadata outline',
            err
          )
        }

        // eslint-disable-next-line unused-imports/no-unused-vars
        const { id, thumbnail, description, category, ...data } = presetData
        const pres = await api.createPresentation({
          ...data,
          title: data.title || presetData.title,
          slides: (data.slides || []).map((s) => ({
            ...s,
            id: crypto.randomUUID(),
            elements: (s.elements || []).map((el) => ({ ...el, id: crypto.randomUUID() })),
          })),
        })
        onOpen(pres.id)
      } else {
        const pres = await api.createPresentation({ templateId })
        onOpen(pres.id)
      }
    } catch (err) {
      console.error('Failed to create from template', err)
    } finally {
      setCreating(false)
    }
  }

  async function handleDuplicate(e, id) {
    e.stopPropagation()
    try {
      await api.duplicatePresentation(id)
      loadData()
    } catch (err) {
      console.error('Failed to duplicate', err)
    }
  }

  function handleDelete(e, id) {
    e.stopPropagation()
    setConfirmDialog({
      title: 'Move to Trash',
      message: 'Move this presentation to trash? You can restore it later.',
      variant: 'warning',
      onConfirm: async () => {
        try {
          await api.deletePresentation(id)
          loadData()
        } catch (err) {
          console.error('Failed to delete presentation', err)
        }
      },
    })
  }

  async function handleRestore(e, id) {
    e.stopPropagation()
    try {
      await api.restorePresentation(id)
      loadData()
    } catch (err) {
      console.error('Failed to restore presentation', err)
    }
  }

  function handlePermanentDelete(e, id) {
    e.stopPropagation()
    setConfirmDialog({
      title: 'Delete Permanently',
      message: 'Permanently delete this presentation? This cannot be undone.',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await api.permanentDeletePresentation(id)
          loadData()
        } catch (err) {
          console.error('Failed to permanently delete', err)
        }
      },
    })
  }

  function handleEmptyTrash() {
    setConfirmDialog({
      title: 'Empty Trash',
      message: `Permanently delete all ${trashItems.length} trashed items? This cannot be undone.`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          await Promise.all(trashItems.map((t) => api.permanentDeletePresentation(t.id)))
          loadData()
        } catch (err) {
          console.error('Failed to empty trash', err)
        }
      },
    })
  }

  function handleDeleteTemplate(e, id) {
    e.stopPropagation()
    setConfirmDialog({
      title: 'Delete Template',
      message: 'Delete this template? This cannot be undone.',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await api.deleteTemplate(id)
          setTemplates((prev) => prev.filter((t) => t.id !== id))
        } catch (err) {
          console.error('Failed to delete template', err)
        }
      },
    })
  }

  async function handleCreateTemplate() {
    try {
      const template = await api.createTemplate({
        title: 'New Template',
        theme: 'black',
        transition: 'slide',
        slides: [
          {
            id: crypto.randomUUID(),
            elements: [
              {
                id: crypto.randomUUID(),
                type: 'text',
                x: 80,
                y: 160,
                width: 800,
                height: 220,
                zIndex: 1,
                content:
                  '<h2 style="text-align: center">Template Title</h2><p style="text-align: center">Edit this template</p>',
              },
            ],
            notes: '',
            background: { type: 'color', color: '#1e1e2e' },
          },
        ],
      })
      onOpen(template.id, true)
    } catch (err) {
      console.error('Failed to create template', err)
    }
  }

  function handleOpenModal() {
    setForm({ title: '', theme: 'black', transition: 'slide', templateId: null })
    setShowModal(true)
  }

  const [importProgress, setImportProgress] = useState(null)
  const [importWarningSummary, setImportWarningSummary] = useState(null)

  async function handleImportPdf(file) {
    if (!file) return
    setImportWarningSummary(null)
    setImportProgress('Loading PDF...')
    try {
      const { pdfToSlides } = await import('../utils/pdf-import.js')
      const { slides, warnings } = await pdfToSlides(file, (cur, total) => {
        setImportProgress(`Converting page ${cur}/${total}...`)
      })
      if (slides.length === 0) {
        alert('No pages found in PDF')
        return
      }
      if (warnings.length) {
        const message = `PDF import completed with warnings:\n- ${warnings.join('\n- ')}`
        setImportWarningSummary(message)
      }
      const pres = await api.createPresentation({
        title: file.name.replace(/\.pdf$/i, ''),
        theme: 'white',
        transition: 'slide',
        slides,
      })
      onOpen(pres.id)
    } catch (err) {
      console.error('PDF import failed:', err)
      alert('Failed to import PDF: ' + err.message)
    } finally {
      setImportProgress(null)
    }
  }

  async function handleImportMarkdown(file) {
    if (!file) return
    setImportWarningSummary(null)
    try {
      const text = await file.text()
      const { slides, warnings } = markdownToSlidesWithWarnings(text)
      if (slides.length === 0) {
        alert('No content found in Markdown')
        return
      }
      if (warnings.length) {
        const message = `Markdown import warnings:\n- ${warnings.join('\n- ')}`
        setImportWarningSummary(message)
      }
      const pres = await api.createPresentation({
        title: file.name.replace(/\.(md|markdown|txt)$/i, ''),
        theme: 'black',
        transition: 'slide',
        slides,
      })
      onOpen(pres.id)
    } catch (err) {
      console.error('Markdown import failed:', err)
      alert('Failed to import Markdown: ' + err.message)
    }
  }

  async function handleImportProject(file) {
    if (!file) return
    setImportWarningSummary(null)
    setImportProgress('Parsing project file...')
    try {
      const parsed = await parseProjectFile(file)
      const { valid, errors, warnings } = validateProjectFile(parsed)
      if (!valid) {
        alert('Invalid project file: ' + errors.join(', '))
        return
      }
      if (warnings.length) console.warn('Import warnings:', warnings)

      let finalPres = parsed.presentation
      const importWarnings = [...warnings]
      if (parsed.type === 'zip' && parsed.mediaFiles && parsed.mediaFiles.length > 0) {
        setImportProgress('Uploading media files...')
        const rehydrated = await rehydrateImportedPresentation(api, parsed)
        finalPres = rehydrated.presentation
        importWarnings.push(...rehydrated.warnings)
      }

      setImportProgress('Creating presentation...')
      finalPres.title = (finalPres.title || 'Imported') + ' (Imported)'
      const pres = await api.createPresentation({
        ...finalPres,
        slides: finalPres.slides,
      })
      if (importWarnings.length) {
        const message = `Project import warnings:\n- ${importWarnings.join('\n- ')}`
        setImportWarningSummary(message)
      }
      onOpen(pres.id)
    } catch (err) {
      console.error('Project import failed:', err)
      alert('Failed to import project: ' + err.message)
    } finally {
      setImportProgress(null)
    }
  }

  async function handleImportPptx(file) {
    if (!file) return
    if (!/\.pptx$/i.test(file.name)) {
      alert('Only .pptx files are supported')
      return
    }

    setImportWarningSummary(null)
    setImportProgress('Uploading PPTX...')
    try {
      const { jobId } = await api.importPptxAsync(file)
      const imported = await new Promise((resolve, reject) => {
        const es = new EventSource(`/api/pptx/jobs/${jobId}/stream`)
        let settled = false
        pptxImportRef.current = { es, jobId }
        es.addEventListener('progress', (event) => {
          const progress = JSON.parse(event.data)
          if (progress.message) setImportProgress(progress.message)
        })
        es.addEventListener('done', (event) => {
          settled = true
          es.close()
          pptxImportRef.current = null
          resolve(JSON.parse(event.data).result)
        })
        es.addEventListener('failed', (event) => {
          settled = true
          es.close()
          pptxImportRef.current = null
          reject(new Error(JSON.parse(event.data).error || 'PPTX import failed'))
        })
        es.addEventListener('cancelled', () => {
          settled = true
          es.close()
          pptxImportRef.current = null
          reject(new Error('PPTX import cancelled'))
        })
        es.onerror = () => {
          if (settled) return
          es.close()
          pollPptxJobUntilTerminal(jobId).then((result) => {
            settled = true
            pptxImportRef.current = null
            resolve(result)
          }).catch((err) => {
            settled = true
            pptxImportRef.current = null
            reject(err)
          })
        }
      })
      setImportProgress('Creating presentation...')
      const pres = await api.createPresentation(imported.presentation)
      const warningSummary = summarizePptxImportWarnings(imported)
      if (warningSummary) {
        setImportWarningSummary(warningSummary)
        alert(warningSummary)
      }
      onOpen(pres.id)
    } catch (err) {
      console.error('PPTX import failed:', err)
      alert('Failed to import PPTX: ' + err.message)
    } finally {
      pptxImportRef.current?.es?.close()
      pptxImportRef.current = null
      setImportProgress(null)
    }
  }

  async function pollPptxJobUntilTerminal(jobId) {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const job = await api.pollPptxJob(jobId)
      if (job.message) setImportProgress(job.message)
      if (job.status === 'done') return job.result
      if (job.status === 'failed' || job.status === 'cancelled') {
        throw new Error(job.error || `PPTX import ${job.status}`)
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    throw new Error('PPTX import progress timed out')
  }

  // ── Filtered & sorted data ──
  const filteredPresentations = useMemo(() => {
    let items = [...presentations]

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      items = items.filter((p) => (p.title || '').toLowerCase().includes(q))
    }

    // Sort
    items.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return (a.title || '').localeCompare(b.title || '')
        case 'createdAt':
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        case 'slides':
          return (b.slideCount || 0) - (a.slideCount || 0)
        default:
          return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
      }
    })

    // Recent: only last 10
    if (sidebarView === 'recent') {
      items = items.slice(0, 10)
    }

    return items
  }, [presentations, searchQuery, sortBy, sidebarView])

  const filteredPresets = useMemo(() => {
    if (templateCategory === 'All') return PRESET_THEMES
    return PRESET_THEMES.filter(
      (p) => (p.category || '').toLowerCase() === (templateCategory || '').toLowerCase()
    )
  }, [templateCategory])

  const allTemplates = [...PRESET_THEMES, ...templates.map((t) => ({ ...t, isUser: true }))]

  // ── Determine what to show ──
  const isTemplateView = sidebarView === 'templates'
  const isMyTemplateView = sidebarView === 'my-templates'
  const isMarketplaceView = sidebarView === 'marketplace'
  const isTrashView = sidebarView === 'trash'
  const [marketplaceData, setMarketplaceData] = useState({ categories: [], templates: [] })
  const [marketplaceCategory, setMarketplaceCategory] = useState('')
  const [marketplaceSearch, setMarketplaceSearch] = useState('')

  useEffect(() => {
    if (isMarketplaceView && marketplaceData.templates.length === 0) {
      api.getMarketplaceTemplates().then(setMarketplaceData).catch(console.error)
    }
  }, [isMarketplaceView, marketplaceData.templates.length])

  return (
    <div className="h-full flex flex-col bg-panel">
      {/* ════ Header ════ */}
      <div className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-secondary px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[17px] font-bold text-text-primary tracking-tight">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-brand/30 bg-brand text-sm font-extrabold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
              N
            </div>
            <span>NavSlides Editor</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full max-w-md min-w-0">
          <Search
            size={15}
            className="absolute left-[11px] top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          />
          <Input
            className="w-full pl-9 pr-8"
            type="text"
            placeholder="Search presentations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors p-0.5 rounded"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="icon"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </Button>
          <Button
            variant="icon"
            onClick={() => navigate('/settings')}
            aria-label="Settings"
            title="Settings"
          >
            <Settings2 size={16} />
          </Button>
          <Button variant="primary" onClick={handleOpenModal}>
            <Plus size={16} />
            <span>New</span>
          </Button>
        </div>
      </div>

      {/* ════ Body: Sidebar + Content ════ */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <nav className="w-[var(--sidebar-width)] shrink-0 bg-secondary border-r border-border flex flex-col overflow-y-auto py-3">
          <div className="px-3 mb-2">
            {SIDEBAR_VIEWS.map((item) => (
              <Button
                variant="ghost"
                key={item.key}
                className={`flex items-center gap-3 px-3 py-2 rounded text-[13px] font-medium text-text-secondary cursor-pointer transition-colors border-none bg-transparent w-full text-left hover:bg-hover hover:text-text-primary ${sidebarView === item.key ? 'bg-primary/10 text-primary' : ''}`}
                onClick={() => setSidebarView(item.key)}
              >
                <item.icon size={16} />
                <span>{item.label}</span>
                {item.key === 'all' && (
                  <span className="ml-auto text-[11px] text-text-muted bg-hover px-[7px] py-[1px] rounded-[10px]">
                    {presentations.length}
                  </span>
                )}
              </Button>
            ))}
          </div>

          <div className="h-px bg-border my-2 mx-3" />

          <div className="px-3 mb-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted px-3 pt-2 pb-1.5">
              Templates
            </div>
            <Button
              variant="ghost"
              className={`flex items-center gap-3 px-3 py-2 rounded text-[13px] font-medium text-text-secondary cursor-pointer transition-colors border-none bg-transparent w-full text-left hover:bg-hover hover:text-text-primary ${sidebarView === 'templates' ? 'bg-primary/10 text-primary' : ''}`}
              onClick={() => setSidebarView('templates')}
            >
              <LayoutTemplate size={16} />
              <span>Built-in</span>
              <span className="ml-auto text-[11px] text-text-muted bg-hover px-[7px] py-[1px] rounded-[10px]">
                {PRESET_THEMES.length}
              </span>
            </Button>
            <Button
              variant="ghost"
              className={`flex items-center gap-3 px-3 py-2 rounded text-[13px] font-medium text-text-secondary cursor-pointer transition-colors border-none bg-transparent w-full text-left hover:bg-hover hover:text-text-primary ${sidebarView === 'my-templates' ? 'bg-primary/10 text-primary' : ''}`}
              onClick={() => setSidebarView('my-templates')}
            >
              <Layout size={16} />
              <span>My Templates</span>
              <span className="ml-auto text-[11px] text-text-muted bg-hover px-[7px] py-[1px] rounded-[10px]">
                {templates.length}
              </span>
            </Button>
            <Button
              variant="ghost"
              className={`flex items-center gap-3 px-3 py-2 rounded text-[13px] font-medium text-text-secondary cursor-pointer transition-colors border-none bg-transparent w-full text-left hover:bg-hover hover:text-text-primary ${sidebarView === 'marketplace' ? 'bg-primary/10 text-primary' : ''}`}
              onClick={() => setSidebarView('marketplace')}
            >
              <Sparkles size={16} />
              <span>Marketplace</span>
            </Button>
          </div>

          <div className="h-px bg-border my-2 mx-3" />

          <div className="px-3 mb-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted px-3 pt-2 pb-1.5">
              Import
            </div>
            <label
              data-testid="home-import-pptx-btn"
              className="flex items-center gap-2.5 px-3 py-2 rounded text-[13px] font-medium text-text-secondary cursor-pointer transition-colors border-none bg-transparent w-full text-left hover:bg-hover hover:text-text-primary"
            >
              <FileUp size={16} />
              <span>Import PPTX</span>
              <input
                data-testid="home-import-pptx-input"
                type="file"
                accept=".pptx"
                className="hidden"
                onChange={(e) => {
                  handleImportPptx(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>
            <label
              className="flex items-center gap-2.5 px-3 py-2 rounded text-[13px] font-medium text-text-secondary cursor-pointer transition-colors border-none bg-transparent w-full text-left hover:bg-hover hover:text-text-primary"
            >
              <BookOpen size={16} />
              <span>Import PDF</span>
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  handleImportPdf(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>
            <label
              data-testid="home-import-markdown-btn"
              className="flex items-center gap-2.5 px-3 py-2 rounded text-[13px] font-medium text-text-secondary cursor-pointer transition-colors border-none bg-transparent w-full text-left hover:bg-hover hover:text-text-primary"
            >
              <BookOpen size={16} />
              <span>Import Markdown</span>
              <input
                data-testid="home-import-markdown-input"
                type="file"
                accept=".md,.markdown,.txt"
                className="hidden"
                onChange={(e) => {
                  handleImportMarkdown(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>
            <label
              className="flex items-center gap-2.5 px-3 py-2 rounded text-[13px] font-medium text-text-secondary cursor-pointer transition-colors border-none bg-transparent w-full text-left hover:bg-hover hover:text-text-primary"
            >
              <FolderOpen size={16} />
              <span>Import Project</span>
              <input
                type="file"
                accept=".navslides,.json"
                className="hidden"
                onChange={(e) => {
                  handleImportProject(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>
          </div>

          <div className="h-px bg-border my-2 mx-3" />

          <div className="px-3 mb-2">
            <Button
              variant="ghost"
              className="flex items-center gap-2.5 px-3 py-2 rounded text-[13px] font-medium text-text-secondary cursor-pointer transition-colors border-none bg-transparent w-full text-left hover:bg-hover hover:text-text-primary"
              onClick={() => navigate('/explore')}
            >
              <Globe size={16} />
              <span>Explore</span>
            </Button>
          </div>

          <div className="h-px bg-border my-2 mx-3" />

          {/* Sticky Trash entry — always reachable at viewport bottom */}
          <div className="sticky bottom-0 bg-secondary z-10 px-3 mb-2 pt-2 border-t border-border/40">
            <Button
              variant="ghost"
              className={`flex items-center gap-3 px-3 py-2 rounded text-[13px] font-medium text-text-secondary cursor-pointer transition-colors border-none bg-transparent w-full text-left hover:bg-hover hover:text-text-primary ${sidebarView === 'trash' ? 'bg-primary/10 text-primary' : ''}`}
              onClick={() => setSidebarView('trash')}
            >
              <Trash size={16} />
              <span>Trash</span>
              {trashItems.length > 0 && (
                <span className="ml-auto text-[11px] text-text-muted bg-hover px-[7px] py-[1px] rounded-[10px]">
                  {trashItems.length}
                </span>
              )}
            </Button>
          </div>

          {/* Import progress / warnings — flow below Trash in normal order */}
          <div className="px-3 pb-2">
            {importProgress && (
              <div
                className="rounded border border-border bg-card px-2 py-1.5 text-[11px] text-text-secondary"
                role="status"
                aria-live="polite"
              >
                {importProgress}
              </div>
            )}
            {importWarningSummary && (
              <div
                className="mt-2 rounded border border-yellow-500/30 bg-yellow-500/10 px-2 py-1.5 text-[11px] text-text-secondary"
                role="alert"
              >
                {importWarningSummary}
              </div>
            )}
          </div>
        </nav>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-7 pt-7 sm:px-8">
          {loading ? (
            <div className="text-text-muted text-center p-20">
              Loading...
            </div>
          ) : isTrashView ? (
            /* ── Trash View ── */
            <>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-text-primary">Trash</h2>
                {trashItems.length > 0 && (
                  <Button variant="danger" onClick={handleEmptyTrash} className="text-xs">
                    <Trash2 size={14} /> Empty Trash
                  </Button>
                )}
              </div>
              {trashItems.length === 0 ? (
                <div className="col-span-full text-center py-20 px-5 text-text-muted animate-fade-in">
                  <Trash size={48} />
                  <p className="text-[17px] font-semibold text-text-secondary mb-2">
                    Trash is empty
                  </p>
                  <p className="text-sm text-text-muted mb-6">
                    Deleted presentations will appear here
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5 animate-fade-in">
                  {trashItems.map((pres) => {
                    const bg = getCardBg(pres.thumbnail)
                    const bgProp = isGradientOrImage(pres.thumbnail)
                      ? { background: bg }
                      : { backgroundColor: bg }
                    return (
                      <div key={pres.id} className={`${DASHBOARD_CARD_CLASS} cursor-default opacity-70`}>
                        <div
                          className="aspect-video flex items-center justify-center bg-surface-2 relative overflow-hidden text-[32px] text-text-muted"
                          style={bgProp}
                        >
                          <Trash size={24} className="opacity-30" />
                        </div>
                        <div className="px-4 py-3">
                          <h3 className="text-[14px] font-semibold text-text-primary mb-1 truncate">
                            {pres.title || 'Untitled'}
                          </h3>
                          <p className="text-[12px] text-text-secondary truncate">
                            {pres.slideCount} slide{pres.slideCount !== 1 ? 's' : ''} · Deleted{' '}
                            {formatDate(pres.deletedAt)}
                          </p>
                        </div>
                        <div
                          className="flex justify-end gap-1 px-3 py-2 border-t border-border"
                        >
                          <Button
                            variant="icon"
                            aria-label="Restore"
                            title="Restore"
                            onClick={(e) => handleRestore(e, pres.id)}
                          >
                            <RotateCcw size={14} />
                          </Button>
                          <Button
                            variant="icon"
                            aria-label="Delete permanently"
                            title="Delete permanently"
                            onClick={(e) => handlePermanentDelete(e, pres.id)}
                            className="text-danger"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          ) : isTemplateView ? (
            /* ── Built-in Template Gallery ── */
            <>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-text-primary">Template Gallery</h2>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-5">
                {TEMPLATE_CATEGORIES.map((cat) => (
                  <Button
                    variant="ghost"
                    key={cat}
                    className={`template-category-btn ${CATEGORY_PILL_CLASS} ${templateCategory === cat ? '!bg-accent !border-accent !text-white' : ''}`}
                    onClick={() => setTemplateCategory(cat)}
                  >
                    {cat}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5">
                {filteredPresets.map((preset) => {
                  const bg = getCardBg(preset.thumbnail)
                  const bgProp = isGradientOrImage(preset.thumbnail)
                    ? { background: bg }
                    : { backgroundColor: bg }
                  const tone = getPresetTextTone(preset.thumbnail)
                  return (
                    <div
                      key={preset.id}
                      className={`${DASHBOARD_CARD_CLASS} ${
                        creating ? 'cursor-wait' : 'cursor-pointer'
                      }`}
                      role="button"
                      tabIndex={creating ? -1 : 0}
                      onClick={() => handleCreateFromTemplate(preset.id, true)}
                      onKeyDown={(event) =>
                        handleKeyboardClick(event, () => handleCreateFromTemplate(preset.id, true))
                      }
                    >
                      <div
                        className="aspect-video flex items-center justify-center relative overflow-hidden"
                        style={bgProp}
                      >
                        <div className="flex flex-col items-center justify-center gap-1 px-4 text-center">
                          <span className={tone.titleClassName}>
                            {preset.title}
                          </span>
                          <span className={tone.metaClassName}>
                            {preset.theme} · {preset.transition}
                          </span>
                        </div>
                        <Sparkles
                          size={16}
                          className="absolute top-2 right-2 opacity-25"
                        />
                      </div>
                      <div className="px-4 py-3">
                        <h3 className="text-[14px] font-semibold text-text-primary mb-1 truncate">
                          {preset.title}
                        </h3>
                        <p className="text-[12px] text-text-secondary truncate">
                          {preset.description}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : isMyTemplateView ? (
            /* ── My Templates ── */
            <>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-text-primary">My Templates</h2>
                <Button variant="secondary" onClick={handleCreateTemplate}>
                  <Plus size={14} /> <span>New Template</span>
                </Button>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5">
                {templates.length === 0 ? (
                  <div className="col-span-full text-center py-20 px-5 text-text-muted">
                    <Layout size={48} />
                    <p className="text-[17px] font-semibold text-text-secondary mb-2">
                      No custom templates yet
                    </p>
                    <p className="text-sm text-text-muted mb-6">
                      Create a template to reuse across presentations
                    </p>
                    <Button variant="primary" onClick={handleCreateTemplate}>
                      <Plus size={14} /> <span>Create Template</span>
                    </Button>
                  </div>
                ) : (
                  templates.map((tmpl) => {
                    const bg = getCardBg(tmpl.thumbnail)
                    const bgProp = isGradientOrImage(tmpl.thumbnail)
                      ? { background: bg }
                      : { backgroundColor: bg }
                    return (
                      <div
                        key={tmpl.id}
                        className={`${DASHBOARD_CARD_CLASS} cursor-pointer`}
                        role="button"
                        tabIndex={0}
                        onClick={() => onOpen(tmpl.id, true)}
                        onKeyDown={(event) => handleKeyboardClick(event, () => onOpen(tmpl.id, true))}
                      >
                        <SlideThumbnail id={tmpl.id} bgProp={bgProp} />
                        <div className="px-4 py-3">
                          <h3 className="text-[14px] font-semibold text-text-primary mb-1 truncate">
                            {tmpl.title || 'Untitled Template'}
                          </h3>
                          <p className="text-[12px] text-text-secondary truncate">
                            {tmpl.slideCount} slide{tmpl.slideCount !== 1 ? 's' : ''} &middot;{' '}
                            {formatDate(tmpl.updatedAt)}
                          </p>
                        </div>
                        <div className="flex justify-end gap-1 px-3 py-2 border-t border-border">
                          <Button
                            variant="icon"
                            aria-label="Edit template"
                            title="Edit template"
                            onClick={(e) => {
                              e.stopPropagation()
                              onOpen(tmpl.id, true)
                            }}
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            variant="icon"
                            aria-label="Use template"
                            title="Use template"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCreateFromTemplate(tmpl.id)
                            }}
                          >
                            <Copy size={14} />
                          </Button>
                          <Button
                            variant="icon"
                            aria-label="Delete template"
                            title="Delete template"
                            onClick={(e) => handleDeleteTemplate(e, tmpl.id)}
                            className="text-danger"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </>
          ) : isMarketplaceView ? (
            /* ── Template Marketplace ── */
            <>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-text-primary">Template Marketplace</h2>
                <div className="relative flex-[0_1_360px] max-w-[260px]">
                  <Search
                    size={15}
                    className="absolute left-[11px] top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                  />
                  <Input
                    className="w-full pl-9 pr-8"
                    type="text"
                    placeholder="Search templates..."
                    value={marketplaceSearch}
                    onChange={(e) => setMarketplaceSearch(e.target.value)}
                  />
                  {marketplaceSearch && (
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors p-0.5 rounded"
                      onClick={() => setMarketplaceSearch('')}
                      aria-label="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-5">
                <Button
                  variant="ghost"
                  className={`${CATEGORY_PILL_CLASS} ${!marketplaceCategory ? '!bg-accent !border-accent !text-white' : ''}`}
                  onClick={() => setMarketplaceCategory('')}
                >
                  All
                </Button>
                {marketplaceData.categories.map((cat) => (
                  <Button
                    variant="ghost"
                    key={cat.id}
                    className={`${CATEGORY_PILL_CLASS} ${marketplaceCategory === cat.id ? '!bg-accent !border-accent !text-white' : ''}`}
                    onClick={() => setMarketplaceCategory(cat.id)}
                  >
                    {cat.name}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5">
                {(marketplaceCategory
                  ? marketplaceData.templates.filter((t) => t.category === marketplaceCategory)
                  : marketplaceData.templates
                )
                  .filter((t) => {
                    if (!marketplaceSearch.trim()) return true
                    const q = marketplaceSearch.toLowerCase()
                    return (
                      (t.title || '').toLowerCase().includes(q) ||
                      (t.titleVi || '').toLowerCase().includes(q) ||
                      (t.description || '').toLowerCase().includes(q) ||
                      (t.tags || []).some((tag) => tag.includes(q))
                    )
                  })
                  .map((tmpl) => {
                    const bg = getCardBg(tmpl.thumbnail)
                    const bgProp = isGradientOrImage(tmpl.thumbnail)
                      ? { background: bg }
                      : { backgroundColor: bg }
                    return (
                      <div
                        key={tmpl.id}
                        className={`${DASHBOARD_CARD_CLASS} cursor-pointer`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setPreviewTemplate(tmpl)}
                        onKeyDown={(event) =>
                          handleKeyboardClick(event, () => setPreviewTemplate(tmpl))
                        }
                      >
                        <SlideThumbnail id={tmpl.id} bgProp={bgProp} />
                        <div className="px-4 py-3">
                          <h3 className="text-[14px] font-semibold text-text-primary mb-1 truncate">
                            {tmpl.titleVi || tmpl.title}
                          </h3>
                          <p className="text-[12px] text-text-secondary truncate">
                            {tmpl.description}
                          </p>
                          <p className="text-[10px] text-text-muted mt-0.5">
                            {tmpl.slides?.length || 0} slides · {tmpl.category}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                {marketplaceData.templates.length === 0 && (
                  <div className="col-span-full text-center py-20 px-5 text-text-muted">
                    <Sparkles size={48} />
                    <p className="text-[17px] font-semibold text-text-secondary mb-2">
                      Loading templates...
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ── Presentations View (Recent / All) ── */
            <>
              {/* Welcome screen for empty state */}
              {presentations.length === 0 && !searchQuery ? (
                <div className="flex flex-col items-center justify-center py-20 px-10 text-center animate-fade-in">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-brand/25 bg-brand-muted text-brand shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
                    <Rocket size={28} />
                  </div>
                  <h1 className="text-2xl font-bold mb-2 tracking-tight text-text-primary">
                    Welcome to NavSlides Editor
                  </h1>
                  <p className="text-[15px] text-text-secondary mb-8 max-w-[420px]">
                    Create stunning presentations with WYSIWYG editing, LaTeX, charts, and more.
                  </p>
                  <div className="flex gap-3 flex-wrap justify-center">
                    <Button
                      variant="ghost"
                      data-testid="home-new-presentation-btn"
                      className={DASHBOARD_ACTION_TILE_CLASS}
                      onClick={handleOpenModal}
                    >
                      <Plus size={18} />
                      <span>Create your first presentation</span>
                    </Button>
                    <Button
                      variant="ghost"
                      className={DASHBOARD_ACTION_TILE_CLASS}
                      onClick={() => setSidebarView('templates')}
                    >
                      <LayoutTemplate size={18} />
                      <span>Browse templates</span>
                    </Button>
                  </div>
                  <p className="mt-10 text-[13px] text-text-muted">
                    WYSIWYG · LaTeX · Charts · Code · Export HTML / PDF / PPTX
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-text-primary">
                      {sidebarView === 'recent' ? 'Recent Presentations' : 'All Presentations'}
                    </h2>
                    <div className="flex items-center gap-2">
                      <Select
                        className="bg-card border border-border text-text-secondary py-1.5 px-2.5 rounded text-xs cursor-pointer focus:outline-none focus:border-accent"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                      >
                        <option value="updatedAt">Last modified</option>
                        <option value="createdAt">Date created</option>
                        <option value="title">Name</option>
                        <option value="slides">Slide count</option>
                      </Select>
                      <div className="flex shrink-0 bg-card border border-border rounded overflow-hidden">
                        <Button
                          variant="ghost"
                          className={`h-7 w-8 shrink-0 rounded-none border-none bg-transparent !px-0 !py-0 text-text-muted transition-colors hover:text-text-primary ${viewMode === 'grid' ? 'bg-accent text-white' : ''}`}
                          onClick={() => setViewMode('grid')}
                          title="Grid view"
                          aria-label="Grid view"
                        >
                          <Grid3x3 size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          className={`h-7 w-8 shrink-0 rounded-none border-none bg-transparent !px-0 !py-0 text-text-muted transition-colors hover:text-text-primary ${viewMode === 'list' ? 'bg-accent text-white' : ''}`}
                          onClick={() => setViewMode('list')}
                          title="List view"
                          aria-label="List view"
                        >
                          <List size={14} />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {filteredPresentations.length === 0 && searchQuery ? (
                    <div className="col-span-full text-center py-20 px-5 text-text-muted animate-fade-in">
                      <Search size={48} />
                      <p className="text-[17px] font-semibold text-text-secondary mb-2">
                        No matches found
                      </p>
                      <p className="text-sm text-text-muted mb-6">Try a different search term</p>
                    </div>
                  ) : viewMode === 'grid' ? (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5 animate-fade-in">
                      <div
                        data-testid="home-new-presentation-btn"
                        className="border-dashed border-2 border-border flex flex-col items-center justify-center gap-3 min-h-[200px] text-text-muted cursor-pointer transition-[background-color,border-color,color,box-shadow] duration-150 rounded-lg hover:border-accent hover:text-accent hover:bg-hover focus-visible:ring-2 focus-visible:ring-focus/30"
                        role="button"
                        tabIndex={0}
                        onClick={handleOpenModal}
                        onKeyDown={(event) => handleKeyboardClick(event, handleOpenModal)}
                      >
                        <Plus size={28} />
                        <span>New Presentation</span>
                      </div>
                      {filteredPresentations.map((pres) => {
                        const bg = getCardBg(pres.thumbnail)
                        const bgProp = isGradientOrImage(pres.thumbnail)
                          ? { background: bg }
                          : { backgroundColor: bg }
                        return (
                          <div
                            key={pres.id}
                            className={`${DASHBOARD_CARD_CLASS} flex h-full cursor-pointer flex-col`}
                            role="button"
                            tabIndex={0}
                            onClick={() => onOpen(pres.id)}
                            onKeyDown={(event) => handleKeyboardClick(event, () => onOpen(pres.id))}
                          >
                            <SlideThumbnail
                              id={pres.id}
                              bgProp={bgProp}
                              fallback={!pres.thumbnail || pres.thumbnail.type === 'none'}
                              className="aspect-video"
                            />
                            <div className="px-4 py-3 flex-1">
                              <h3 className="text-[14px] font-semibold text-text-primary mb-1 truncate">
                                {pres.title || 'Untitled'}
                              </h3>
                              <p className="text-[12px] text-text-secondary truncate">
                                {pres.slideCount} slide{pres.slideCount !== 1 ? 's' : ''} &middot;{' '}
                                {formatDate(pres.updatedAt)}
                              </p>
                            </div>
                            <div className="flex justify-end gap-1 px-3 py-2 border-t border-border">
                              <Button
                                variant="icon"
                                aria-label="Edit"
                                title="Edit"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onOpen(pres.id)
                                }}
                              >
                                <Pencil size={14} />
                              </Button>
                              <Button
                                variant="icon"
                                aria-label="Duplicate"
                                title="Duplicate"
                                onClick={(e) => handleDuplicate(e, pres.id)}
                              >
                                <Copy size={14} />
                              </Button>
                              <Button
                                variant="icon"
                                aria-label="Delete"
                                title="Delete"
                                onClick={(e) => handleDelete(e, pres.id)}
                                className="text-danger"
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    /* List View */
                    <div className="flex flex-col gap-0.5 animate-fade-in">
                      {filteredPresentations.map((pres) => {
                        const bg = getCardBg(pres.thumbnail)
                        const bgProp = isGradientOrImage(pres.thumbnail)
                          ? { background: bg }
                          : { backgroundColor: bg }
                        return (
                          <div
                            key={pres.id}
                            className="group flex items-center gap-4 px-4 py-3 rounded transition-colors hover:bg-hover"
                          >
                            <div className="w-20 h-[45px] rounded flex-shrink-0 overflow-hidden relative">
                              <SlideThumbnail
                                id={pres.id}
                                bgProp={bgProp}
                                fallback={!pres.thumbnail || pres.thumbnail.type === 'none'}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3
                                className="mb-1 cursor-pointer truncate rounded text-[14px] font-semibold text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/30"
                                role="button"
                                tabIndex={0}
                                onClick={() => onOpen(pres.id)}
                                onKeyDown={(event) =>
                                  handleKeyboardClick(event, () => onOpen(pres.id))
                                }
                              >
                                {pres.title || 'Untitled'}
                              </h3>
                              <p className="text-[12px] text-text-secondary truncate">
                                {pres.slideCount} slide{pres.slideCount !== 1 ? 's' : ''} &middot;{' '}
                                {formatDate(pres.updatedAt)}
                              </p>
                            </div>
                            <div className="flex justify-end gap-1 px-3 py-2 border-t border-border">
                              <Button
                                variant="icon"
                                aria-label="Edit"
                                title="Edit"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onOpen(pres.id)
                                }}
                              >
                                <Pencil size={14} />
                              </Button>
                              <Button
                                variant="icon"
                                aria-label="Duplicate"
                                title="Duplicate"
                                onClick={(e) => handleDuplicate(e, pres.id)}
                              >
                                <Copy size={14} />
                              </Button>
                              <Button
                                variant="icon"
                                aria-label="Delete"
                                title="Delete"
                                onClick={(e) => handleDelete(e, pres.id)}
                                className="text-danger"
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ════ Create Modal ════ */}
      {showModal && (
        <ModalShell
          titleId="create-presentation-title"
          title="New Presentation"
          size="lg"
          onClose={() => setShowModal(false)}
        >
            <form onSubmit={handleCreate}>
              <div className="mb-3">
                <label
                  className="mb-1 block text-xs font-medium text-text-secondary"
                  htmlFor="create-presentation-title-input"
                >
                  Title
                </label>
                <Input
                  id="create-presentation-title-input"
                  type="text"
                  placeholder="My Presentation"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  autoFocus
                />
              </div>

              {/* Template selector */}
              <div className="mb-3">
                <div
                  id="create-presentation-template-label"
                  className="mb-1 block text-xs font-medium text-text-secondary"
                >
                  Start from
                </div>
                <div
                  className="grid grid-cols-3 gap-2 mb-1"
                  role="group"
                  aria-labelledby="create-presentation-template-label"
                >
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, templateId: null }))}
                    className={`h-auto min-h-[42px] px-2 py-2.5 rounded-sm border-2 text-center text-xs font-medium ${getTemplateStartButtonStateClassName(!form.templateId)}`}
                  >
                    Blank
                  </Button>
                  {allTemplates
                    .filter(
                      (tmpl) =>
                        tmpl.title &&
                        tmpl.title !== 'New Template' &&
                        tmpl.title !== 'Untitled Template'
                    )
                    .map((tmpl) => (
                      <Button
                        variant="ghost"
                        key={tmpl.id}
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            templateId: tmpl.id,
                            theme: tmpl.theme || f.theme,
                            transition: tmpl.transition || f.transition,
                          }))
                        }
                        className={`h-auto min-h-[54px] px-2 py-1.5 rounded-sm border-2 text-center text-[11px] font-medium overflow-hidden flex flex-col ${getTemplateStartButtonStateClassName(form.templateId === tmpl.id)}`}
                    >
                      <div
                        className="h-7 rounded-[3px] mb-1 w-full"
                        style={
                          isGradientOrImage(tmpl.thumbnail)
                            ? { background: getCardBg(tmpl.thumbnail) }
                            : { backgroundColor: getCardBg(tmpl.thumbnail) }
                        }
                      />
                      {tmpl.title}
                    </Button>
                  ))}
                </div>
              </div>

              {!form.templateId && (
                <>
                  <div className="mb-3">
                    <label
                      className="mb-1 block text-xs font-medium text-text-secondary"
                      htmlFor="create-presentation-theme"
                    >
                      Theme
                    </label>
                    <Select
                      id="create-presentation-theme"
                      value={form.theme}
                      onChange={(e) => setForm((f) => ({ ...f, theme: e.target.value }))}
                    >
                      {THEMES.map((t) => (
                        <option key={t} value={t}>
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="mb-3">
                    <label
                      className="mb-1 block text-xs font-medium text-text-secondary"
                      htmlFor="create-presentation-transition"
                    >
                      Transition
                    </label>
                    <Select
                      id="create-presentation-transition"
                      value={form.transition}
                      onChange={(e) => setForm((f) => ({ ...f, transition: e.target.value }))}
                    >
                      {TRANSITIONS.map((t) => (
                        <option key={t} value={t}>
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </option>
                      ))}
                    </Select>
                  </div>
                </>
              )}
              <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
                <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={creating}>
                  {creating ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </form>
        </ModalShell>
      )}

      {/* ════ Template Preview Modal ════ */}
      {previewTemplate && (
        <TemplatePreview
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          onUseAsNew={async (tmpl) => {
            if (creating) return
            setCreating(true)
            try {
              const pres = await api.createPresentation({
                title: tmpl.titleVi || tmpl.title,
                theme: tmpl.theme,
                transition: tmpl.transition,
                slides: tmpl.slides.map((s) => ({
                  ...s,
                  id: crypto.randomUUID(),
                  elements: (s.elements || []).map((el) => ({ ...el, id: crypto.randomUUID() })),
                })),
              })
              setPreviewTemplate(null)
              onOpen(pres.id)
            } catch (err) {
              console.error('Failed to create from marketplace template', err)
            } finally {
              setCreating(false)
            }
          }}
        />
      )}

      {/* ════ Confirm Dialog ════ */}
      {confirmDialog && (
        <ModalShell
          titleId="confirm-dialog-title"
          title={confirmDialog.title}
          size="sm"
          onClose={() => setConfirmDialog(null)}
        >
            <div className="flex items-start gap-3.5">
              <div
                className={`w-10 h-10 rounded-md shrink-0 flex items-center justify-center ${
                  confirmDialog.variant === 'danger' ? 'bg-danger/10' : 'bg-warning/10'
                }`}
              >
                <AlertCircle
                  size={22}
                  className={confirmDialog.variant === 'danger' ? 'text-danger' : 'text-warning'}
                />
              </div>
              <div className="flex-1">
                <p className="text-sm text-text-secondary leading-relaxed">
                  {confirmDialog.message}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="secondary" onClick={() => setConfirmDialog(null)}>
                Cancel
              </Button>
              <Button
                variant={confirmDialog.variant === 'danger' ? 'danger' : 'primary'}
                onClick={() => {
                  confirmDialog.onConfirm()
                  setConfirmDialog(null)
                }}
              >
                {confirmDialog.variant === 'danger' ? 'Delete' : 'Confirm'}
              </Button>
            </div>
        </ModalShell>
      )}
    </div>
  )
}

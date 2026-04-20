import { useState, useEffect, useMemo } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Presentation,
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
  LayoutTemplate,
  Trash,
  Sparkles,
  RotateCcw,
  Globe,
  AlertCircle,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../utils/api'
import { markdownToSlides } from '../utils/markdown-import'
import { parseProjectFile, validateProjectFile, rewriteMediaUrls } from '../utils/import-project'
import TemplatePreview from '../components/dashboard/TemplatePreview'

const THEMES = [
  'black', 'white', 'league', 'beige', 'sky',
  'night', 'serif', 'simple', 'solarized', 'moon', 'dracula',
]
const TRANSITIONS = ['none', 'fade', 'slide', 'convex', 'concave', 'zoom']

// ── Preset themes (built-in, not stored on server) ──
const PRESET_THEMES = [
  {
    id: '__preset_minimal_dark',
    title: 'Minimal Dark',
    category: 'Creative',
    theme: 'black',
    transition: 'fade',
    slides: [
      {
        id: 's1',
        elements: [
          { type: 'text', x: 80, y: 180, width: 800, height: 100, zIndex: 1, content: '<h1 style="text-align:center; color:white">Presentation Title</h1>' },
          { type: 'text', x: 200, y: 300, width: 560, height: 60, zIndex: 2, content: '<p style="text-align:center; color:rgba(255,255,255,0.5)">Your Name &middot; Date</p>' },
        ],
        background: { type: 'color', color: '#0f0f1a' },
      },
      {
        id: 's2',
        elements: [
          { type: 'text', x: 60, y: 40, width: 840, height: 70, zIndex: 1, content: '<h2 style="color:white">Section Title</h2>' },
          { type: 'shape', shape: 'rect', x: 60, y: 110, width: 840, height: 2, zIndex: 2, fill: '#6366f1', stroke: 'none', strokeWidth: 0, locked: true },
          { type: 'text', x: 60, y: 130, width: 840, height: 360, zIndex: 3, content: '<p style="color:rgba(255,255,255,0.8)">Content goes here</p>' },
        ],
        background: { type: 'color', color: '#0f0f1a' },
      },
    ],
    thumbnail: { type: 'color', color: '#0f0f1a' },
    description: 'Clean dark theme with indigo accents',
  },
  {
    id: '__preset_minimal_light',
    title: 'Minimal Light',
    category: 'Creative',
    theme: 'white',
    transition: 'fade',
    slides: [
      {
        id: 's1',
        elements: [
          { type: 'text', x: 80, y: 180, width: 800, height: 100, zIndex: 1, content: '<h1 style="text-align:center; color:#1a1a2e">Presentation Title</h1>' },
          { type: 'text', x: 200, y: 300, width: 560, height: 60, zIndex: 2, content: '<p style="text-align:center; color:#666">Your Name &middot; Date</p>' },
        ],
        background: { type: 'color', color: '#fafafa' },
      },
      {
        id: 's2',
        elements: [
          { type: 'text', x: 60, y: 40, width: 840, height: 70, zIndex: 1, content: '<h2 style="color:#1a1a2e">Section Title</h2>' },
          { type: 'shape', shape: 'rect', x: 60, y: 110, width: 840, height: 2, zIndex: 2, fill: '#3b82f6', stroke: 'none', strokeWidth: 0, locked: true },
          { type: 'text', x: 60, y: 130, width: 840, height: 360, zIndex: 3, content: '<p style="color:#333">Content goes here</p>' },
        ],
        background: { type: 'color', color: '#fafafa' },
      },
    ],
    thumbnail: { type: 'color', color: '#fafafa' },
    description: 'Clean light theme with blue accents',
  },
  {
    id: '__preset_academic',
    title: 'Academic',
    category: 'Academic',
    theme: 'white',
    transition: 'slide',
    footerMode: 'sequence',
    sequenceSections: ['Introduction', 'Methods', 'Results', 'Discussion'],
    showFooter: true,
    showPageNumbers: true,
    footerFontFamily: "'Latin Modern Roman',serif",
    footerColor: '#1a1a2e',
    footerInactiveColor: '#b0b0c0',
    slides: [
      {
        id: 's1',
        elements: [
          { type: 'text', x: 60, y: 120, width: 840, height: 120, zIndex: 1, content: '<h1 style="text-align:center; font-family: Latin Modern Roman, serif; color:#1a1a2e">Research Paper Title</h1>' },
          { type: 'text', x: 160, y: 260, width: 640, height: 50, zIndex: 2, content: '<p style="text-align:center; font-family: Latin Modern Roman, serif; color:#444">Author Name<br>Institution</p>' },
          { type: 'text', x: 260, y: 360, width: 440, height: 40, zIndex: 3, content: '<p style="text-align:center; font-family: Latin Modern Roman, serif; color:#888; font-size:18px">Conference / Date</p>' },
        ],
        background: { type: 'color', color: '#ffffff' },
        activeSection: 0,
      },
      {
        id: 's2',
        elements: [
          { type: 'text', x: 60, y: 30, width: 840, height: 60, zIndex: 1, content: '<h2 style="font-family: Latin Modern Roman, serif; color:#1a1a2e">Outline</h2>' },
          { type: 'shape', shape: 'rect', x: 60, y: 90, width: 840, height: 1, zIndex: 2, fill: '#ccc', stroke: 'none', strokeWidth: 0, locked: true },
          { type: 'text', x: 60, y: 110, width: 840, height: 380, zIndex: 3, content: '<ul style="font-family: Latin Modern Roman, serif; color:#333; font-size:24px"><li>Introduction &amp; Motivation</li><li>Methods</li><li>Results</li><li>Discussion &amp; Conclusion</li></ul>' },
        ],
        background: { type: 'color', color: '#ffffff' },
        activeSection: 0,
      },
    ],
    thumbnail: { type: 'color', color: '#ffffff' },
    description: 'Serif fonts, sequence footer, academic layout',
  },
  {
    id: '__preset_gradient',
    title: 'Gradient',
    category: 'Creative',
    theme: 'black',
    transition: 'slide',
    slides: [
      {
        id: 's1',
        elements: [
          { type: 'text', x: 80, y: 160, width: 800, height: 120, zIndex: 1, content: '<h1 style="text-align:center; color:white">Bold Statement</h1>' },
          { type: 'text', x: 200, y: 300, width: 560, height: 60, zIndex: 2, content: '<p style="text-align:center; color:rgba(255,255,255,0.6)">Supporting context</p>' },
        ],
        background: { type: 'gradient', gradient: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)' },
      },
      {
        id: 's2',
        elements: [
          { type: 'text', x: 60, y: 40, width: 840, height: 70, zIndex: 1, content: '<h2 style="color:white">Topic</h2>' },
          { type: 'text', x: 60, y: 130, width: 420, height: 360, zIndex: 2, content: '<p style="color:rgba(255,255,255,0.85)">Left column</p>' },
          { type: 'text', x: 520, y: 130, width: 400, height: 360, zIndex: 3, content: '<p style="color:rgba(255,255,255,0.85)">Right column</p>' },
        ],
        background: { type: 'gradient', gradient: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)' },
      },
    ],
    thumbnail: { type: 'gradient', gradient: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)' },
    description: 'Teal-to-dark gradient backgrounds',
  },
  {
    id: '__preset_corporate',
    title: 'Corporate',
    category: 'Corporate',
    theme: 'white',
    transition: 'slide',
    showFooter: true,
    showPageNumbers: true,
    footerColor: '#334155',
    slides: [
      {
        id: 's1',
        elements: [
          { type: 'shape', shape: 'rect', x: 0, y: 0, width: 960, height: 200, zIndex: 0, fill: '#1e293b', stroke: 'none', strokeWidth: 0, locked: true },
          { type: 'text', x: 60, y: 50, width: 840, height: 100, zIndex: 1, content: '<h1 style="text-align:center; color:white">Company Name</h1>' },
          { type: 'text', x: 60, y: 150, width: 840, height: 40, zIndex: 2, content: '<p style="text-align:center; color:rgba(255,255,255,0.6); font-size:18px">Quarterly Business Review</p>' },
          { type: 'text', x: 200, y: 280, width: 560, height: 100, zIndex: 3, content: '<p style="text-align:center; color:#334155">Presented by Team Lead<br>Q1 2026</p>' },
        ],
        background: { type: 'color', color: '#f8fafc' },
      },
      {
        id: 's2',
        elements: [
          { type: 'shape', shape: 'rect', x: 0, y: 0, width: 960, height: 60, zIndex: 0, fill: '#1e293b', stroke: 'none', strokeWidth: 0, locked: true },
          { type: 'text', x: 30, y: 10, width: 900, height: 40, zIndex: 1, content: '<h3 style="color:white">Agenda</h3>' },
          { type: 'text', x: 60, y: 80, width: 840, height: 400, zIndex: 2, content: '<ul style="color:#334155; font-size:22px"><li>Key Metrics</li><li>Achievements</li><li>Challenges</li><li>Next Steps</li></ul>' },
        ],
        background: { type: 'color', color: '#f8fafc' },
      },
    ],
    thumbnail: { type: 'color', color: '#1e293b' },
    description: 'Professional with navy header bar',
  },
  {
    id: '__preset_neon',
    title: 'Neon',
    category: 'Creative',
    theme: 'black',
    transition: 'zoom',
    slides: [
      {
        id: 's1',
        elements: [
          { type: 'text', x: 80, y: 160, width: 800, height: 120, zIndex: 1, content: '<h1 style="text-align:center; color:#e879f9">Neon Title</h1>' },
          { type: 'text', x: 200, y: 300, width: 560, height: 60, zIndex: 2, content: '<p style="text-align:center; color:#22d3ee">Subtitle goes here</p>' },
        ],
        background: { type: 'gradient', gradient: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' },
      },
      {
        id: 's2',
        elements: [
          { type: 'text', x: 60, y: 40, width: 840, height: 70, zIndex: 1, content: '<h2 style="color:#e879f9">Topic</h2>' },
          { type: 'shape', shape: 'rect', x: 60, y: 110, width: 840, height: 2, zIndex: 2, fill: '#22d3ee', stroke: 'none', strokeWidth: 0, locked: true },
          { type: 'text', x: 60, y: 130, width: 840, height: 360, zIndex: 3, content: '<p style="color:rgba(255,255,255,0.8)">Content</p>' },
        ],
        background: { type: 'gradient', gradient: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' },
      },
    ],
    thumbnail: { type: 'gradient', gradient: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' },
    description: 'Dark purple with neon pink & cyan',
  },
]

const TEMPLATE_CATEGORIES = [
  'All', 'Creative', 'Academic', 'Corporate',
  'Kỹ thuật số', 'Vi xử lý', 'Lý thuyết mạch',
  'Điện tử', 'Tự động hoá', 'Điện',
  'Đo lường', 'ĐTCS', 'Cơ khí', 'VKT', 'Thuỷ khí',
]

function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
  const [form, setForm] = useState({ title: '', theme: 'black', transition: 'slide', templateId: null })
  const [creating, setCreating] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState(null) // { title, message, onConfirm, variant }

  // Dashboard state
  const [sidebarView, setSidebarView] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('updatedAt')
  const [viewMode, setViewMode] = useState('grid')
  const [templateCategory, setTemplateCategory] = useState('All')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [presData, tmplData, trashData] = await Promise.all([
        api.getPresentations(), api.getTemplates(), api.getTrash(),
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
        const preset = PRESET_THEMES.find((p) => p.id === templateId)
        if (!preset) return
        // eslint-disable-next-line unused-imports/no-unused-vars
        const { id, thumbnail, description, category, ...data } = preset
        const pres = await api.createPresentation({
          ...data,
          title: data.title,
          slides: data.slides.map((s) => ({
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
        slides: [{
          id: crypto.randomUUID(),
          elements: [{
            id: crypto.randomUUID(),
            type: 'text', x: 80, y: 160, width: 800, height: 220, zIndex: 1,
            content: '<h2 style="text-align: center">Template Title</h2><p style="text-align: center">Edit this template</p>',
          }],
          notes: '',
          background: { type: 'color', color: '#1e1e2e' },
        }],
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

  // eslint-disable-next-line unused-imports/no-unused-vars
  const [importProgress, setImportProgress] = useState(null)

  async function handleImportPdf(file) {
    if (!file) return
    setImportProgress('Loading PDF...')
    try {
      const { pdfToSlides } = await import('../utils/pdf-import.js')
      const slides = await pdfToSlides(file, (cur, total) => {
        setImportProgress(`Converting page ${cur}/${total}...`)
      })
      if (slides.length === 0) {
        alert('No pages found in PDF')
        return
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
    try {
      const text = await file.text()
      const slides = markdownToSlides(text)
      if (slides.length === 0) {
        alert('No content found in Markdown')
        return
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
      if (parsed.type === 'zip' && parsed.mediaFiles && Object.keys(parsed.mediaFiles).length > 0) {
        setImportProgress('Uploading media files...')
        const urlMap = {}
        for (const [name, blob] of Object.entries(parsed.mediaFiles)) {
          try {
            const uploaded = await api.uploadFile(new File([blob], name))
            urlMap[`/uploads/${name}`] = uploaded.url || `/uploads/${uploaded.filename}`
          } catch (err) {
            console.warn('Failed to upload media:', name, err)
          }
        }
        if (Object.keys(urlMap).length > 0) {
          finalPres = rewriteMediaUrls(finalPres, urlMap)
        }
      }

      setImportProgress('Creating presentation...')
      finalPres.title = (finalPres.title || 'Imported') + ' (Imported)'
      const pres = await api.createPresentation({
        ...finalPres,
        slides: finalPres.slides,
      })
      onOpen(pres.id)
    } catch (err) {
      console.error('Project import failed:', err)
      alert('Failed to import project: ' + err.message)
    } finally {
      setImportProgress(null)
    }
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
        case 'title': return (a.title || '').localeCompare(b.title || '')
        case 'createdAt': return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        case 'slides': return (b.slideCount || 0) - (a.slideCount || 0)
        default: return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
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
    return PRESET_THEMES.filter((p) => p.category === templateCategory)
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
  }, [isMarketplaceView])

  return (
    <div className="home-page">
      {/* ════ Header ════ */}
      <div className="home-header">
        <div className="home-header-left">
          <div className="home-logo">
            <div className="home-logo-icon">N</div>
            <span>NavSlides Editor</span>
          </div>
        </div>

        {/* Search */}
        <div className="home-search">
          <Search size={15} className="home-search-icon" />
          <input
            className="home-search-input"
            type="text"
            placeholder="Search presentations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="home-header-actions">
          <button
            className="btn-icon"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            className="btn-icon"
            onClick={() => navigate('/settings')}
            title="Settings"
          >
            <Settings2 size={16} />
          </button>
          <button className="btn btn-primary" onClick={handleOpenModal}>
            <Plus size={16} />
            New
          </button>
        </div>
      </div>

      {/* ════ Body: Sidebar + Content ════ */}
      <div className="home-body">
        {/* Sidebar */}
        <nav className="home-sidebar">
          <div className="sidebar-section">
            {SIDEBAR_VIEWS.map((item) => (
              <button
                key={item.key}
                className={`sidebar-item ${sidebarView === item.key ? 'active' : ''}`}
                onClick={() => setSidebarView(item.key)}
              >
                <item.icon size={16} />
                <span>{item.label}</span>
                {item.key === 'all' && (
                  <span className="sidebar-item-count">{presentations.length}</span>
                )}
              </button>
            ))}
          </div>

          <div className="sidebar-divider" />

          <div className="sidebar-section">
            <div className="sidebar-section-title">Templates</div>
            <button
              className={`sidebar-item ${sidebarView === 'templates' ? 'active' : ''}`}
              onClick={() => setSidebarView('templates')}
            >
              <LayoutTemplate size={16} />
              <span>Built-in</span>
              <span className="sidebar-item-count">{PRESET_THEMES.length}</span>
            </button>
            <button
              className={`sidebar-item ${sidebarView === 'my-templates' ? 'active' : ''}`}
              onClick={() => setSidebarView('my-templates')}
            >
              <Layout size={16} />
              <span>My Templates</span>
              <span className="sidebar-item-count">{templates.length}</span>
            </button>
            <button
              className={`sidebar-item ${sidebarView === 'marketplace' ? 'active' : ''}`}
              onClick={() => setSidebarView('marketplace')}
            >
              <Sparkles size={16} />
              <span>Marketplace</span>
            </button>
          </div>

          <div className="sidebar-divider" />

          <div className="sidebar-section">
            <div className="sidebar-section-title">Import</div>
            <label className="sidebar-item" style={{ cursor: 'pointer' }}>
              <BookOpen size={16} />
              <span>Import PDF</span>
              <input
                type="file"
                accept=".pdf"
                style={{ display: 'none' }}
                onChange={(e) => {
                  handleImportPdf(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>
            <label className="sidebar-item" style={{ cursor: 'pointer' }}>
              <BookOpen size={16} />
              <span>Import Markdown</span>
              <input
                type="file"
                accept=".md,.markdown,.txt"
                style={{ display: 'none' }}
                onChange={(e) => {
                  handleImportMarkdown(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>
            <label className="sidebar-item" style={{ cursor: 'pointer' }}>
              <FolderOpen size={16} />
              <span>Import Project</span>
              <input
                type="file"
                accept=".navslides,.json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  handleImportProject(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>
          </div>

          <div className="sidebar-divider" />

          <div className="sidebar-section">
            <button
              className="sidebar-item"
              onClick={() => navigate('/explore')}
            >
              <Globe size={16} />
              <span>Explore</span>
            </button>
          </div>

          <div className="sidebar-divider" />

          <div className="sidebar-section">
            <button
              className={`sidebar-item ${sidebarView === 'trash' ? 'active' : ''}`}
              onClick={() => setSidebarView('trash')}
            >
              <Trash size={16} />
              <span>Trash</span>
              {trashItems.length > 0 && (
                <span className="sidebar-item-count">{trashItems.length}</span>
              )}
            </button>
          </div>
        </nav>

        {/* Main Content */}
        <div className="home-content">
          {loading ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '80px' }}>
              Loading...
            </div>
          ) : isTrashView ? (
            /* ── Trash View ── */
            <>
              <div className="home-content-header">
                <h2 className="home-content-title">Trash</h2>
                {trashItems.length > 0 && (
                  <button className="btn btn-danger" onClick={handleEmptyTrash} style={{ fontSize: 12 }}>
                    <Trash2 size={14} /> Empty Trash
                  </button>
                )}
              </div>
              {trashItems.length === 0 ? (
                <div className="empty-state anim-fade-in">
                  <Trash size={48} />
                  <p className="empty-state-title">Trash is empty</p>
                  <p className="empty-state-desc">Deleted presentations will appear here</p>
                </div>
              ) : (
                <div className="presentations-grid anim-fade-in">
                  {trashItems.map((pres) => {
                    const bg = getCardBg(pres.thumbnail)
                    const bgProp = isGradientOrImage(pres.thumbnail)
                      ? { background: bg }
                      : { backgroundColor: bg }
                    return (
                      <div key={pres.id} className="presentation-card" style={{ opacity: 0.7, cursor: 'default' }}>
                        <div className="card-preview" style={bgProp}>
                          <Trash size={24} style={{ opacity: 0.3 }} />
                        </div>
                        <div className="card-info">
                          <h3>{pres.title || 'Untitled'}</h3>
                          <p>
                            {pres.slideCount} slide{pres.slideCount !== 1 ? 's' : ''} · Deleted{' '}
                            {formatDate(pres.deletedAt)}
                          </p>
                        </div>
                        <div className="card-actions" style={{ opacity: 1 }}>
                          <button className="btn-icon" title="Restore" onClick={(e) => handleRestore(e, pres.id)}>
                            <RotateCcw size={14} />
                          </button>
                          <button className="btn-icon" title="Delete permanently" onClick={(e) => handlePermanentDelete(e, pres.id)} style={{ color: 'var(--danger)' }}>
                            <Trash2 size={14} />
                          </button>
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
              <div className="home-content-header">
                <h2 className="home-content-title">Template Gallery</h2>
              </div>
              <div className="template-categories">
                {TEMPLATE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    className={`template-category-btn ${templateCategory === cat ? 'active' : ''}`}
                    onClick={() => setTemplateCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="presentations-grid">
                {filteredPresets.map((preset) => {
                  const bg = getCardBg(preset.thumbnail)
                  const bgProp = isGradientOrImage(preset.thumbnail)
                    ? { background: bg }
                    : { backgroundColor: bg }
                  return (
                    <div
                      key={preset.id}
                      className="presentation-card"
                      onClick={() => handleCreateFromTemplate(preset.id, true)}
                      style={{ cursor: creating ? 'wait' : 'pointer' }}
                    >
                      <div className="card-preview" style={bgProp}>
                        <Sparkles size={20} style={{ position: 'absolute', top: 8, right: 8, opacity: 0.3 }} />
                      </div>
                      <div className="card-info">
                        <h3>{preset.title}</h3>
                        <p>{preset.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : isMyTemplateView ? (
            /* ── My Templates ── */
            <>
              <div className="home-content-header">
                <h2 className="home-content-title">My Templates</h2>
                <button className="btn btn-secondary" onClick={handleCreateTemplate}>
                  <Plus size={14} /> New Template
                </button>
              </div>
              <div className="presentations-grid">
                {templates.length === 0 ? (
                  <div className="empty-state">
                    <Layout size={48} />
                    <p className="empty-state-title">No custom templates yet</p>
                    <p className="empty-state-desc">Create a template to reuse across presentations</p>
                    <button className="btn btn-primary" onClick={handleCreateTemplate}>
                      <Plus size={14} /> Create Template
                    </button>
                  </div>
                ) : (
                  templates.map((tmpl) => {
                    const bg = getCardBg(tmpl.thumbnail)
                    const bgProp = isGradientOrImage(tmpl.thumbnail)
                      ? { background: bg }
                      : { backgroundColor: bg }
                    return (
                      <div key={tmpl.id} className="presentation-card" onClick={() => onOpen(tmpl.id, true)}>
                        <div className="card-preview" style={bgProp}>
                          <Layout size={24} style={{ position: 'absolute', top: 6, right: 6, opacity: 0.5 }} />
                        </div>
                        <div className="card-info">
                          <h3>{tmpl.title || 'Untitled Template'}</h3>
                          <p>
                            {tmpl.slideCount} slide{tmpl.slideCount !== 1 ? 's' : ''} &middot;{' '}
                            {formatDate(tmpl.updatedAt)}
                          </p>
                        </div>
                        <div className="card-actions">
                          <button className="btn-icon" title="Edit template" onClick={(e) => { e.stopPropagation(); onOpen(tmpl.id, true) }}>
                            <Pencil size={14} />
                          </button>
                          <button className="btn-icon" title="Use template" onClick={(e) => { e.stopPropagation(); handleCreateFromTemplate(tmpl.id) }}>
                            <Copy size={14} />
                          </button>
                          <button className="btn-icon" title="Delete template" onClick={(e) => handleDeleteTemplate(e, tmpl.id)} style={{ color: 'var(--danger)' }}>
                            <Trash2 size={14} />
                          </button>
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
              <div className="home-content-header">
                <h2 className="home-content-title">Template Marketplace</h2>
                <div className="home-search" style={{ maxWidth: 260 }}>
                  <Search size={15} className="home-search-icon" />
                  <input
                    className="home-search-input"
                    type="text"
                    placeholder="Search templates..."
                    value={marketplaceSearch}
                    onChange={(e) => setMarketplaceSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="template-categories">
                <button
                  className={`template-category-btn ${!marketplaceCategory ? 'active' : ''}`}
                  onClick={() => setMarketplaceCategory('')}
                >
                  All
                </button>
                {marketplaceData.categories.map((cat) => (
                  <button
                    key={cat.id}
                    className={`template-category-btn ${marketplaceCategory === cat.id ? 'active' : ''}`}
                    onClick={() => setMarketplaceCategory(cat.id)}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
              <div className="presentations-grid">
                {(marketplaceCategory
                  ? marketplaceData.templates.filter((t) => t.category === marketplaceCategory)
                  : marketplaceData.templates
                ).filter((t) => {
                  if (!marketplaceSearch.trim()) return true;
                  const q = marketplaceSearch.toLowerCase();
                  return (t.title || '').toLowerCase().includes(q) ||
                    (t.titleVi || '').toLowerCase().includes(q) ||
                    (t.description || '').toLowerCase().includes(q) ||
                    (t.tags || []).some(tag => tag.includes(q));
                }).map((tmpl) => {
                  const bg = getCardBg(tmpl.thumbnail)
                  const bgProp = isGradientOrImage(tmpl.thumbnail) ? { background: bg } : { backgroundColor: bg }
                  return (
                    <div
                      key={tmpl.id}
                      className="presentation-card"
                      onClick={() => setPreviewTemplate(tmpl)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="card-preview" style={bgProp}>
                        <Sparkles size={16} style={{ position: 'absolute', top: 6, right: 6, opacity: 0.4 }} />
                      </div>
                      <div className="card-info">
                        <h3>{tmpl.titleVi || tmpl.title}</h3>
                        <p>{tmpl.description}</p>
                        <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                          {tmpl.slides?.length || 0} slides · {tmpl.category}
                        </p>
                      </div>
                    </div>
                  )
                })}
                {marketplaceData.templates.length === 0 && (
                  <div className="empty-state">
                    <Sparkles size={48} />
                    <p className="empty-state-title">Loading templates...</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ── Presentations View (Recent / All) ── */
            <>
              {/* Welcome screen for empty state */}
              {presentations.length === 0 && !searchQuery ? (
                <div className="welcome-screen anim-fade-in">
                  <div className="welcome-icon">
                    <Rocket size={28} />
                  </div>
                  <h1 className="welcome-title">Welcome to NavSlides Editor</h1>
                  <p className="welcome-subtitle">
                    Create stunning presentations with WYSIWYG editing, LaTeX, charts, and more.
                  </p>
                  <div className="welcome-actions">
                    <button className="welcome-action-btn" onClick={handleOpenModal}>
                      <Plus size={18} />
                      Create your first presentation
                    </button>
                    <button className="welcome-action-btn" onClick={() => setSidebarView('templates')}>
                      <LayoutTemplate size={18} />
                      Browse templates
                    </button>
                  </div>
                  <p className="welcome-features">
                    WYSIWYG · LaTeX · Charts · Code · Export HTML / PDF / PPTX
                  </p>
                </div>
              ) : (
                <>
                  <div className="home-content-header">
                    <h2 className="home-content-title">
                      {sidebarView === 'recent' ? 'Recent Presentations' : 'All Presentations'}
                    </h2>
                    <div className="home-content-controls">
                      <select
                        className="sort-select"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                      >
                        <option value="updatedAt">Last modified</option>
                        <option value="createdAt">Date created</option>
                        <option value="title">Name</option>
                        <option value="slides">Slide count</option>
                      </select>
                      <div className="view-toggle">
                        <button
                          className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                          onClick={() => setViewMode('grid')}
                          title="Grid view"
                        >
                          <Grid3x3 size={14} />
                        </button>
                        <button
                          className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                          onClick={() => setViewMode('list')}
                          title="List view"
                        >
                          <List size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {filteredPresentations.length === 0 && searchQuery ? (
                    <div className="empty-state anim-fade-in">
                      <Search size={48} />
                      <p className="empty-state-title">No matches found</p>
                      <p className="empty-state-desc">Try a different search term</p>
                    </div>
                  ) : viewMode === 'grid' ? (
                    <div className="presentations-grid anim-fade-in">
                      <div className="new-card" onClick={handleOpenModal}>
                        <Plus size={28} />
                        <span>New Presentation</span>
                      </div>
                      {filteredPresentations.map((pres) => {
                        const bg = getCardBg(pres.thumbnail)
                        const bgProp = isGradientOrImage(pres.thumbnail)
                          ? { background: bg }
                          : { backgroundColor: bg }
                        return (
                          <div key={pres.id} className="presentation-card" onClick={() => onOpen(pres.id)}>
                            <div className="card-preview" style={bgProp}>
                              {(!pres.thumbnail || pres.thumbnail.type === 'none') && (
                                <Presentation size={36} />
                              )}
                            </div>
                            <div className="card-info">
                              <h3>{pres.title || 'Untitled'}</h3>
                              <p>
                                {pres.slideCount} slide{pres.slideCount !== 1 ? 's' : ''} &middot;{' '}
                                {formatDate(pres.updatedAt)}
                              </p>
                            </div>
                            <div className="card-actions">
                              <button className="btn-icon" title="Edit" onClick={(e) => { e.stopPropagation(); onOpen(pres.id) }}>
                                <Pencil size={14} />
                              </button>
                              <button className="btn-icon" title="Duplicate" onClick={(e) => handleDuplicate(e, pres.id)}>
                                <Copy size={14} />
                              </button>
                              <button className="btn-icon" title="Delete" onClick={(e) => handleDelete(e, pres.id)} style={{ color: 'var(--danger)' }}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    /* List View */
                    <div className="presentations-list anim-fade-in">
                      {filteredPresentations.map((pres) => {
                        const bg = getCardBg(pres.thumbnail)
                        const bgProp = isGradientOrImage(pres.thumbnail)
                          ? { background: bg }
                          : { backgroundColor: bg }
                        return (
                          <div key={pres.id} className="presentation-list-item" onClick={() => onOpen(pres.id)}>
                            <div className="list-item-preview" style={bgProp} />
                            <div className="list-item-info">
                              <h3>{pres.title || 'Untitled'}</h3>
                              <p>
                                {pres.slideCount} slide{pres.slideCount !== 1 ? 's' : ''} &middot;{' '}
                                {formatDate(pres.updatedAt)}
                              </p>
                            </div>
                            <div className="list-item-actions">
                              <button className="btn-icon" title="Edit" onClick={(e) => { e.stopPropagation(); onOpen(pres.id) }}>
                                <Pencil size={14} />
                              </button>
                              <button className="btn-icon" title="Duplicate" onClick={(e) => handleDuplicate(e, pres.id)}>
                                <Copy size={14} />
                              </button>
                              <button className="btn-icon" title="Delete" onClick={(e) => handleDelete(e, pres.id)} style={{ color: 'var(--danger)' }}>
                                <Trash2 size={14} />
                              </button>
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
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal anim-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <h2>New Presentation</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Title</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="My Presentation"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  autoFocus
                />
              </div>

              {/* Template selector */}
              <div className="form-group">
                <label>Start from</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 4 }}>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, templateId: null }))}
                    style={{
                      padding: '10px 8px',
                      background: !form.templateId ? 'var(--accent)' : 'var(--bg-card)',
                      border: '2px solid ' + (!form.templateId ? 'var(--accent)' : 'var(--border-light)'),
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      color: !form.templateId ? 'white' : 'var(--text-primary)',
                      fontSize: 12,
                      fontWeight: 500,
                      textAlign: 'center',
                    }}
                  >
                    Blank
                  </button>
                  {allTemplates.map((tmpl) => (
                    <button
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
                      style={{
                        padding: '6px 8px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: form.templateId === tmpl.id ? 'var(--accent)' : 'var(--bg-card)',
                        border: '2px solid ' + (form.templateId === tmpl.id ? 'var(--accent)' : 'var(--border-light)'),
                        borderRadius: 'var(--radius-sm)',
                        color: form.templateId === tmpl.id ? 'white' : 'var(--text-primary)',
                        fontSize: 11,
                        fontWeight: 500,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: 28,
                          borderRadius: 3,
                          marginBottom: 4,
                          ...(isGradientOrImage(tmpl.thumbnail)
                            ? { background: getCardBg(tmpl.thumbnail) }
                            : { backgroundColor: getCardBg(tmpl.thumbnail) }),
                        }}
                      />
                      {tmpl.title}
                    </button>
                  ))}
                </div>
              </div>

              {!form.templateId && (
                <>
                  <div className="form-group">
                    <label>Theme</label>
                    <select className="form-select" value={form.theme} onChange={(e) => setForm((f) => ({ ...f, theme: e.target.value }))}>
                      {THEMES.map((t) => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Transition</label>
                    <select className="form-select" value={form.transition} onChange={(e) => setForm((f) => ({ ...f, transition: e.target.value }))}>
                      {TRANSITIONS.map((t) => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
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
        <div className="modal-overlay" onClick={() => setConfirmDialog(null)}>
          <div className="modal anim-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 'var(--radius-md)', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: confirmDialog.variant === 'danger' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
              }}>
                <AlertCircle size={22} style={{
                  color: confirmDialog.variant === 'danger' ? 'var(--danger)' : '#f59e0b',
                }} />
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: 16, marginBottom: 8 }}>{confirmDialog.title}</h2>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {confirmDialog.message}
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setConfirmDialog(null)}>
                Cancel
              </button>
              <button
                className={confirmDialog.variant === 'danger' ? 'btn btn-danger' : 'btn btn-primary'}
                onClick={() => {
                  confirmDialog.onConfirm()
                  setConfirmDialog(null)
                }}
              >
                {confirmDialog.variant === 'danger' ? 'Delete' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

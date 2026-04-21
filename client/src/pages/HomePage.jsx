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

const PRESET_THEMES = [
  { id: 'deck-blank-light', title: 'Blank Light', category: 'minimal', theme: 'white', transition: 'slide', thumbnail: { type: 'color', color: '#ffffff' }, description: 'Clean minimal light theme' },
  { id: 'deck-blank-dark', title: 'Blank Dark', category: 'minimal', theme: 'black', transition: 'fade', thumbnail: { type: 'color', color: '#111111' }, description: 'Clean minimal dark theme' },
  { id: 'deck-palette', title: 'Palette', category: 'creative', theme: 'solarized', transition: 'zoom', thumbnail: { type: 'color', color: '#fdf6e3' }, description: 'Vibrant and creative colors' },
  { id: 'deck-bento', title: 'Bento', category: 'creative', theme: 'white', transition: 'convex', thumbnail: { type: 'gradient', gradient: 'linear-gradient(135deg, #f3f4f6, #e5e7eb)' }, description: 'Grid-based bento box design' },
  { id: 'deck-serif', title: 'Serif', category: 'academic', theme: 'serif', transition: 'slide', thumbnail: { type: 'color', color: '#fcfcfc' }, description: 'Classic typography for reading' },
  { id: 'deck-bold', title: 'Bold', category: 'corporate', theme: 'blood', transition: 'none', thumbnail: { type: 'color', color: '#222222' }, description: 'High contrast for impact' },
  { id: 'deck-minimal', title: 'Minimalist', category: 'minimal', theme: 'simple', transition: 'fade', thumbnail: { type: 'color', color: '#fafafa' }, description: 'Focus entirely on content' },
  { id: 'deck-code', title: 'Code', category: 'engineering', theme: 'night', transition: 'slide', thumbnail: { type: 'color', color: '#1a1b26' }, description: 'Developer focused template' },
  { id: 'deck-desk', title: 'Desk', category: 'corporate', theme: 'league', transition: 'slide', thumbnail: { type: 'color', color: '#2b2b2b' }, description: 'Professional office environment' },
  { id: 'deck-ellipse', title: 'Ellipse', category: 'creative', theme: 'sky', transition: 'concave', thumbnail: { type: 'gradient', gradient: 'radial-gradient(circle, #f6f8fd, #e9eff9)' }, description: 'Soft rounded shapes' },
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
        let presetData = PRESET_THEMES.find((p) => p.id === templateId)
        if (!presetData) return
        
        try {
          const fullTemplate = await api.getMarketplaceTemplate(templateId)
          if (fullTemplate) {
            presetData = fullTemplate
          }
        } catch (err) {
          console.warn('Failed to fetch full template data from backend, using metadata outline', err)
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

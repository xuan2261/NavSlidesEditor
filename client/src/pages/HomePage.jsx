import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { AlertCircle } from 'lucide-react'
import { api } from '../utils/api'
import { filterMarketplaceTemplates } from '../utils/template-filters'
import { showError } from '../utils/app-feedback'
import TemplatePreview from '../components/dashboard/TemplatePreview'
import { Button } from '../components/ui'
import { PRESET_THEMES } from './home/home-page-presets'
import {
  FALLBACK_CREATION_DEFAULTS,
  createEmptyForm,
  getCreationDefaults,
} from './home/home-page-utils'
import { HomeHeader } from './home/home-header'
import { HomeSidebar } from './home/home-sidebar'
import { TrashView } from './home/trash-view'
import { TemplateGalleryView } from './home/template-gallery-view'
import { MyTemplatesView } from './home/my-templates-view'
import { MarketplaceView } from './home/marketplace-view'
import { PresentationsView } from './home/presentations-view'
import { CreatePresentationModal } from './home/create-presentation-modal'
import { ConfirmDialog } from './home/confirm-dialog'
import { useDashboardData } from './home/use-dashboard-data'
import { usePresentationImports } from './home/use-presentation-imports'

export default function HomePage({ onOpen, theme, onToggleTheme }) {
  const {
    presentations,
    templates,
    trashItems,
    loading,
    loadError,
    hasLoadedData,
    creating,
    setCreating,
    confirmDialog,
    setConfirmDialog,
    loadData,
    retryLoadData,
    handleCreateFromTemplate,
    handleDuplicate,
    handleDelete,
    handleRestore,
    handlePermanentDelete,
    handleEmptyTrash,
    handleDeleteTemplate,
    handleCreateTemplate,
  } = useDashboardData({ onOpen })
  const {
    importProgress,
    importWarningSummary,
    handleImportPdf,
    handleImportMarkdown,
    handleImportProject,
    handleImportPptx,
  } = usePresentationImports({ onOpen })

  const [showModal, setShowModal] = useState(false)
  const creationDefaultsRef = useRef(FALLBACK_CREATION_DEFAULTS)
  const creationFormEditedRef = useRef(false)
  const [form, setForm] = useState(() => createEmptyForm())
  const [previewTemplate, setPreviewTemplate] = useState(null)

  // Dashboard state
  const [sidebarView, setSidebarView] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('updatedAt')
  const [viewMode, setViewMode] = useState('grid')
  const [templateCategory, setTemplateCategory] = useState('All')

  useEffect(() => {
    let active = true
    api.getSettings()
      .then((settings) => {
        if (!active) return
        const defaults = getCreationDefaults(settings)
        creationDefaultsRef.current = defaults
        if (!creationFormEditedRef.current) {
          setForm((current) => ({ ...current, ...defaults }))
        }
      })
      .catch(() => {
        // The documented fallback remains black/slide when settings are unavailable.
      })
    return () => {
      active = false
    }
  }, [])

  function updateCreationForm(updater) {
    creationFormEditedRef.current = true
    setForm(updater)
  }

  function resetCreationForm() {
    creationFormEditedRef.current = false
    setForm(createEmptyForm(creationDefaultsRef.current))
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
      resetCreationForm()
      onOpen(pres.id)
    } catch (err) {
      console.error('Failed to create presentation', err)
      showError('Failed to create presentation: ' + err.message)
    } finally {
      setCreating(false)
    }
  }

  function handleOpenModal() {
    resetCreationForm()
    setShowModal(true)
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
  const [marketplaceStatus, setMarketplaceStatus] = useState('idle')
  const [marketplaceError, setMarketplaceError] = useState('')
  const [marketplaceCategory, setMarketplaceCategory] = useState('')
  const [marketplaceSearch, setMarketplaceSearch] = useState('')
  const filteredMarketplaceTemplates = useMemo(() => {
    return filterMarketplaceTemplates(
      marketplaceData.templates,
      marketplaceCategory,
      marketplaceSearch
    )
  }, [marketplaceCategory, marketplaceData.templates, marketplaceSearch])

  const loadMarketplaceData = useCallback(async () => {
    setMarketplaceStatus('loading')
    setMarketplaceError('')
    try {
      const data = await api.getMarketplaceTemplates()
      setMarketplaceData({
        categories: Array.isArray(data?.categories) ? data.categories : [],
        templates: Array.isArray(data?.templates) ? data.templates : [],
      })
      setMarketplaceStatus('success')
    } catch (error) {
      setMarketplaceError(error?.message || 'Could not load marketplace templates.')
      setMarketplaceStatus('error')
    }
  }, [])

  useEffect(() => {
    if (isMarketplaceView && marketplaceStatus === 'idle') loadMarketplaceData()
  }, [isMarketplaceView, loadMarketplaceData, marketplaceStatus])

  return (
    <div className="h-full flex flex-col bg-panel">
      <HomeHeader
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onNewPresentation={handleOpenModal}
      />

      <div className="flex-1 flex flex-col overflow-hidden md:flex-row">
        <HomeSidebar
          sidebarView={sidebarView}
          onSidebarViewChange={setSidebarView}
          presentationsCount={presentations.length}
          templatesCount={templates.length}
          trashCount={trashItems.length}
          importProgress={importProgress}
          importWarningSummary={importWarningSummary}
          onImportPptx={handleImportPptx}
          onImportPdf={handleImportPdf}
          onImportMarkdown={handleImportMarkdown}
          onImportProject={handleImportProject}
        />

        <div className="flex-1 overflow-y-auto px-4 pb-7 pt-7 sm:px-8">
          {loadError && hasLoadedData && !loading && (
            <div
              role="alert"
              className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-text-primary"
            >
              <span>{loadError}</span>
              <Button variant="secondary" onClick={() => loadData(false)}>
                Retry refresh
              </Button>
            </div>
          )}
          {loading ? (
            <div className="text-text-muted text-center p-20">
              Loading...
            </div>
          ) : loadError && !hasLoadedData ? (
            <div
              role="alert"
              className="flex flex-col items-center justify-center gap-4 px-10 py-20 text-center text-text-primary"
            >
              <AlertCircle size={40} className="text-danger" aria-hidden="true" />
              <p className="m-0 max-w-md text-sm text-text-secondary">{loadError}</p>
              <Button variant="primary" onClick={retryLoadData}>
                Retry loading dashboard
              </Button>
            </div>
          ) : isTrashView ? (
            <TrashView
              trashItems={trashItems}
              onRestore={handleRestore}
              onPermanentDelete={handlePermanentDelete}
              onEmptyTrash={handleEmptyTrash}
            />
          ) : isTemplateView ? (
            <TemplateGalleryView
              presets={filteredPresets}
              category={templateCategory}
              onCategoryChange={setTemplateCategory}
              creating={creating}
              onCreateFromPreset={(id) => handleCreateFromTemplate(id, true)}
              onNewPresentation={handleOpenModal}
            />
          ) : isMyTemplateView ? (
            <MyTemplatesView
              templates={templates}
              onOpen={onOpen}
              onCreateTemplate={handleCreateTemplate}
              onUseTemplate={(id) => handleCreateFromTemplate(id)}
              onDeleteTemplate={handleDeleteTemplate}
            />
          ) : isMarketplaceView ? (
            <MarketplaceView
              categories={marketplaceData.categories}
              totalCount={marketplaceData.templates.length}
              status={marketplaceStatus}
              error={marketplaceError}
              search={marketplaceSearch}
              onSearchChange={setMarketplaceSearch}
              category={marketplaceCategory}
              onCategoryChange={setMarketplaceCategory}
              templates={filteredMarketplaceTemplates}
              onPreview={setPreviewTemplate}
              onRetry={loadMarketplaceData}
              onClearFilters={() => {
                setMarketplaceSearch('')
                setMarketplaceCategory('')
              }}
            />
          ) : (
            <PresentationsView
              showWelcome={presentations.length === 0 && !searchQuery}
              searchQuery={searchQuery}
              sidebarView={sidebarView}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              items={filteredPresentations}
              onOpen={onOpen}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
              onNewPresentation={handleOpenModal}
              onBrowseTemplates={() => setSidebarView('templates')}
            />
          )}
        </div>
      </div>

      {showModal && (
        <CreatePresentationModal
          creating={creating}
          form={form}
          onFormChange={updateCreationForm}
          onSubmit={handleCreate}
          onClose={() => setShowModal(false)}
          allTemplates={allTemplates}
        />
      )}

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
              showError('Failed to create presentation from marketplace template: ' + err.message)
            } finally {
              setCreating(false)
            }
          }}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
      )}
    </div>
  )
}

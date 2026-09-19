import { useCallback, useEffect, useState } from 'react'
import { api } from '../../utils/api'
import { showError } from '../../utils/app-feedback'
import { getDesignTokensForRevealTheme } from 'revealjs-shared'
import { PRESET_THEMES } from './home-page-presets'

export function useDashboardData({ onOpen }) {
  const [presentations, setPresentations] = useState([])
  const [templates, setTemplates] = useState([])
  const [trashItems, setTrashItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [hasLoadedData, setHasLoadedData] = useState(false)
  const [creating, setCreating] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState(null) // { title, message, onConfirm, variant }

  const loadData = useCallback(
    async (isInitialLoad = loading) => {
      try {
        const [presData, tmplData, trashData] = await Promise.all([
          api.getPresentations(),
          api.getTemplates(),
          api.getTrash(),
        ])
        setPresentations(Array.isArray(presData) ? presData : [])
        setTemplates(Array.isArray(tmplData) ? tmplData : [])
        setTrashItems(Array.isArray(trashData) ? trashData : [])
        setLoadError(null)
        setHasLoadedData(true)
      } catch (err) {
        console.error('Failed to load data', err)
        setLoadError(
          isInitialLoad
            ? 'Could not load dashboard data. Check your connection and try again.'
            : 'Could not refresh dashboard data. Your existing dashboard data is still shown.'
        )
      } finally {
        setLoading(false)
      }
    },
    [loading]
  )

  useEffect(() => {
    loadData(true)
    // Initial dashboard fetch runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const retryLoadData = useCallback(() => {
    setLoading(true)
    loadData(true)
  }, [loadData])

  async function handleCreateFromTemplate(templateId, isPreset = false) {
    setCreating(true)
    try {
      if (isPreset) {
        let presetData = PRESET_THEMES.find((p) => p.id === templateId)
        if (!presetData) return

        try {
          const fullTemplate = await api.getMarketplaceTemplate(templateId)
          if (fullTemplate) {
            presetData = {
              ...fullTemplate,
              designTokens: fullTemplate.designTokens || presetData.designTokens,
            }
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
      showError('Failed to create presentation from template: ' + err.message)
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
      showError('Failed to duplicate presentation: ' + err.message)
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
          showError('Failed to move presentation to trash: ' + err.message)
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
      showError('Failed to restore presentation: ' + err.message)
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
          showError('Failed to permanently delete presentation: ' + err.message)
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
          showError('Failed to empty trash: ' + err.message)
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
          showError('Failed to delete template: ' + err.message)
        }
      },
    })
  }

  async function handleCreateTemplate() {
    try {
      const theme = 'black'
      const template = await api.createTemplate({
        title: 'New Template',
        theme,
        transition: 'slide',
        designTokens: getDesignTokensForRevealTheme(theme),
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
                textColor: 'auto',
                fontFamily: 'var(--ns-font-heading)',
                content:
                  '<h2 style="text-align: center">Template Title</h2><p style="text-align: center">Edit this template</p>',
              },
            ],
            notes: '',
            background: { type: 'none' },
          },
        ],
      })
      onOpen(template.id, true)
    } catch (err) {
      console.error('Failed to create template', err)
      showError('Failed to create template: ' + err.message)
    }
  }

  return {
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
  }
}

import { useCallback } from 'react'
import { exportPDF, downloadHTML, generateRevealHTML } from '../utils/generateHTML'
import { generateOfflineHTML } from '../utils/offlineExport'
import { exportProject } from '../utils/export-project'
import {
  parseProjectFile,
  rehydrateImportedPresentation,
  validateProjectFile,
} from '../utils/import-project'
import { api } from '../utils/api'

/**
 * Export/import action handlers extracted from EditorPage. Pure relocation —
 * same alert/console error UX as the inline closures.
 *
 * @param {Object} presentation current presentation snapshot
 * @returns {{onExportPDF, onExportPPTX, onExportHTML, onExportOffline,
 *   onExportProject, onOpenProject}}
 */
export function useExportActions(presentation) {
  const onExportPDF = useCallback(() => exportPDF(presentation), [presentation])

  const onExportPPTX = useCallback(async () => {
    try {
      const { exportToPptx } = await import('../utils/exportPptx')
      const warnings = await exportToPptx(presentation)
      if (warnings.length) alert(`PPTX export completed with warnings:\n\n${warnings.join('\n')}`)
    } catch (err) {
      console.error('PPTX export failed:', err)
      alert('PPTX export failed: ' + err.message)
    }
  }, [presentation])

  const onExportHTML = useCallback(async () => {
    try {
      downloadHTML(presentation)
    } catch (err) {
      console.error('HTML export failed:', err)
      alert('HTML export failed: ' + err.message)
    }
  }, [presentation])

  const onExportOffline = useCallback(async () => {
    try {
      const html = generateRevealHTML(presentation)
      const offline = await generateOfflineHTML(html)
      const blob = new Blob([offline], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(presentation.title || 'presentation').replace(/[^a-z0-9]/gi, '_')}_offline.html`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Offline export failed:', err)
      alert('Offline export failed: ' + err.message)
    }
  }, [presentation])

  const onExportProject = useCallback(async () => {
    try {
      await exportProject(presentation)
    } catch (err) {
      console.error('Project export failed:', err)
      alert('Project export failed: ' + err.message)
    }
  }, [presentation])

  const onOpenProject = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.navslides,.json'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return
      try {
        const parsed = await parseProjectFile(file)
        const { valid, errors, warnings } = validateProjectFile(parsed)
        if (!valid) {
          alert('Invalid project file: ' + errors.join(', '))
          return
        }
        if (warnings.length) console.warn('Import warnings:', warnings)
        const rehydrated = await rehydrateImportedPresentation(api, parsed)
        if (rehydrated.warnings.length) {
          console.warn('Import warnings:', rehydrated.warnings)
        }
        let finalPres = rehydrated.presentation
        finalPres.title = (finalPres.title || 'Imported') + ' (Imported)'
        const newPres = await api.createPresentation({
          ...finalPres,
          slides: finalPres.slides,
        })
        window.location.href = `/editor/${newPres.id}`
      } catch (err) {
        console.error('Import failed:', err)
        alert('Import failed: ' + err.message)
      }
    }
    input.click()
  }, [])

  return { onExportPDF, onExportPPTX, onExportHTML, onExportOffline, onExportProject, onOpenProject }
}

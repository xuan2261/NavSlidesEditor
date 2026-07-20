import { useCallback, useRef } from 'react'
import { exportPDF, downloadHTML, generateRevealHTML } from '../utils/generateHTML'
import { generateOfflineHTML } from '../utils/offlineExport'
import { exportProject } from '../utils/export-project'
import {
  parseProjectFile,
  rehydrateImportedPresentation,
  validateProjectFile,
} from '../utils/import-project'
import { api } from '../utils/api'
import { showError, showNotice } from '../utils/app-feedback'

function pptxContentFingerprint(presentation) {
  if (!presentation) return ''
  const content = { ...presentation }
  for (const metadataKey of [
    'id',
    'pptxOriginal',
    'pptxSourceAvailable',
    'aggregateGeneration',
    '_pptxEdited',
    '_pptxEditedAt',
    'createdAt',
    'updatedAt',
  ]) {
    delete content[metadataKey]
  }
  return JSON.stringify(content)
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

/**
 * Export/import action handlers extracted from EditorPage. Pure relocation —
 * same alert/console error UX as the inline closures.
 *
 * @param {Object} presentation current presentation snapshot
 * @returns {{onExportPDF, onExportPPTX, onExportHTML, onExportOffline,
 *   onExportProject, onOpenProject}}
 */
export function useExportActions(presentation) {
  const pptxCleanStateRef = useRef({ presentationId: null, fingerprint: '', locallyEdited: false })
  const cleanState = pptxCleanStateRef.current
  if (cleanState.presentationId !== presentation?.id) {
    cleanState.presentationId = presentation?.id || null
    cleanState.fingerprint = presentation?.pptxOriginal || presentation?.pptxSourceAvailable
      ? pptxContentFingerprint(presentation)
      : ''
    cleanState.locallyEdited = false
  } else if (
    cleanState.fingerprint &&
    cleanState.fingerprint !== pptxContentFingerprint(presentation)
  ) {
    cleanState.locallyEdited = true
  }

  const onExportPDF = useCallback(() => exportPDF(presentation), [presentation])

  const onExportPPTX = useCallback(async () => {
    try {
      const canDownloadOriginal = Boolean(
        presentation?.id &&
          (presentation?.pptxSourceAvailable ||
            (presentation?.pptxOriginal?.id && presentation?.pptxOriginal?.sha256)) &&
          !presentation?._pptxEdited &&
          !cleanState.locallyEdited
      )
      if (canDownloadOriginal) {
        try {
          const original = await api.downloadPptxOriginal(presentation.id)
          const filename = `${(presentation.title || 'presentation').replace(/[^a-z0-9._-]+/gi, '_')}.pptx`
          downloadBlob(original, filename)
          globalThis.__NAVSLIDES_LAST_PPTX_EXPORT_REPORT__ = {
            surface: 'pptx-export',
            mode: 'original-bytes',
            warningCount: 0,
            warnings: [],
          }
          return
        } catch (err) {
          if (err?.status !== 404) throw err
        }
      }
      const { exportToPptx } = await import('../utils/exportPptx')
      const warnings = await exportToPptx(presentation)
      globalThis.__NAVSLIDES_LAST_PPTX_EXPORT_REPORT__ = warnings.exportReport || null
      if (warnings.length) showNotice(`PPTX export completed with warnings:\n\n${warnings.join('\n')}`)
    } catch (err) {
      console.error('PPTX export failed:', err)
      showError('PPTX export failed: ' + err.message)
    }
  }, [presentation, cleanState])

  const onDownloadPptxOriginal = useCallback(async () => {
    try {
      const original = await api.downloadPptxOriginal(presentation.id)
      const filename = `${(presentation.title || 'presentation').replace(/[^a-z0-9._-]+/gi, '_')}.pptx`
      downloadBlob(original, filename)
    } catch (err) {
      console.error('Original PPTX download failed:', err)
      showError('Original PPTX download failed: ' + err.message)
    }
  }, [presentation])

  const onGenerateReconstructedPPTX = useCallback(async () => {
    try {
      const { exportToPptx } = await import('../utils/exportPptx')
      const warnings = await exportToPptx(presentation)
      globalThis.__NAVSLIDES_LAST_PPTX_EXPORT_REPORT__ = warnings.exportReport || null
      if (warnings.length) showNotice(`PPTX export completed with warnings:\n\n${warnings.join('\n')}`)
    } catch (err) {
      console.error('Reconstructed PPTX export failed:', err)
      showError('Reconstructed PPTX export failed: ' + err.message)
    }
  }, [presentation])

  const onExportValidatedEditedRevision = useCallback(async () => {
    try {
      const fidelity = await api.getPptxFidelity(presentation.id)
      const generation = fidelity.aggregateGeneration
      if (!fidelity.exports?.validatedEdited?.available || !Number.isSafeInteger(generation)) {
        throw new Error('Validated edited export is not currently available')
      }
      const key = globalThis.crypto?.randomUUID?.() ||
        `export-${presentation.id}-${generation}`
      const bytes = await api.downloadValidatedEditedPptx(
        presentation.id, generation, key
      )
      const filename = `${(presentation.title || 'presentation')
        .replace(/[^a-z0-9._-]+/gi, '_')}.pptx`
      downloadBlob(bytes, filename)
    } catch (err) {
      console.error('Validated edited PPTX export failed:', err)
      showError('Validated edited PPTX export failed: ' + err.message)
    }
  }, [presentation])

  const onExportHTML = useCallback(async () => {
    try {
      downloadHTML(presentation)
    } catch (err) {
      console.error('HTML export failed:', err)
      showError('HTML export failed: ' + err.message)
    }
  }, [presentation])

  const onExportOffline = useCallback(async () => {
    try {
      const html = generateRevealHTML(presentation)
      const offline = await generateOfflineHTML(html)
      const blob = new Blob([offline], { type: 'text/html' })
      downloadBlob(
        blob,
        `${(presentation.title || 'presentation').replace(/[^a-z0-9]/gi, '_')}_offline.html`
      )
    } catch (err) {
      console.error('Offline export failed:', err)
      showError('Offline export failed: ' + err.message)
    }
  }, [presentation])

  const onExportProject = useCallback(async () => {
    try {
      await exportProject(presentation)
    } catch (err) {
      console.error('Project export failed:', err)
      showError('Project export failed: ' + err.message)
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
          showError('Invalid project file: ' + errors.join(', '))
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
        showError('Import failed: ' + err.message)
      }
    }
    input.click()
  }, [])

  return {
    onExportPDF,
    onExportPPTX,
    onDownloadPptxOriginal,
    onExportValidatedEditedRevision,
    onGenerateReconstructedPPTX,
    onExportHTML,
    onExportOffline,
    onExportProject,
    onOpenProject,
  }
}

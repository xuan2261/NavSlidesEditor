import { useCallback, useRef, useState } from 'react'
import { exportPDF, generateRevealHTML } from '../utils/generateHTML'
import { generateOfflineHTML } from '../utils/offlineExport'
import { exportProject } from '../utils/export-project'
import { useProjectImport } from './use-project-import'
import { api } from '../utils/api'
import { usePresentationStore } from '../stores/presentation-store'
import { showError, showNotice } from '../utils/app-feedback'

function hasAdvancedPackageGeneration(presentation) {
  return (
    presentation?.pptxSourceAvailable === true &&
    Number.isSafeInteger(presentation.aggregateGeneration) &&
    presentation.aggregateGeneration > 1
  )
}

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
 * @returns {{onExportPDF, onExportPPTX, onExportHTML, onExportProject, onOpenProject}}
 */
export function useExportActions(
  presentation,
  { beginExport, endExport, flushPendingSave, onAggregateGeneration } = {}
) {
  const [staticExportTeacherReveal, onStaticExportTeacherRevealChange] = useState(false)
  const pptxCleanStateRef = useRef({ presentationId: null, fingerprint: '', locallyEdited: false })
  const cleanState = pptxCleanStateRef.current
  if (cleanState.presentationId !== presentation?.id) {
    cleanState.presentationId = presentation?.id || null
    cleanState.fingerprint =
      presentation?.pptxOriginal || presentation?.pptxSourceAvailable
        ? pptxContentFingerprint(presentation)
        : ''
    cleanState.locallyEdited = false
  } else if (
    cleanState.fingerprint &&
    cleanState.fingerprint !== pptxContentFingerprint(presentation)
  ) {
    cleanState.locallyEdited = true
  }

  const onExportPDF = useCallback(
    () =>
      exportPDF(presentation, {
        teacherReveal: staticExportTeacherReveal === true,
      }),
    [presentation, staticExportTeacherReveal]
  )

  const onExportPPTX = useCallback(async () => {
    try {
      const expectedOriginalGeneration =
        presentation?.pptxSourceAvailable === true &&
        Number.isSafeInteger(presentation.aggregateGeneration)
          ? presentation.aggregateGeneration
          : undefined
      const canDownloadOriginal = Boolean(
        presentation?.id &&
        (presentation?.pptxSourceAvailable ||
          (presentation?.pptxOriginal?.id && presentation?.pptxOriginal?.sha256)) &&
        !presentation?._pptxEdited &&
        !hasAdvancedPackageGeneration(presentation) &&
        !cleanState.locallyEdited
      )
      if (canDownloadOriginal) {
        try {
          const original =
            expectedOriginalGeneration === undefined
              ? await api.downloadPptxOriginal(presentation.id)
              : await api.downloadPptxOriginal(presentation.id, expectedOriginalGeneration)
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
      const warnings = await exportToPptx(presentation, {
        teacherReveal: staticExportTeacherReveal === true,
      })
      globalThis.__NAVSLIDES_LAST_PPTX_EXPORT_REPORT__ = warnings.exportReport || null
      if (warnings.length)
        showNotice(`PPTX export completed with warnings:\n\n${warnings.join('\n')}`)
    } catch (err) {
      console.error('PPTX export failed:', err)
      showError('PPTX export failed: ' + err.message)
    }
  }, [presentation, cleanState, staticExportTeacherReveal])

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
      const warnings = await exportToPptx(presentation, {
        teacherReveal: staticExportTeacherReveal === true,
      })
      globalThis.__NAVSLIDES_LAST_PPTX_EXPORT_REPORT__ = warnings.exportReport || null
      if (warnings.length)
        showNotice(`PPTX export completed with warnings:\n\n${warnings.join('\n')}`)
    } catch (err) {
      console.error('Reconstructed PPTX export failed:', err)
      showError('Reconstructed PPTX export failed: ' + err.message)
    }
  }, [presentation, staticExportTeacherReveal])

  const onExportValidatedEditedRevision = useCallback(async () => {
    let exportToken = null
    try {
      if (typeof flushPendingSave === 'function' && !(await flushPendingSave())) {
        throw new Error('Unable to save current edits before validated export')
      }
      if (typeof beginExport === 'function') {
        exportToken = beginExport()
        if (exportToken === null) {
          throw new Error('Validated edited PPTX export is already in progress')
        }
      }
      const fidelity = await api.getPptxFidelity(presentation.id)
      const generation = fidelity.aggregateGeneration
      const validatedEdited = fidelity.exports?.validatedEdited
      const canExportOrReconcile =
        validatedEdited?.available === true || validatedEdited?.reconciliationAvailable === true
      if (!canExportOrReconcile || !Number.isSafeInteger(generation)) {
        throw new Error('Validated edited export is not currently available')
      }
      const key = globalThis.crypto?.randomUUID?.() || `export-${presentation.id}-${generation}`
      const bytes = await api.downloadValidatedEditedPptx(presentation.id, generation, key)
      if (Number.isSafeInteger(bytes?.aggregateGeneration)) {
        const store = usePresentationStore.getState()
        if (!store.presentation || store.presentation.id === presentation.id) {
          store.adoptAggregateGeneration(bytes.aggregateGeneration)
        }
        if (typeof onAggregateGeneration === 'function') {
          onAggregateGeneration(bytes.aggregateGeneration, presentation.id)
        }
      }
      const filename = `${(presentation.title || 'presentation').replace(
        /[^a-z0-9._-]+/gi,
        '_'
      )}.pptx`
      downloadBlob(bytes, filename)
    } catch (err) {
      console.error('Validated edited PPTX export failed:', err)
      showError('Validated edited PPTX export failed: ' + err.message)
    } finally {
      if (exportToken !== null && typeof endExport === 'function') endExport(exportToken)
    }
  }, [beginExport, endExport, flushPendingSave, onAggregateGeneration, presentation])

  const onExportHTML = useCallback(async () => {
    try {
      const html = generateRevealHTML(presentation, { portable: true })
      const offline = await generateOfflineHTML(html, {
        generatedDocument: true,
        strictRequiredAssets: true,
        baseUrl: window.location.href,
      })
      downloadBlob(
        new Blob([offline], { type: 'text/html' }),
        `${(presentation.title || 'presentation').replace(/[^a-z0-9]/gi, '_')}.html`
      )
    } catch (err) {
      console.error('HTML export failed:', err)
      showError('HTML export failed: ' + err.message)
    }
  }, [presentation])

  const onExportProject = useCallback(async () => {
    let exportToken = null
    try {
      if (usePresentationStore.getState().saveConflict) {
        throw new Error('Resolve the save conflict before exporting the project')
      }
      if (typeof flushPendingSave === 'function' && !(await flushPendingSave())) {
        throw new Error('Unable to save current edits before project export')
      }
      if (typeof beginExport === 'function') {
        exportToken = beginExport()
        if (exportToken === null) throw new Error('An export is already in progress')
      }
      if (usePresentationStore.getState().saveConflict) {
        throw new Error('Resolve the save conflict before exporting the project')
      }
      let snapshot = presentation
      if (presentation?.pptxSourceAvailable === true) {
        // The prop can predate the completed save, and the store can contain edits
        // queued during this barrier. Only the saved server snapshot is exported.
        snapshot = await api.getPresentation(presentation.id)
        if (snapshot?.id !== presentation.id || snapshot.pptxSourceAvailable !== true) {
          throw new Error('Saved package snapshot is unavailable')
        }
      }
      await exportProject(snapshot)
    } catch (err) {
      console.error('Project export failed:', err)
      showError('Project export failed: ' + err.message)
    } finally {
      if (exportToken !== null && typeof endExport === 'function') endExport(exportToken)
    }
  }, [beginExport, endExport, flushPendingSave, presentation])

  const openImportedProject = useCallback((id) => {
    window.location.href = `/editor/${id}`
  }, [])
  const showImportWarnings = useCallback((summary) => {
    if (summary) showNotice(summary)
  }, [])
  const handleImportProject = useProjectImport({
    onOpen: openImportedProject,
    onWarnings: showImportWarnings,
  })

  const onOpenProject = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.navslides,.json'
    input.onchange = (event) => handleImportProject(event.target.files?.[0])
    input.click()
  }, [handleImportProject])

  return {
    onExportPDF,
    onExportPPTX,
    onDownloadPptxOriginal,
    onExportValidatedEditedRevision,
    onGenerateReconstructedPPTX,
    onExportHTML,
    staticExportTeacherReveal,
    onStaticExportTeacherRevealChange,
    onExportProject,
    onOpenProject,
  }
}

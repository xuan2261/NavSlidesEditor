import { useEffect, useRef, useState } from 'react'
import { api } from '../../utils/api'
import { markdownToSlidesWithWarnings } from '../../utils/markdown-import'
import { parseProjectFile, rehydrateImportedPresentation, validateProjectFile } from '../../utils/import-project'
import { summarizePptxImportWarnings } from '../../utils/pptx-import-summary'
import {
  DEFAULT_PPTX_JOB_MAX_WAIT_MS,
  PPTX_ADMISSION_MAX_RETRIES,
  PPTX_ADMISSION_MAX_WAIT_MS,
  PPTX_ADMISSION_RETRY_DELAY_MS,
  waitForPptxJob,
} from '../../utils/pptx-job-wait'
import { showError, showNotice } from '../../utils/app-feedback'

export function usePresentationImports({ onOpen }) {
  const [importProgress, setImportProgress] = useState(null)
  const [importWarningSummary, setImportWarningSummary] = useState(null)
  const pptxImportRef = useRef(null)

  useEffect(() => () => {
    const activeImport = pptxImportRef.current
    activeImport?.admissionController?.abort()
    activeImport?.connection?.es?.close()
    if (activeImport?.jobId) {
      api.cancelPptxJob(activeImport.jobId, { capability: activeImport.capability }).catch(() => {})
    }
    pptxImportRef.current = null
  }, [])

  async function handleImportPdf(file) {
    if (!file) return
    setImportWarningSummary(null)
    setImportProgress('Loading PDF...')
    try {
      const { pdfToSlides } = await import('../../utils/pdf-import.js')
      const { slides, warnings } = await pdfToSlides(file, (cur, total) => {
        setImportProgress(`Converting page ${cur}/${total}...`)
      })
      if (slides.length === 0) {
        showError('No pages found in PDF')
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
      showError('Failed to import PDF: ' + err.message)
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
        showError('No content found in Markdown')
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
      showError('Failed to import Markdown: ' + err.message)
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
        showError('Invalid project file: ' + errors.join(', '))
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
      showError('Failed to import project: ' + err.message)
    } finally {
      setImportProgress(null)
    }
  }

  async function handleImportPptx(file) {
    if (!file) return
    if (!/\.pptx$/i.test(file.name)) {
      showError('Only .pptx files are supported')
      return
    }
    if (pptxImportRef.current) return

    setImportWarningSummary(null)
    setImportProgress('Uploading PPTX...')
    const activeImport = {
      admissionController: new AbortController(),
      connection: null,
      jobId: null,
      deadlineAt: null,
    }
    pptxImportRef.current = activeImport
    try {
      const admission = await api.importPptxAsync(file, {
        retryOnBusy: true,
        maxBusyRetries: PPTX_ADMISSION_MAX_RETRIES,
        busyRetryDelayMs: PPTX_ADMISSION_RETRY_DELAY_MS,
        signal: activeImport.admissionController.signal,
        deadlineAt: Date.now() + PPTX_ADMISSION_MAX_WAIT_MS,
        onBusyRetry: () => {
          if (pptxImportRef.current === activeImport) {
            setImportProgress('Another PPTX import is running. Waiting to retry...')
          }
        },
      })
      const jobId = admission?.jobId
      const capability = admission?.capability || null
      activeImport.jobId = jobId
      activeImport.capability = capability
      // The import only starts once the server admits it, so the wait budget
      // starts here — not when the user picked the file.
      activeImport.deadlineAt = Date.now() + DEFAULT_PPTX_JOB_MAX_WAIT_MS
      if (pptxImportRef.current !== activeImport) {
        if (jobId) api.cancelPptxJob(jobId, { capability }).catch(() => {})
        return
      }
      const imported = await waitForPptxJob({
        jobId,
        api,
        capability,
        signal: activeImport.admissionController.signal,
        deadlineAt: activeImport.deadlineAt,
        onProgress: (progress) => {
          if (pptxImportRef.current === activeImport) setImportProgress(progress)
        },
        onConnection: (connection) => {
          if (pptxImportRef.current === activeImport) activeImport.connection = connection
        },
      })
      // Ownership abandon (leave/unmount): never open or toast after user left.
      if (pptxImportRef.current !== activeImport) return
      activeImport.jobId = null
      // The server creates the presentation and binds original.pptx atomically.
      const presentationId = imported?.presentationId
      if (!presentationId) {
        throw new Error('PPTX import completed without presentationId')
      }
      const warningSummary = summarizePptxImportWarnings(imported)
      if (warningSummary) {
        setImportWarningSummary(warningSummary)
        showNotice(warningSummary, { title: 'PPTX import completed with warnings' })
      }
      if (pptxImportRef.current !== activeImport) return
      onOpen(presentationId)
    } catch (err) {
      const intentionalAbandon =
        err?.name === 'AbortError' ||
        err?.status === 'cancelled' ||
        err?.code === 'PPTX_JOB_CANCELLED' ||
        pptxImportRef.current !== activeImport
      if (!intentionalAbandon && pptxImportRef.current === activeImport) {
        console.error('PPTX import failed:', err)
        if (err?.code === 'PPTX_JOB_ADMISSION_TIMEOUT') {
          showError(
            'PPTX import admission timed out before acceptance was confirmed. Check existing presentations before importing again.',
            { title: 'Import admission outcome unknown' }
          )
        } else if (err?.code === 'PPTX_JOB_PENDING_VISIBILITY') {
          showError(
            'PPTX import finished on the server but is not listable yet. Wait a moment and refresh the home list before retrying.',
            { title: 'Import pending visibility' }
          )
        } else if (err?.code === 'PPTX_JOB_OUTCOME_UNKNOWN') {
          showError(
            'PPTX import timed out before a final outcome was confirmed. Check existing presentations before importing again.',
            { title: 'Import outcome unknown' }
          )
        } else if (err?.code === 'PPTX_JOB_RECONCILE_REQUIRED') {
          showError(
            'PPTX import needs manual repair. Do not re-upload until the existing job is reconciled.',
            { title: 'Import reconcile required' }
          )
        } else {
          showError('Failed to import PPTX: ' + err.message)
        }
      }
    } finally {
      if (pptxImportRef.current === activeImport) {
        activeImport.admissionController.abort()
        activeImport.connection?.es?.close()
        pptxImportRef.current = null
        setImportProgress(null)
      }
    }
  }

  return {
    importProgress,
    importWarningSummary,
    handleImportPdf,
    handleImportMarkdown,
    handleImportProject,
    handleImportPptx,
  }
}

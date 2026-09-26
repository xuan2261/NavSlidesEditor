import { useEffect, useRef, useState } from 'react'
import { api } from '../../utils/api'
import { markdownToSlidesWithWarnings } from '../../utils/markdown-import'
import { importProjectAtomically } from '../../utils/import-project'
import { summarizePptxImportWarnings } from '../../utils/pptx-import-summary'
import {
  DEFAULT_PPTX_JOB_MAX_WAIT_MS,
  PPTX_ADMISSION_MAX_RETRIES,
  PPTX_ADMISSION_MAX_WAIT_MS,
  PPTX_ADMISSION_RETRY_DELAY_MS,
  waitForPptxJob,
} from '../../utils/pptx-job-wait'
import { showError, showNotice } from '../../utils/app-feedback'

export function usePresentationImports({ onOpen, confirmActiveContent }) {
  const [importProgress, setImportProgress] = useState(null)
  const [importWarningSummary, setImportWarningSummary] = useState(null)
  const pptxImportRef = useRef(null)
  const projectImportRef = useRef(null)

  useEffect(() => () => {
    const activeImport = pptxImportRef.current
    pptxImportRef.current = null
    activeImport?.admissionController?.abort()
    activeImport?.connection?.es?.close()
    if (activeImport?.jobId) {
      api.cancelPptxJob(activeImport.jobId, { capability: activeImport.capability }).catch(() => {})
    }
    const projectImport = projectImportRef.current
    projectImport?.controller.abort()
    if (projectImport?.state === 'pending' && projectImport.sessionId) {
      api.rollbackProjectImport(projectImport.sessionId, projectImport.capability).catch(() => {})
    }
    projectImportRef.current = null
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
    if (!file || projectImportRef.current) return
    setImportWarningSummary(null)
    const activeImport = {
      controller: new AbortController(),
      state: 'preflight',
      sessionId: null,
      capability: null,
    }
    projectImportRef.current = activeImport
    const runImport = (acknowledged = false) => importProjectAtomically(api, file, {
      signal: activeImport.controller.signal,
      trustedAuthorActiveContentAcknowledged: acknowledged,
      onSession: (session) => {
        activeImport.state = 'pending'
        activeImport.sessionId = session.sessionId
        activeImport.capability = session.capability
      },
      onPhase: (phase) => {
        if (projectImportRef.current !== activeImport) return
        if (phase === 'preflight') setImportProgress('Validating project archive...')
        if (phase === 'media') setImportProgress('Placing project media...')
        if (phase === 'publishing') {
          activeImport.state = 'committing'
          setImportProgress('Publishing presentation...')
        }
      },
    })
    try {
      let receipt
      try {
        receipt = await runImport(false)
      } catch (error) {
        if (error?.code !== 'ACTIVE_CONTENT_ACK_REQUIRED') throw error
        const types = Array.isArray(error.activeContent) ? error.activeContent.join(', ') : 'active content'
        const message = `This project contains trusted-author active content (${types}). Import only if you trust its author.`
        const confirmFn = confirmActiveContent || (typeof window !== 'undefined' ? window.__confirmActiveContent : null)
        const accepted = confirmFn ? await confirmFn(message) : false
        if (!accepted) return
        receipt = await runImport(true)
      }
      if (projectImportRef.current === activeImport && receipt?.presentationId) {
        activeImport.state = 'committed'
        if (receipt.warnings?.length) {
          setImportWarningSummary(`Project import warnings:\n- ${receipt.warnings.join('\n- ')}`)
        }
        onOpen(receipt.presentationId)
      }
    } catch (err) {
      const abandoned = err?.name === 'AbortError' || projectImportRef.current !== activeImport
      if (!abandoned && activeImport.state === 'pending' && activeImport.sessionId) {
        await api.rollbackProjectImport(activeImport.sessionId, activeImport.capability).catch(() => {})
        activeImport.state = 'rolled-back'
      }
      if (!abandoned) {
        console.error('Project import failed:', err)
        const message = activeImport.state === 'committing'
          ? 'Project publication outcome is unknown. Check existing presentations before retrying.'
          : `Failed to import project: ${err.message}`
        showError(message)
      }
    } finally {
      if (projectImportRef.current === activeImport) {
        activeImport.controller.abort()
        projectImportRef.current = null
        setImportProgress(null)
      }
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

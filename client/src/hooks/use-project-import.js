import { useCallback, useEffect, useRef } from 'react'
import { api } from '../utils/api'
import { importProjectAtomically } from '../utils/import-project'
import { confirmUser, showError } from '../utils/app-feedback'

/** Shared Home/Editor lifecycle; package authority is admitted only by the server. */
export function useProjectImport({ onOpen, confirmActiveContent, onProgress, onWarnings }) {
  const projectImportRef = useRef(null)
  const mountedRef = useRef(true)
  const attemptRef = useRef(0)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      attemptRef.current += 1
      const active = projectImportRef.current
      projectImportRef.current = null
      active?.controller.abort()
      // Once publication starts its outcome may be committed. Never compensate it blindly.
      if (active?.state === 'pending' && active.sessionId) {
        api.rollbackProjectImport(active.sessionId, active.capability).catch((error) => {
          console.error('Project import rollback failed:', error)
        })
      }
    }
  }, [])

  const handleImportProject = useCallback(async function importFile(file, acknowledged = false) {
    if (!file || !mountedRef.current || projectImportRef.current) return
    const attempt = ++attemptRef.current
    onWarnings?.(null)
    const active = { controller: new AbortController(), state: 'preflight', sessionId: null, capability: null }
    projectImportRef.current = active
    const runImport = (accepted) => importProjectAtomically(api, file, {
      signal: active.controller.signal,
      trustedAuthorActiveContentAcknowledged: accepted,
      onSession: (session) => {
        active.state = 'pending'
        active.sessionId = session.sessionId
        active.capability = session.capability
        if (projectImportRef.current !== active) {
          api.rollbackProjectImport(active.sessionId, active.capability).catch((error) => {
            console.error('Abandoned project import rollback failed:', error)
          })
        }
      },
      onPhase: (phase) => {
        if (projectImportRef.current !== active) return
        if (phase === 'preflight') onProgress?.('Validating project archive...')
        if (phase === 'media') onProgress?.('Placing project media...')
        if (phase === 'publishing') {
          active.state = 'committing'
          onProgress?.('Publishing presentation...')
        }
      },
    })
    try {
      let receipt
      try {
        receipt = await runImport(acknowledged)
      } catch (error) {
        if (error?.code !== 'ACTIVE_CONTENT_ACK_REQUIRED' || acknowledged) throw error
        if (projectImportRef.current !== active) return
        const types = Array.isArray(error.activeContent) ? error.activeContent.join(', ') : 'active content'
        const message = `This project contains trusted-author active content (${types}). Import only if you trust its author.`
        if (confirmActiveContent) {
          if (!(await confirmActiveContent(message)) || projectImportRef.current !== active) return
          receipt = await runImport(true)
        } else {
          // Release this unadmitted attempt in finally. Cancel leaves no session or lock.
          confirmUser(message, () => {
            if (mountedRef.current && attemptRef.current === attempt) void importFile(file, true)
          }, { title: 'Trust project author?', confirmLabel: 'Trust author and import' })
          return
        }
      }
      if (projectImportRef.current !== active) return
      if (receipt?.status !== 'committed' || typeof receipt.presentationId !== 'string' || !receipt.presentationId) {
        throw new Error('Project publication did not return a committed presentation')
      }
      active.state = 'committed'
      if (receipt.warnings?.length) onWarnings?.(`Project import warnings:\n- ${receipt.warnings.join('\n- ')}`)
      onOpen(receipt.presentationId)
    } catch (error) {
      const abandoned = error?.name === 'AbortError' || projectImportRef.current !== active
      let rollbackFailed = false
      if (!abandoned && active.state === 'pending' && active.sessionId) {
        try {
          await api.rollbackProjectImport(active.sessionId, active.capability)
          active.state = 'rolled-back'
        } catch (rollbackError) {
          rollbackFailed = true
          console.error('Project import rollback failed:', rollbackError)
        }
      }
      if (!abandoned) {
        console.error('Project import failed:', error)
        showError(active.state === 'committing'
          ? 'Project publication outcome is unknown. Check existing presentations before retrying.'
          : rollbackFailed
            ? 'Project import rollback could not be confirmed. Check existing presentations before retrying.'
            : `Failed to import project: ${error.message}`)
      }
    } finally {
      if (projectImportRef.current === active) {
        active.controller.abort()
        projectImportRef.current = null
        onProgress?.(null)
      }
    }
  }, [confirmActiveContent, onOpen, onProgress, onWarnings])

  return handleImportProject
}

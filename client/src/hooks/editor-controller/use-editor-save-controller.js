import { useCallback, useEffect, useRef, useState } from 'react'
import { flushPendingSave } from '../use-editor-save-queue'
import { usePresentationStore } from '../../stores/presentation-store'
import { normalizePresentationNotes } from '../../utils/slide-notes'
import {
  clearEditorDraft,
  createEditorDraft,
  writeEditorDraft,
} from '../../utils/editor-draft-store'
import { persistEditorSave } from './editor-save-attempt'

export function useEditorSaveController({ isTemplate }) {
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  const [lastSaveError, setLastSaveError] = useState('')
  const [, setLastSavedAt] = useState(null)
  const timerRef = useRef(null)
  const resetTimerRef = useRef(null)
  const attemptRef = useRef(0)
  const routeEpochRef = useRef(0)
  const inFlightRef = useRef(false)
  const inFlightEntryRef = useRef(null)
  const flushTransportRef = useRef(null)
  const queueRef = useRef(null)
  const failedEntryRef = useRef(null)
  const acceptedGenerationRef = useRef(null)
  const mountedRef = useRef(true)
  const draftSessionIdRef = useRef(
    globalThis.crypto?.randomUUID?.() ||
    `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`
  )

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    resetTimerRef.current = null
  }, [])

  const scheduleStatusReset = useCallback(() => {
    resetTimerRef.current = setTimeout(() => setSaveStatus(''), 2000)
  }, [])

  const persist = useCallback(
    (entry) => persistEditorSave({
      acceptedGenerationRef,
      attemptRef,
      clearResetTimer,
      entry,
      isTemplate,
      mountedRef,
      queueRef,
      scheduleStatusReset,
      setLastSaveError,
      setLastSavedAt,
      setSaveStatus,
      setSaving,
    }),
    [clearResetTimer, isTemplate, scheduleStatusReset]
  )

  const processQueue = useCallback(async () => {
    if (
      inFlightEntryRef.current ||
      flushTransportRef.current ||
      (!failedEntryRef.current && !queueRef.current)
    ) return
    const entry = failedEntryRef.current || queueRef.current
    if (failedEntryRef.current) failedEntryRef.current = null
    else queueRef.current = null
    inFlightEntryRef.current = entry
    inFlightRef.current = true
    let ok = false
    try {
      ok = await persist(entry)
    } finally {
      if (inFlightEntryRef.current === entry) {
        inFlightEntryRef.current = null
        inFlightRef.current = false
      }
    }
    if (inFlightEntryRef.current !== null) return
    if (!ok && entry.routeEpoch === routeEpochRef.current) failedEntryRef.current = entry
    const successor = queueRef.current
    const routeChanged = entry.routeEpoch !== routeEpochRef.current
    if (
      (ok || routeChanged) &&
      successor?.routeEpoch === routeEpochRef.current &&
      !usePresentationStore.getState().saveConflict
    ) {
      void processQueue()
    }
  }, [persist])

  const scheduleSave = useCallback(
    (snapshot, delayMs = 1500, { preserveIdempotencyKey = false } = {}) => {
      if (!snapshot) return
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
      clearResetTimer()
      const attemptId = ++attemptRef.current
      const draftId = `${draftSessionIdRef.current}:${attemptId}`
      const generation = acceptedGenerationRef.current ?? snapshot.aggregateGeneration
      const body =
        !isTemplate && Number.isSafeInteger(generation)
          ? {
              ...snapshot,
              aggregateGeneration: generation,
              idempotencyKey:
                preserveIdempotencyKey && snapshot.idempotencyKey
                  ? snapshot.idempotencyKey
                  : globalThis.crypto?.randomUUID?.() ||
                    `save-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            }
          : snapshot
      const draft = createEditorDraft({ snapshot: body, isTemplate, attemptId, draftId })
      const draftWritePromise = writeEditorDraft(draft)
      // Keep failedEntryRef: processQueue intentionally retries the uncertain
      // write (same idempotency key) before the queued successor. Callers that
      // must drop the failed body use discardPendingSave / clearFailedSave.
      queueRef.current = {
        snapshot: body,
        attemptId,
        draftId,
        draftUpdatedAt: draft.updatedAt,
        draftWritePromise,
        routeEpoch: routeEpochRef.current,
      }
      setSaving(true)
      setSaveStatus('saving')
      setLastSaveError('')
      if (delayMs <= 0) void processQueue()
      else timerRef.current = setTimeout(() => void processQueue(), delayMs)
    },
    [clearResetTimer, isTemplate, processQueue]
  )

  const flush = useCallback(({ allowSynchronous = false } = {}) => {
    if (inFlightEntryRef.current || flushTransportRef.current) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    const entry = queueRef.current || failedEntryRef.current
    if (!entry?.snapshot) return
    const snapshot = normalizePresentationNotes(entry.snapshot)
    const clearCommittedDraft = () => {
      const identity = {
        idempotencyKey: entry.snapshot.idempotencyKey,
        attemptId: entry.attemptId,
      }
      if (entry.draftUpdatedAt) identity.updatedAt = entry.draftUpdatedAt
      if (entry.draftId) identity.draftId = entry.draftId
      return clearEditorDraft(entry.snapshot.id, isTemplate, identity)
    }
    const finishTransport = ({ processSuccessor = true } = {}) => {
      if (flushTransportRef.current !== entry) return
      flushTransportRef.current = null
      if (
        processSuccessor &&
        queueRef.current?.routeEpoch === routeEpochRef.current &&
        !usePresentationStore.getState().saveConflict
      ) {
        void processQueue()
      }
    }
    flushTransportRef.current = entry
    const dispatched = flushPendingSave(snapshot, {
      isTemplate,
      sendKeepalive: (url, body) => {
        void fetch(url, {
          method: 'PUT',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body,
        })
          .then((response) => {
            if (response.ok) return clearCommittedDraft()
            return undefined
          })
          .catch(() => {})
          .finally(finishTransport)
      },
      sendSync: allowSynchronous
        ? (url, body) => {
            try {
              const xhr = new XMLHttpRequest()
              xhr.open('PUT', url, false)
              xhr.setRequestHeader('Content-Type', 'application/json')
              xhr.send(body)
              if (xhr.status >= 200 && xhr.status < 300) {
                void Promise.resolve(clearCommittedDraft()).finally(() => finishTransport({ processSuccessor: false }))
              } else {
                finishTransport({ processSuccessor: false })
              }
            } catch {
              finishTransport({ processSuccessor: false })
              // Browser teardown offers no further recovery path.
            }
          }
        : undefined,
    })
    if (!dispatched) {
      flushTransportRef.current = null
      return
    }
    if (queueRef.current === entry) queueRef.current = null
    if (failedEntryRef.current === entry) failedEntryRef.current = null
  }, [isTemplate, processQueue])

  const resetForRoute = useCallback(() => {
    flush({ allowSynchronous: false })
    queueRef.current = null
    failedEntryRef.current = null
    attemptRef.current += 1
    routeEpochRef.current += 1
    acceptedGenerationRef.current = null
    clearResetTimer()
    setSaving(false)
    setSaveStatus('')
    setLastSaveError('')
  }, [clearResetTimer, flush])

  const adoptGeneration = useCallback((generation) => {
    acceptedGenerationRef.current = Number.isSafeInteger(generation) ? generation : null
  }, [])

  const retrySave = useCallback(() => {
    if (
      usePresentationStore.getState().saveConflict ||
      (!failedEntryRef.current?.snapshot && !queueRef.current?.snapshot)
    ) return
    clearResetTimer()
    setSaving(true)
    setSaveStatus('saving')
    setLastSaveError('')
    void processQueue()
  }, [clearResetTimer, processQueue])

  const clearFailedSave = useCallback(() => {
    failedEntryRef.current = null
  }, [])

  const discardPendingSave = useCallback(() => {
    const pendingEntries = [queueRef.current, failedEntryRef.current].filter(Boolean)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    queueRef.current = null
    failedEntryRef.current = null
    const cleanup = pendingEntries.map((entry) => {
      const identity = {
        idempotencyKey: entry.snapshot.idempotencyKey,
        attemptId: entry.attemptId,
      }
      if (entry.draftUpdatedAt) identity.updatedAt = entry.draftUpdatedAt
      if (entry.draftId) identity.draftId = entry.draftId
      return clearEditorDraft(entry.snapshot.id, isTemplate, identity)
    })
    attemptRef.current += 1
    clearResetTimer()
    setSaving(false)
    setSaveStatus('')
    setLastSaveError('')
    return Promise.all(cleanup)
  }, [clearResetTimer, isTemplate])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  return {
    adoptGeneration,
    clearFailedSave,
    clearResetTimer,
    discardPendingSave,
    flush,
    lastSaveError,
    resetForRoute,
    retrySave,
    saveStatus,
    saving,
    scheduleSave,
    setLastSaveError,
    setSaveStatus,
  }
}

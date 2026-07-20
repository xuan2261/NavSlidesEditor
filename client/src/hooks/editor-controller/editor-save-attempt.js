import { usePresentationStore } from '../../stores/presentation-store'
import { normalizePresentationNotes } from '../../utils/slide-notes'
import { api } from '../../utils/api'
import { showNotice } from '../../utils/app-feedback'
import { clearEditorDraft } from '../../utils/editor-draft-store'

export async function persistEditorSave({
  acceptedGenerationRef,
  attemptRef,
  clearResetTimer,
  entry,
  isTemplate,
  mountedRef,
  queueRef,
  setLastSaveError,
  setLastSavedAt,
  setSaveStatus,
  setSaving,
  scheduleStatusReset,
}) {
  const {
    snapshot,
    attemptId,
    draftId,
    draftUpdatedAt,
    draftWritePromise,
    routeEpoch,
  } = entry
  try {
    const draftStored = await (draftWritePromise || true)
    if (!draftStored) {
      console.warn('Editor recovery draft storage is unavailable')
      if (typeof window !== 'undefined') {
        showNotice('Local recovery copy unavailable; the remote save will still be attempted.')
      }
    }
    const save = isTemplate ? api.updateTemplate : api.updatePresentation
    const saved = await save(snapshot.id, normalizePresentationNotes(snapshot))
    const identity = {
      idempotencyKey: snapshot.idempotencyKey,
      attemptId,
    }
    if (draftUpdatedAt) identity.updatedAt = draftUpdatedAt
    if (draftId) identity.draftId = draftId
    await clearEditorDraft(snapshot.id, isTemplate, identity)
    const current = attemptId === attemptRef.current
    const successor =
      queueRef.current?.routeEpoch === routeEpoch &&
      queueRef.current?.snapshot?.id === snapshot.id
    if (!isTemplate && Number.isSafeInteger(saved?.aggregateGeneration) && (current || successor)) {
      acceptedGenerationRef.current = saved.aggregateGeneration
      if (current) usePresentationStore.getState().adoptAggregateGeneration(saved.aggregateGeneration)
      if (successor) {
        queueRef.current.snapshot = {
          ...queueRef.current.snapshot,
          aggregateGeneration: saved.aggregateGeneration,
        }
      }
    }
    if (current && mountedRef.current) {
      clearResetTimer()
      setSaveStatus('saved')
      setLastSaveError('')
      setLastSavedAt(new Date())
      scheduleStatusReset()
    }
    return true
  } catch (error) {
    const successor =
      queueRef.current?.routeEpoch === routeEpoch &&
      queueRef.current?.snapshot?.id === snapshot.id
    if ((attemptId !== attemptRef.current && !successor) || !mountedRef.current) return false
    if (!isTemplate && error?.status === 409 && error?.reason === 'STALE_GENERATION') {
      usePresentationStore.getState().setSaveConflict(snapshot, error.currentGeneration)
    }
    clearResetTimer()
    const message = error?.message?.trim?.() || 'Save failed'
    console.error('Auto-save failed', error)
    setSaveStatus('error')
    setLastSaveError(message)
    return false
  } finally {
    const successor =
      queueRef.current?.routeEpoch === routeEpoch &&
      queueRef.current?.snapshot?.id === snapshot.id
    if ((attemptId === attemptRef.current || successor) && mountedRef.current) setSaving(false)
  }
}

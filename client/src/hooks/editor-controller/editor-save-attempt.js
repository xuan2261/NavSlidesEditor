import { usePresentationStore } from '../../stores/presentation-store'
import { normalizePresentationNotes } from '../../utils/slide-notes'
import { normalizePresentationGames } from 'revealjs-shared'
import { api } from '../../utils/api'
import { showNotice } from '../../utils/app-feedback'
import {
  clearEditorDraft,
  createEditorDraft,
  writeEditorDraft,
} from '../../utils/editor-draft-store'

export function rebaseEditorSaveEntry(entry, generation, isTemplate) {
  if (
    isTemplate ||
    entry.preserveIdempotencyKey ||
    !Number.isSafeInteger(generation) ||
    generation < 1
  )
    return
  const previous = entry.snapshot.aggregateGeneration
  const next = Number.isSafeInteger(previous) ? Math.max(previous, generation) : generation
  if (next === previous) return
  const snapshot = { ...entry.snapshot, aggregateGeneration: next }
  entry.snapshot = snapshot
  const draft = createEditorDraft({
    snapshot,
    isTemplate,
    attemptId: entry.attemptId,
    draftId: entry.draftId,
  })
  entry.draftUpdatedAt = draft.updatedAt
  entry.draftWritePromise = writeEditorDraft(draft)
}

export function adoptEditorSaveGeneration({
  saved,
  entry,
  isTemplate,
  acceptedGenerationRef,
  attemptRef,
  queueRef,
}) {
  const current = entry.attemptId === attemptRef.current
  const successor =
    queueRef.current?.routeEpoch === entry.routeEpoch &&
    queueRef.current?.snapshot?.id === entry.snapshot.id
  if (
    isTemplate ||
    !Number.isSafeInteger(saved?.aggregateGeneration) ||
    saved.aggregateGeneration < 1 ||
    (!current && !successor)
  )
    return
  const accepted = acceptedGenerationRef.current
  const generation =
    accepted === null ? saved.aggregateGeneration : Math.max(accepted, saved.aggregateGeneration)
  acceptedGenerationRef.current = generation
  if (current) usePresentationStore.getState().adoptAggregateGeneration(generation)
  if (successor) rebaseEditorSaveEntry(queueRef.current, generation, isTemplate)
}

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
  const { snapshot, attemptId, draftId, draftUpdatedAt, draftWritePromise, routeEpoch } = entry
  entry.localValidationRejected = false
  let persisted = false
  try {
    const draftStored = await (draftWritePromise || true)
    if (!draftStored) {
      console.warn('Editor recovery draft storage is unavailable')
      if (typeof window !== 'undefined') {
        showNotice('Local recovery copy unavailable; the remote save will still be attempted.')
      }
    }
    const save = isTemplate ? api.updateTemplate : api.updatePresentation
    let normalized
    try {
      normalized = normalizePresentationGames(normalizePresentationNotes(snapshot))
    } catch (error) {
      // No HTTP request occurred, so a corrected successor can supersede this body.
      entry.localValidationRejected = true
      throw error
    }
    const saved = await save(snapshot.id, normalized)
    const identity = {
      idempotencyKey: snapshot.idempotencyKey,
      attemptId,
    }
    if (draftUpdatedAt) identity.updatedAt = draftUpdatedAt
    if (draftId) identity.draftId = draftId
    await clearEditorDraft(snapshot.id, isTemplate, identity)
    const current = attemptId === attemptRef.current
    adoptEditorSaveGeneration({
      saved,
      entry,
      isTemplate,
      acceptedGenerationRef,
      attemptRef,
      queueRef,
    })
    if (current && mountedRef.current) {
      clearResetTimer()
      setSaveStatus('saved')
      setLastSaveError('')
      setLastSavedAt(new Date())
      scheduleStatusReset()
    }
    persisted = true
    return true
  } catch (error) {
    const successor =
      queueRef.current?.routeEpoch === routeEpoch && queueRef.current?.snapshot?.id === snapshot.id
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
    if ((attemptId === attemptRef.current || successor) && mountedRef.current &&
        (!persisted || !successor)) setSaving(false)
  }
}

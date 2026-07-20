import { useCallback, useState } from 'react'
import { migratePresentation } from '../../utils/editor-presentation-migration'
import { clearEditorDraft } from '../../utils/editor-draft-store'

export function useEditorRecoveryController({
  adoptGeneration,
  isTemplate,
  presentationId,
  resetEditorInteraction,
  scheduleSave,
  seedHistory,
  skipAutosaveRef,
  setGridSize,
  setPresentation,
}) {
  const [saveRecovery, setSaveRecovery] = useState(null)

  const dismissSaveRecovery = useCallback(async () => {
    const draft = saveRecovery
    if (!draft?.id) return
    const identity = {
      idempotencyKey: draft.idempotencyKey,
      attemptId: draft.attemptId,
    }
    if (draft.updatedAt) identity.updatedAt = draft.updatedAt
    if (draft.draftId) identity.draftId = draft.draftId
    await clearEditorDraft(draft.id, isTemplate, identity)
    setSaveRecovery((current) => (current === draft ? null : current))
  }, [isTemplate, saveRecovery])

  const deferSaveRecovery = useCallback(() => {
    setSaveRecovery(null)
  }, [])

  const recoverLocalDraft = useCallback(() => {
    const draft = saveRecovery
    if (!draft?.snapshot || draft.id !== presentationId) return
    const recovered = migratePresentation(draft.snapshot)
    if (recovered.id !== presentationId) return
    resetEditorInteraction()
    adoptGeneration(recovered.aggregateGeneration)
    seedHistory(recovered)
    skipAutosaveRef.current = recovered
    setSaveRecovery(null)
    setPresentation(recovered)
    if (recovered.gridSize) setGridSize(recovered.gridSize)
    scheduleSave(recovered, 0, { preserveIdempotencyKey: true })
  }, [
    adoptGeneration,
    presentationId,
    resetEditorInteraction,
    saveRecovery,
    scheduleSave,
    skipAutosaveRef,
    seedHistory,
    setGridSize,
    setPresentation,
  ])

  return {
    deferSaveRecovery,
    dismissSaveRecovery,
    recoverLocalDraft,
    saveRecovery,
    setSaveRecovery,
  }
}

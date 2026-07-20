import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { usePresentationStore } from '../../stores/presentation-store'
import { migratePresentation } from '../../utils/editor-presentation-migration'
import { api } from '../../utils/api'
import { readEditorDraft } from '../../utils/editor-draft-store'
import { useEditorRecoveryController } from './use-editor-recovery-controller'
import { useEditorSaveController } from './use-editor-save-controller'

export function useEditorPersistenceController({
  presentation,
  setPresentation,
  presentationId,
  isTemplate,
  setGridSize,
  seedHistory,
  resetEditorInteraction,
}) {
  const [loading, setLoading] = useState(true)
  const [, setLoadedRouteKey] = useState(null)
  const firstLoadRef = useRef(true)
  // Suppress only the object installed by the loader, not an edit during a route transition.
  const skipAutosaveRef = useRef(null)
  const loadEpochRef = useRef(0)
  const conflictResolutionRef = useRef(null)
  const routeKey = `${isTemplate ? 'template' : 'presentation'}:${presentationId || ''}`
  const routeKeyRef = useRef(routeKey)
  const loadedRouteKeyRef = useRef(null)
  const loadErrorRouteKeyRef = useRef(null)
  if (routeKeyRef.current !== routeKey) {
    routeKeyRef.current = routeKey
    loadEpochRef.current += 1
    loadedRouteKeyRef.current = null
    loadErrorRouteKeyRef.current = null
  }
  const routeLoading =
    loadedRouteKeyRef.current !== routeKey && loadErrorRouteKeyRef.current !== routeKey
  const presentationRef = useRef(presentation)
  useLayoutEffect(() => {
    presentationRef.current = presentation
  }, [presentation])
  const saveConflict = usePresentationStore((state) => state.saveConflict)
  const clearSaveConflict = usePresentationStore((state) => state.clearSaveConflict)
  const clearConflict = useCallback(() => {
    conflictResolutionRef.current = null
    clearSaveConflict()
  }, [clearSaveConflict])
  const {
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
  } = useEditorSaveController({ isTemplate })
  const {
    deferSaveRecovery,
    dismissSaveRecovery,
    recoverLocalDraft,
    saveRecovery,
    setSaveRecovery,
  } = useEditorRecoveryController({
    adoptGeneration,
    isTemplate,
    presentationId,
    resetEditorInteraction,
    scheduleSave,
    seedHistory,
    skipAutosaveRef,
    setGridSize,
    setPresentation,
  })

  useEffect(() => {
    if (!presentationId) return
    const epoch = ++loadEpochRef.current
    resetEditorInteraction()
    // Hide stale or failed-route state before every replacement request.
    setLoading(true)
    // Invalidate the prior successful route before a new async load begins.
    loadedRouteKeyRef.current = null
    loadErrorRouteKeyRef.current = null
    setLoadedRouteKey(null)
    skipAutosaveRef.current = null
    resetForRoute()
    clearSaveConflict()
    setSaveRecovery(null)
    const load = isTemplate ? api.getTemplate : api.getPresentation
    load(presentationId)
      .then((data) => {
        if (epoch !== loadEpochRef.current || routeKeyRef.current !== routeKey) return null
        const migrated = migratePresentation(data)
        adoptGeneration(migrated.aggregateGeneration)
        loadedRouteKeyRef.current = routeKey
        loadErrorRouteKeyRef.current = null
        setLoadedRouteKey(routeKey)
        skipAutosaveRef.current = migrated
        seedHistory(migrated)
        setPresentation(migrated)
        if (migrated.gridSize) setGridSize(migrated.gridSize)
        firstLoadRef.current = true
        return readEditorDraft(presentationId, isTemplate)
          .catch(() => null)
          .then((draft) => {
            if (epoch !== loadEpochRef.current || routeKeyRef.current !== routeKey) return
            setSaveRecovery(draft)
            setLoading(false)
          })
      })
      .catch((error) => {
        if (epoch !== loadEpochRef.current || routeKeyRef.current !== routeKey) return
        console.error('Failed to load presentation', error)
        loadedRouteKeyRef.current = null
        loadErrorRouteKeyRef.current = routeKey
        setLoadedRouteKey(null)
        setSaveRecovery(null)
        setPresentation(null)
        skipAutosaveRef.current = null
        setLoading(false)
      })
  }, [
    clearSaveConflict,
    isTemplate,
    presentationId,
    routeKey,
    adoptGeneration,
    resetForRoute,
    resetEditorInteraction,
    seedHistory,
    setGridSize,
    setPresentation,
    setSaveRecovery,
  ])

  useEffect(() => {
    if (!presentation || loading || routeLoading) return
    if (skipAutosaveRef.current === presentation) {
      skipAutosaveRef.current = null
      return
    }
    scheduleSave(presentation, 1500)
  }, [loading, presentation, routeLoading, scheduleSave])

  useEffect(() => {
    const beforeUnload = () => flush({ allowSynchronous: true })
    window.addEventListener('beforeunload', beforeUnload)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      flush({ allowSynchronous: false })
      clearResetTimer()
      clearSaveConflict()
    }
  }, [clearResetTimer, clearSaveConflict, flush])

  const handleManualSave = useCallback(() => {
    if (!presentation || loading || routeLoading) return
    scheduleSave(presentation, 0)
  }, [loading, presentation, routeLoading, scheduleSave])

  const useRemoteSaveConflict = useCallback(async () => {
    const conflict = saveConflict
    if (!conflict?.local?.id) return
    const conflictEpoch = loadEpochRef.current
    if (conflictResolutionRef.current === conflict) return
    conflictResolutionRef.current = conflict
    try {
      const remote = migratePresentation(await api.getPresentation(conflict.local.id))
      if (
        conflictEpoch !== loadEpochRef.current ||
        routeKeyRef.current !== routeKey ||
        usePresentationStore.getState().saveConflict !== conflict
      ) return
      adoptGeneration(remote.aggregateGeneration)
      await discardPendingSave()
      if (
        conflictEpoch !== loadEpochRef.current ||
        routeKeyRef.current !== routeKey ||
        usePresentationStore.getState().saveConflict !== conflict
      ) return
      skipAutosaveRef.current = remote
      resetEditorInteraction()
      seedHistory(remote)
      setPresentation(remote)
      if (remote.gridSize) setGridSize(remote.gridSize)
      clearConflict()
      setSaveStatus('')
      setLastSaveError('')
    } catch {
      if (
        conflictEpoch !== loadEpochRef.current ||
        routeKeyRef.current !== routeKey ||
        usePresentationStore.getState().saveConflict !== conflict
      ) return
      setLastSaveError('Unable to load the latest remote presentation')
    } finally {
      if (conflictResolutionRef.current === conflict) {
        conflictResolutionRef.current = null
      }
    }
  }, [
    discardPendingSave,
    clearConflict,
    adoptGeneration,
    setLastSaveError,
    setSaveStatus,
    saveConflict,
    routeKey,
    resetEditorInteraction,
    seedHistory,
    setGridSize,
    setPresentation,
  ])

  const keepLocalSaveConflict = useCallback(async () => {
    const conflict = saveConflict
    if (!conflict?.local?.id) return
    const conflictEpoch = loadEpochRef.current
    if (conflictResolutionRef.current === conflict) return
    conflictResolutionRef.current = conflict
    try {
      const remote = await api.getPresentation(conflict.local.id)
      if (
        conflictEpoch !== loadEpochRef.current ||
        routeKeyRef.current !== routeKey ||
        usePresentationStore.getState().saveConflict !== conflict
      ) return
      const generation = Number.isSafeInteger(remote?.aggregateGeneration)
        ? remote.aggregateGeneration
        : null
      adoptGeneration(generation)
      clearFailedSave()
      clearConflict()
      const currentPresentation = presentationRef.current
      const local = currentPresentation?.id === conflict.local.id
        ? currentPresentation
        : conflict.local
      scheduleSave(
        {
          ...local,
          aggregateGeneration: generation,
        },
        0
      )
    } catch {
      if (
        conflictEpoch !== loadEpochRef.current ||
        routeKeyRef.current !== routeKey ||
        usePresentationStore.getState().saveConflict !== conflict
      ) return
      setLastSaveError('Unable to confirm the latest remote version')
    } finally {
      if (conflictResolutionRef.current === conflict) {
        conflictResolutionRef.current = null
      }
    }
  }, [
    clearFailedSave,
    clearConflict,
    adoptGeneration,
    scheduleSave,
    setLastSaveError,
    routeKey,
    saveConflict,
  ])

  return {
    clearSaveConflict: clearConflict,
    deferSaveRecovery,
    dismissSaveRecovery,
    firstLoadRef,
    handleManualSave,
    keepLocalSaveConflict,
    recoverLocalDraft,
    lastSaveError,
    loading: loading || routeLoading,
    retryPendingSave: retrySave,
    saveConflict,
    saveRecovery,
    saveStatus,
    saving,
    useRemoteSaveConflict,
  }
}

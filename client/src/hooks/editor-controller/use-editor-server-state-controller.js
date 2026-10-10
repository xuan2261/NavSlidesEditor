import { useCallback, useLayoutEffect, useRef } from 'react'
import { usePresentationStore } from '../../stores/presentation-store'
import { migratePresentation } from '../../utils/editor-presentation-migration'
import { api } from '../../utils/api'

export function useEditorServerStateController({
  presentationId, routeKey, routeKeyRef, loadEpochRef, loadedRouteKeyRef,
  presentationRef, saveConflict, clearSaveConflict, adoptGenerationInternal,
  beginRestore, endRestore, clearFailedSave, discardPendingSave, scheduleSave, setLastSaveError,
  setSaveStatus, skipAutosaveRef, resetEditorInteraction, seedHistory,
  setPresentation, setGridSize, setSaveRecovery,
}) {
  const conflictResolutionRef = useRef(null)
  const renderEpoch = loadEpochRef.current
  useLayoutEffect(() => () => {
    loadEpochRef.current += 1
    loadedRouteKeyRef.current = null
  }, [loadEpochRef, loadedRouteKeyRef])
  const clearConflict = useCallback(() => {
    conflictResolutionRef.current = null
    clearSaveConflict()
  }, [clearSaveConflict])

  const adoptGeneration = useCallback((generation, sourcePresentationId = presentationId,
    sourceRouteKey = routeKey) => {
    if (sourcePresentationId !== presentationId || sourceRouteKey !== routeKeyRef.current) return
    adoptGenerationInternal(generation)
  }, [adoptGenerationInternal, presentationId, routeKey, routeKeyRef])

  const installServerPresentation = useCallback((remote) => {
    adoptGeneration(remote.aggregateGeneration)
    skipAutosaveRef.current = remote
    resetEditorInteraction()
    seedHistory(remote)
    setPresentation(remote)
    if (remote.gridSize) setGridSize(remote.gridSize)
    clearConflict()
    setSaveStatus('')
    setLastSaveError('')
  }, [adoptGeneration, clearConflict, resetEditorInteraction, seedHistory,
    setGridSize, setLastSaveError, setPresentation, setSaveStatus, skipAutosaveRef])

  const restorePresentation = useCallback(async (snapshotId) => {
    const currentRoute = () => renderEpoch === loadEpochRef.current &&
      routeKeyRef.current === routeKey && loadedRouteKeyRef.current === routeKey
    if (!currentRoute()) return false
    if (typeof snapshotId !== 'string' || !snapshotId) throw new Error('A snapshot identifier is required.')
    const token = beginRestore()
    try {
      // Epoch changes fence callbacks, but only actual transport settlement prevents a late PUT overwrite.
      await token.settled
      if (!currentRoute()) return false
      const data = await api.restoreSnapshot(presentationId, snapshotId)
      if (!currentRoute() || data?.id !== presentationId) return false
      const restored = migratePresentation(data)
      token.installing = true
      await discardPendingSave()
      if (!currentRoute()) return false
      installServerPresentation(restored)
      setSaveRecovery(null)
      return true
    } catch (error) {
      if (!currentRoute()) return false
      throw error
    } finally {
      endRestore(token)
    }
  }, [beginRestore, discardPendingSave, endRestore, installServerPresentation, loadedRouteKeyRef, loadEpochRef,
    presentationId, renderEpoch, routeKey, routeKeyRef, setSaveRecovery])

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
      await discardPendingSave()
      if (
        conflictEpoch !== loadEpochRef.current ||
        routeKeyRef.current !== routeKey ||
        usePresentationStore.getState().saveConflict !== conflict
      ) return
      installServerPresentation(remote)
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
  }, [discardPendingSave, installServerPresentation, loadEpochRef, routeKey,
    routeKeyRef, saveConflict, setLastSaveError])

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
      scheduleSave({ ...local, aggregateGeneration: generation }, 0)
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
  }, [adoptGeneration, clearConflict, clearFailedSave, loadEpochRef, presentationRef,
    routeKey, routeKeyRef, saveConflict, scheduleSave, setLastSaveError])

  return {
    adoptGeneration,
    clearConflict,
    keepLocalSaveConflict,
    restorePresentation,
    useRemoteSaveConflict,
  }
}

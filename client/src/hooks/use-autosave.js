import { useEffect, useRef, useState } from 'react'
import { usePresentationStore } from '../stores/presentation-store'
import * as api from '../utils/api'

export function useAutosave(isTemplate = false) {
  const presentation = usePresentationStore((s) => s.presentation)
  const loading = usePresentationStore((s) => s.loading)
  const [saveStatus, setSaveStatus] = useState('')
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const saveTimerRef = useRef(null)
  const isFirstLoad = useRef(true)

  useEffect(() => {
    if (loading || !presentation || isFirstLoad.current) {
      if (presentation && !loading && isFirstLoad.current) {
        isFirstLoad.current = false
      }
      return
    }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving')
      try {
        const saveFn = isTemplate ? api.updateTemplate : api.updatePresentation
        await saveFn(presentation.id, presentation)
        setSaveStatus('saved')
        setLastSavedAt(new Date())
        setTimeout(() => setSaveStatus(''), 2000)
      } catch (err) {
        console.error('Auto-save failed', err)
        setSaveStatus('')
      }
    }, 1500)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [presentation, isTemplate, loading])

  return { saveStatus, lastSavedAt }
}

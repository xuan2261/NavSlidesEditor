import { useEffect, useRef, useState } from 'react'
import {
  DEFAULT_SETTINGS, editableSettings, acceptedDraft, keyIntent, settingsDirty,
  conflictFields, rebasedDraft,
} from './settings-draft'

export default function useSettingsDraft() {
  const [settings, renderDraft] = useState(DEFAULT_SETTINGS)
  const draft = useRef(DEFAULT_SETTINGS)
  const [baseline, setBaseline] = useState(null)
  const [revision, setRevision] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [saveSucceeded, setSaveSucceeded] = useState(false)
  const [latestLoaded, setLatestLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [conflict, setConflict] = useState(null)
  const [choices, setChoices] = useState({})
  const mounted = useRef(false)
  const busy = useRef(false)
  const requests = useRef(new Set())
  const setSettings = (update) => {
    const next = typeof update === 'function' ? update(draft.current) : update
    draft.current = next
    renderDraft(next)
  }
  const request = async (options) => {
    const controller = new AbortController()
    requests.current.add(controller)
    try {
      return await fetch('/api/settings', { ...options, signal: controller.signal })
    } finally { requests.current.delete(controller) }
  }
  useEffect(() => {
    let active = true
    mounted.current = true
    ;(async () => {
      try {
        const response = await request()
        if (!active) return
        if (!response.ok) throw new Error('Failed to load settings')
        const data = await response.json()
        if (!active) return
        const accepted = editableSettings(data)
        setSettings(accepted)
        setBaseline(accepted)
        setRevision(data.settingsRevision ?? 0)
      } catch (error) {
        if (active) setLoadError(error.message || 'Failed to load settings')
      } finally { if (active) setLoading(false) }
    })()
    return () => {
      active = false
      mounted.current = false
      for (const controller of requests.current) controller.abort()
    }
  }, [])

  const handleSave = async () => {
    if (busy.current || !baseline || conflict) return
    busy.current = true
    setSaving(true)
    setSaveMsg('')
    setSaveSucceeded(false)
    setLatestLoaded(false)
    const submitted = draft.current
    const body = { ...submitted, ai: { ...submitted.ai } }
    if (keyIntent(submitted, baseline) === 'unchanged') delete body.ai.apiKey
    try {
      const response = await request({ method: 'PUT', headers: {
        'Content-Type': 'application/json', 'If-Match': `"${revision}"`,
      }, body: JSON.stringify(body) })
      if (!mounted.current) return
      if (response.status === 412) {
        setConflict({ baseline, latest: null, revision: null })
        setSaveMsg('Error: Settings changed on the server. Review latest before saving.')
        return
      }
      if (!response.ok) throw new Error('Save failed')
      const data = await response.json()
      if (!mounted.current) return
      const accepted = editableSettings(data)
      const current = acceptedDraft(draft.current, submitted, accepted)
      setBaseline(accepted)
      setRevision(data.settingsRevision)
      setSettings(current)
      setSaveSucceeded(true)
    } catch (error) {
      if (mounted.current) setSaveMsg('Error: ' + error.message)
    } finally {
      busy.current = false
      if (mounted.current) setSaving(false)
    }
  }
  const reviewLatest = async () => {
    if (busy.current) return
    busy.current = true
    try {
      const response = await request()
      if (!response.ok) throw new Error('Failed to load latest settings')
      const data = await response.json()
      if (!mounted.current) return
      setConflict(previous => ({ ...previous, latest: editableSettings(data), revision: data.settingsRevision }))
      setChoices({})
    } catch (error) { if (mounted.current) setSaveMsg('Error: ' + error.message) }
    finally { busy.current = false }
  }
  const fields = conflict?.latest ? conflictFields(settings, conflict.baseline, conflict.latest) : []
  const resolveConflict = (reload = false) => {
    if (!conflict?.latest || (!reload && fields.some(field => !choices[field]))) return
    setSettings(reload ? conflict.latest : rebasedDraft(draft.current, conflict.baseline, conflict.latest, choices))
    setBaseline(conflict.latest)
    setRevision(conflict.revision)
    setConflict(null)
    setSaveSucceeded(false)
    setLatestLoaded(reload)
    setSaveMsg(reload ? '' : 'Draft rebased; save to apply your changes.')
  }
  const dirty = baseline ? settingsDirty(settings, baseline) : false
  const status = saveMsg || (saveSucceeded
    ? dirty ? 'Saved submitted snapshot; unsaved changes remain.' : 'Settings saved!'
    : latestLoaded ? dirty ? 'Unsaved changes' : 'Latest settings loaded.' : '')
  return { settings, setSettings, baseline, loading, saving, saveMsg: status, loadError, handleSave,
    conflict, choices, setChoices, reviewLatest, fields, resolveConflict, dirty }
}

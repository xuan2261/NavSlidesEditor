import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  Save,
  Palette,
  Settings2,
  Zap,
  CheckCircle,
  XCircle,
  Loader2,
  Keyboard,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react'
import { testAIConnection } from '../utils/ai'
import { Button } from '../components/ui'
import { getShortcuts } from '../utils/default-keyboard-shortcut-definitions-registry'
import {
  loadOverrides,
  saveOverride,
  resetOverride,
  resetAll,
  detectConflict,
} from '../utils/shortcut-local-storage-persistence'
import { normalizeKey, isReservedChord } from '../utils/shortcut-normalizer'

const THEMES = [
  'black',
  'white',
  'league',
  'beige',
  'sky',
  'night',
  'serif',
  'simple',
  'solarized',
  'moon',
  'dracula',
]
const TRANSITIONS = ['none', 'fade', 'slide', 'convex', 'concave', 'zoom']

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI', models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'] },
  {
    value: 'gemini',
    label: 'Google Gemini',
    models: ['gemini-2.0-flash', 'gemini-2.0-pro', 'gemini-1.5-flash'],
  },
  { value: 'custom', label: 'Custom (OpenAI-compatible)', models: [] },
]

const fieldClass = 'w-full px-3 py-2 rounded-md border border-border bg-secondary text-text-primary text-sm focus:outline-none focus:border-accent'
const DEFAULT_SETTINGS = {
  ai: {
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4o-mini',
    customEndpoint: '',
    customModel: '',
  },
  defaultTheme: 'black',
  defaultTransition: 'slide',
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [loadError, setLoadError] = useState('')
  const [testStatus, setTestStatus] = useState(null) // null | 'testing' | 'ok' | 'fail'
  const [testError, setTestError] = useState('')
  const [shortcuts, setShortcuts] = useState([])
  const [overrides, setOverrides] = useState({})
  const [recordingId, setRecordingId] = useState(null) // which shortcut id is being recorded
  const [conflictId, setConflictId] = useState(null) // shortcut id that has a conflict
  const [conflictWith, setConflictWith] = useState(null) // what it's conflicting with
  const [reservedWarning, setReservedWarning] = useState(null) // reserved chord warning
  const recordCancelRef = useRef(null)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load settings')
        return r.json()
      })
      .then((data) => {
        setSettings({
          ...DEFAULT_SETTINGS,
          ...data,
          ai: { ...DEFAULT_SETTINGS.ai, ...(data.ai || {}) },
        })
        setLoading(false)
      })
      .catch((err) => {
        setLoadError(err.message || 'Failed to load settings')
        setSettings(DEFAULT_SETTINGS)
        setLoading(false)
      })
  }, [])

  // Load and refresh shortcut registry
  const refreshShortcuts = useCallback(() => {
    const loaded = loadOverrides()
    setOverrides(loaded)
    setShortcuts(getShortcuts(loaded))
  }, [])
  useEffect(() => { refreshShortcuts() }, [refreshShortcuts])

  // Global key listener for shortcut recording
  useEffect(() => {
    if (recordingId === null) return
    setConflictId(null)
    setConflictWith(null)
    setReservedWarning(null)

    const handleKeyDown = (e) => {
      e.preventDefault()
      e.stopPropagation()

      // Escape cancels recording
      if (e.key === 'Escape') {
        setRecordingId(null)
        return
      }

      const chord = normalizeKey(e)

      if (isReservedChord(chord)) {
        setReservedWarning(chord)
        return
      }

      const current = getShortcuts(overrides)
      const conflict = detectConflict(recordingId, chord, current)

      if (conflict) {
        const conflicting = current.find((s) => s.id !== recordingId && s.activeKey === chord)
        setConflictId(recordingId)
        setConflictWith(conflicting?.label || chord)
        return
      }

      // Save and exit recording mode
      saveOverride(recordingId, chord)
      setRecordingId(null)
      setReservedWarning(null)
      refreshShortcuts()
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    recordCancelRef.current = () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
      setRecordingId(null)
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
    }
  }, [recordingId, overrides, refreshShortcuts])

  const handleResetOne = (id) => {
    resetOverride(id)
    refreshShortcuts()
    if (recordingId === id) setRecordingId(null)
  }
  const handleResetAll = () => {
    resetAll()
    refreshShortcuts()
    setRecordingId(null)
  }
  const handleStartRecord = (id) => {
    setRecordingId(id)
    setConflictId(null)
    setConflictWith(null)
    setReservedWarning(null)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveMsg('')
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error('Save failed')
      const data = await res.json()
      setSettings({
        ...DEFAULT_SETTINGS,
        ...data,
        ai: { ...DEFAULT_SETTINGS.ai, ...(data.ai || {}) },
      })
      setSaveMsg('Settings saved!')
      setTimeout(() => setSaveMsg(''), 2000)
    } catch (err) {
      setSaveMsg('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    setTestStatus('testing')
    setTestError('')
    try {
      // testAIConnection sends test payload directly — no server-side settings read needed
      await testAIConnection()
      setTestStatus('ok')
    } catch (err) {
      setTestStatus('fail')
      setTestError(err.message)
    }
  }

  const update = (key, val) =>
    setSettings((s) => ({ ...(s || DEFAULT_SETTINGS), [key]: val }))
  const updateAI = (key, val) =>
    setSettings((s) => ({
      ...(s || DEFAULT_SETTINGS),
      ai: { ...(s?.ai || DEFAULT_SETTINGS.ai), [key]: val },
    }))

  const currentProvider =
    PROVIDERS.find((p) => p.value === (settings?.ai?.provider || 'openai')) || PROVIDERS[0]

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-panel">
        <p className="text-text-muted">Loading settings...</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-panel">
      <div className="flex items-center justify-between px-6 h-14 border-b border-border bg-secondary shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => navigate('/')} className="px-2.5 py-1.5">
            <ChevronLeft size={16} />
          </Button>
          <h1 className="text-xl">
            <Settings2 size={20} className="inline-block mr-2 align-middle" />
            Settings
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {loadError && <span className="text-[13px] text-danger">{loadError}</span>}
          {saveMsg && (
            <span
              className={`text-[13px] ${saveMsg.startsWith('Error') ? 'text-danger' : 'text-success'}`}
            >
              {saveMsg}
            </span>
          )}
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            <Save size={14} />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pt-7 px-8 pb-7 max-w-[640px] mx-auto">
        {/* AI Configuration */}
        <section className="mb-8">
          <h2 className="flex items-center gap-2 mb-4">
            <Zap size={18} /> AI Configuration
          </h2>

          <div className="flex flex-col gap-4">
            {/* Provider */}
            <div>
              <label className="text-[13px] text-text-muted block mb-1.5">
                Provider
              </label>
              <select
                value={settings?.ai?.provider || 'openai'}
                onChange={(e) => updateAI('provider', e.target.value)}
                className={fieldClass}
              >
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* API Key (not for custom without key) */}
            {currentProvider.value !== 'custom' && (
              <div>
                <label className="text-[13px] text-text-muted block mb-1.5">
                  API Key
                </label>
                <input
                  type="password"
                  value={settings?.ai?.apiKey || ''}
                  onChange={(e) => updateAI('apiKey', e.target.value)}
                  placeholder={`Enter your ${currentProvider.label} API key`}
                  className={fieldClass}
                />
              </div>
            )}

            {/* Model selector for known providers */}
            {currentProvider.models.length > 0 && (
              <div>
                <label className="text-[13px] text-text-muted block mb-1.5">
                  Model
                </label>
                <select
                  value={settings?.ai?.model || currentProvider.models[0]}
                  onChange={(e) => updateAI('model', e.target.value)}
                  className={fieldClass}
                >
                  {currentProvider.models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Custom endpoint */}
            {currentProvider.value === 'custom' && (
              <>
                <div>
                  <label className="text-[13px] text-text-muted block mb-1.5">
                    Endpoint URL
                  </label>
                  <input
                    type="text"
                    value={settings?.ai?.customEndpoint || ''}
                    onChange={(e) => updateAI('customEndpoint', e.target.value)}
                    placeholder="http://localhost:11434/v1"
                    className={fieldClass}
                  />
                  <p className="text-xs text-text-muted mt-1">
                    OpenAI-compatible endpoint (Ollama, LM Studio, vLLM, etc.)
                  </p>
                </div>
                <div>
                  <label className="text-[13px] text-text-muted block mb-1.5">
                    Model Name
                  </label>
                  <input
                    type="text"
                    value={settings?.ai?.customModel || ''}
                    onChange={(e) => updateAI('customModel', e.target.value)}
                    placeholder="llama3.2"
                    className={fieldClass}
                  />
                </div>
              </>
            )}

            {/* Test Connection */}
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={handleTestConnection}
                disabled={testStatus === 'testing'}
                className="flex items-center gap-1.5"
              >
                {testStatus === 'testing' ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Zap size={14} />
                )}
                Test Connection
              </Button>
              {testStatus === 'ok' && (
                <span className="text-success text-[13px] flex items-center gap-1">
                  <CheckCircle size={14} /> Connected
                </span>
              )}
              {testStatus === 'fail' && (
                <span className="text-danger text-[13px] flex items-center gap-1">
                  <XCircle size={14} /> {testError || 'Failed'}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Keyboard Shortcuts */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2">
              <Keyboard size={18} /> Keyboard Shortcuts
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetAll}
              className="text-[13px] flex items-center gap-1.5 text-text-muted hover:text-danger"
            >
              <RotateCcw size={13} /> Reset All
            </Button>
          </div>

          {recordingId !== null && (
            <div className="mb-4 px-4 py-3 rounded-md border border-accent bg-accent/10 text-[13px]">
              <span className="font-medium text-accent">Recording shortcut —</span>
              {' '}Press any key combination, or{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-accent/20 text-accent font-mono text-xs">Esc</kbd>
              {' '}to cancel
            </div>
          )}

          {reservedWarning && (
            <div className="mb-4 px-4 py-3 rounded-md border border-amber-500 bg-amber-500/10 text-[13px] flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-500 shrink-0" />
              <span>
                <span className="font-medium text-amber-500">{reservedWarning}</span>
                {' '}is reserved by the browser and cannot be used.
              </span>
            </div>
          )}

          {conflictId && (
            <div className="mb-4 px-4 py-3 rounded-md border border-amber-500 bg-amber-500/10 text-[13px] flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-500 shrink-0" />
              <span>
                Shortcut <span className="font-mono font-medium">{conflictWith}</span> is already assigned to another command.
              </span>
            </div>
          )}

          {['clipboard', 'navigation', 'view'].map((category) => {
            const items = shortcuts.filter((s) => s.category === category)
            if (items.length === 0) return null
            const labels = { clipboard: 'Clipboard', navigation: 'Navigation', view: 'View' }
            return (
              <div key={category} className="mb-5">
                <h3 className="text-[12px] text-text-muted uppercase tracking-wider mb-2 font-medium">
                  {labels[category]}
                </h3>
                <div className="flex flex-col gap-1">
                  {items.map((shortcut) => {
                    const isRecording = recordingId === shortcut.id
                    const isOverridden = shortcut.activeKey !== shortcut.defaultKey
                    return (
                      <div
                        key={shortcut.id}
                        className="flex items-center justify-between py-1.5 px-3 rounded hover:bg-secondary/50 group"
                      >
                        <span className="text-[13px] text-text-primary">{shortcut.label}</span>
                        <div className="flex items-center gap-2">
                          {isRecording ? (
                            <span className="text-[12px] text-accent font-medium animate-pulse">
                              Press a key...
                            </span>
                          ) : (
                            <kbd className="text-[12px] px-2 py-0.5 rounded border border-border bg-secondary font-mono text-text-secondary">
                              {shortcut.activeKey}
                            </kbd>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              isRecording ? setRecordingId(null) : handleStartRecord(shortcut.id)
                            }
                            className={`h-6 px-2 text-[11px] ${
                              isRecording
                                ? 'text-danger hover:text-danger'
                                : 'text-text-muted opacity-0 group-hover:opacity-100 hover:text-accent'
                            }`}
                          >
                            {isRecording ? 'Cancel' : 'Edit'}
                          </Button>
                          {isOverridden && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResetOne(shortcut.id)}
                              className="h-6 px-1.5 text-[11px] text-text-muted opacity-0 group-hover:opacity-100 hover:text-danger"
                              title="Reset to default"
                            >
                              <RotateCcw size={11} />
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          <p className="text-[11px] text-text-muted mt-1">
            Click Edit to record a new shortcut. Conflicts are detected automatically.
          </p>
        </section>

        {/* Default Preferences */}
        <section className="mb-8">
          <h2 className="flex items-center gap-2 mb-4">
            <Palette size={18} /> Default Preferences
          </h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-[13px] text-text-muted block mb-1.5">
                Default Theme
              </label>
              <select
                value={settings?.defaultTheme || 'black'}
                onChange={(e) => update('defaultTheme', e.target.value)}
                className={fieldClass}
              >
                {THEMES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[13px] text-text-muted block mb-1.5">
                Default Transition
              </label>
              <select
                value={settings?.defaultTransition || 'slide'}
                onChange={(e) => update('defaultTransition', e.target.value)}
                className={fieldClass}
              >
                {TRANSITIONS.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

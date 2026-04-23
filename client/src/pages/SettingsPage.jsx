import { useState, useEffect } from 'react'
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
} from 'lucide-react'
import { testAIConnection } from '../utils/ai'
import { Button } from '../components/ui'

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

export default function SettingsPage() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [testStatus, setTestStatus] = useState(null) // null | 'testing' | 'ok' | 'fail'
  const [testError, setTestError] = useState('')

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        setSettings(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

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
      setSettings(data)
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
      // Must save first so the server has the latest config
      await handleSave()
      await testAIConnection()
      setTestStatus('ok')
    } catch (err) {
      setTestStatus('fail')
      setTestError(err.message)
    }
  }

  const update = (key, val) => setSettings((s) => ({ ...s, [key]: val }))
  const updateAI = (key, val) => setSettings((s) => ({ ...s, ai: { ...s.ai, [key]: val } }))

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

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

const fieldStyle = {
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--bg-secondary)',
  color: 'var(--text)',
  fontSize: 14,
  width: '100%',
  boxSizing: 'border-box',
}

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
      <div
        className="h-full flex flex-col bg-bg-primary"
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
      >
        <p style={{ color: 'var(--text-muted)' }}>Loading settings...</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      <div className="flex items-center justify-between px-6 h-14 border-b border-border bg-secondary shrink-0">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button variant="secondary" onClick={() => navigate('/')} style={{ padding: '6px 10px' }}>
            <ChevronLeft size={16} />
          </Button>
          <h1 style={{ fontSize: 20 }}>
            <Settings2 size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            Settings
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {saveMsg && (
            <span
              style={{
                color: saveMsg.startsWith('Error') ? 'var(--danger)' : '#22c55e',
                fontSize: 13,
              }}
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

      <div
        className="flex-1 overflow-y-auto pt-7 px-8 pb-7"
        style={{ maxWidth: 640, margin: '0 auto' }}
      >
        {/* AI Configuration */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Zap size={18} /> AI Configuration
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Provider */}
            <div>
              <label
                style={{
                  fontSize: 13,
                  color: 'var(--text-muted)',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                Provider
              </label>
              <select
                value={settings?.ai?.provider || 'openai'}
                onChange={(e) => updateAI('provider', e.target.value)}
                style={fieldStyle}
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
                <label
                  style={{
                    fontSize: 13,
                    color: 'var(--text-muted)',
                    display: 'block',
                    marginBottom: 6,
                  }}
                >
                  API Key
                </label>
                <input
                  type="password"
                  value={settings?.ai?.apiKey || ''}
                  onChange={(e) => updateAI('apiKey', e.target.value)}
                  placeholder={`Enter your ${currentProvider.label} API key`}
                  style={fieldStyle}
                />
              </div>
            )}

            {/* Model selector for known providers */}
            {currentProvider.models.length > 0 && (
              <div>
                <label
                  style={{
                    fontSize: 13,
                    color: 'var(--text-muted)',
                    display: 'block',
                    marginBottom: 6,
                  }}
                >
                  Model
                </label>
                <select
                  value={settings?.ai?.model || currentProvider.models[0]}
                  onChange={(e) => updateAI('model', e.target.value)}
                  style={fieldStyle}
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
                  <label
                    style={{
                      fontSize: 13,
                      color: 'var(--text-muted)',
                      display: 'block',
                      marginBottom: 6,
                    }}
                  >
                    Endpoint URL
                  </label>
                  <input
                    type="text"
                    value={settings?.ai?.customEndpoint || ''}
                    onChange={(e) => updateAI('customEndpoint', e.target.value)}
                    placeholder="http://localhost:11434/v1"
                    style={fieldStyle}
                  />
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    OpenAI-compatible endpoint (Ollama, LM Studio, vLLM, etc.)
                  </p>
                </div>
                <div>
                  <label
                    style={{
                      fontSize: 13,
                      color: 'var(--text-muted)',
                      display: 'block',
                      marginBottom: 6,
                    }}
                  >
                    Model Name
                  </label>
                  <input
                    type="text"
                    value={settings?.ai?.customModel || ''}
                    onChange={(e) => updateAI('customModel', e.target.value)}
                    placeholder="llama3.2"
                    style={fieldStyle}
                  />
                </div>
              </>
            )}

            {/* Test Connection */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Button
                variant="secondary"
                onClick={handleTestConnection}
                disabled={testStatus === 'testing'}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {testStatus === 'testing' ? (
                  <Loader2 size={14} className="spin" />
                ) : (
                  <Zap size={14} />
                )}
                Test Connection
              </Button>
              {testStatus === 'ok' && (
                <span
                  style={{
                    color: '#22c55e',
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <CheckCircle size={14} /> Connected
                </span>
              )}
              {testStatus === 'fail' && (
                <span
                  style={{
                    color: 'var(--danger)',
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <XCircle size={14} /> {testError || 'Failed'}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Default Preferences */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Palette size={18} /> Default Preferences
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label
                style={{
                  fontSize: 13,
                  color: 'var(--text-muted)',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                Default Theme
              </label>
              <select
                value={settings?.defaultTheme || 'black'}
                onChange={(e) => update('defaultTheme', e.target.value)}
                style={fieldStyle}
              >
                {THEMES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                style={{
                  fontSize: 13,
                  color: 'var(--text-muted)',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                Default Transition
              </label>
              <select
                value={settings?.defaultTransition || 'slide'}
                onChange={(e) => update('defaultTransition', e.target.value)}
                style={fieldStyle}
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

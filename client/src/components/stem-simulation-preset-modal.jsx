import { useState } from 'react'
import { Button } from './ui'
import { isBackdropClick } from '../lib/utils'
import { buildStemSimulationEmbed, STEM_SIMULATION_PROVIDERS } from '../utils/stem-embed-presets'

export default function StemSimulationPresetModal({ onInsert, onCancel }) {
  const [provider, setProvider] = useState(STEM_SIMULATION_PROVIDERS[0].id)
  const [source, setSource] = useState('')
  const [error, setError] = useState('')

  const handleInsert = () => {
    try {
      const embed = buildStemSimulationEmbed(provider, source)
      setError('')
      onInsert?.(embed)
    } catch (err) {
      setError(err.message || 'Invalid STEM simulation URL or ID.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[10000] bg-black/75 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stem-simulation-modal-title"
      aria-describedby="stem-online-warning"
      onClick={(event) => {
        if (isBackdropClick(event)) onCancel?.()
      }}
    >
      <div
        className="bg-card border border-border rounded-xl w-[520px] max-w-[92vw] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-border px-4 py-3">
          <h2 id="stem-simulation-modal-title" className="text-sm font-semibold">
            STEM Simulation
          </h2>
          <p
            id="stem-online-warning"
            className="mt-1 text-xs text-amber-300"
            data-testid="stem-online-warning"
          >
            Online-only embed. Only PhET, GeoGebra, Desmos, and CircuitJS/Falstad URLs are allowed.
          </p>
        </div>
        <div className="space-y-3 p-4">
          <label className="block text-xs text-text-muted">
            Provider
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-hover px-2 py-2 text-sm text-text-primary"
            >
              {STEM_SIMULATION_PROVIDERS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-text-muted">
            URL or ID
            <input
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="Paste an allowed URL or provider ID"
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={error ? 'stem-online-warning stem-source-error' : 'stem-online-warning'}
              className="mt-1 w-full rounded-md border border-border bg-hover px-2 py-2 text-sm text-text-primary"
              autoFocus
            />
          </label>
          {error && (
            <div
              id="stem-source-error"
              role="alert"
              className="rounded-md border border-danger bg-danger/10 px-3 py-2 text-xs text-danger"
            >
              {error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button variant="secondary" className="text-xs" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" className="text-xs" onClick={handleInsert}>
            Insert
          </Button>
        </div>
      </div>
    </div>
  )
}

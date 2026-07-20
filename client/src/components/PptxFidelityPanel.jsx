import React from 'react'
import { Button } from './ui/Button'

export function FidelityStatus({ status }) {
  const label = status === 'original-only' ? 'Original-only fidelity' : 'Source-backed fidelity'
  return <p data-testid="pptx-fidelity-status" role="status" aria-label={label}
    aria-live="polite" className="text-sm text-text-secondary">{label}</p>
}

export function EditabilityTierBadge({ tier }) {
  return (
    <span className="inline-flex rounded-lg border border-border bg-card px-2 py-1 text-xs text-text-secondary">
      Editability: {tier === 'original-only' ? 'Original only' : 'Structural editing'}
    </span>
  )
}

export function PptxExportChoices({ capabilities, actions, busy = false }) {
  const options = [
    ['original', 'Download Original', actions.downloadOriginal],
    ['validatedEdited', 'Export Validated Edited Revision', actions.exportValidatedRevision],
    ['reconstructed', 'Generate Reconstructed PPTX', actions.generateReconstructed],
  ]
  return (
    <fieldset className="rounded-xl border border-border bg-card p-4">
      <legend className="px-1 font-serif text-base text-text-primary">PPTX export choices</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(([key, label, action]) => {
          const capability = capabilities?.[key]
          const unavailableReason = !capability?.available
            ? capability?.reason || capability?.guidance || 'This export is unavailable.'
            : undefined
          return (
            <Button key={key} data-testid={`pptx-export-${key}`}
              variant={key === 'original' ? 'primary' : 'secondary'}
              disabled={busy || !capability?.available} aria-description={unavailableReason}
              title={unavailableReason} onClick={action}>
              {label}
            </Button>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-text-muted">
        Generate Reconstructed PPTX creates a new file and is not a roundtrip export.
      </p>
    </fieldset>
  )
}

export function FidelityRecoveryPanel({ conflict, onReload }) {
  if (!conflict) return null
  return (
    <section role="alert" aria-live="assertive"
      className="rounded-xl border border-danger/40 bg-card p-4 text-sm text-text-primary">
      <h3 className="font-serif text-base">Revision conflict</h3>
      <p>The source changed. Reload and review it before exporting again. Nothing was overwritten.</p>
      <Button variant="secondary" className="mt-2" onClick={onReload}>Reload and review</Button>
    </section>
  )
}

export function PptxFidelityPanel({ contract, actions, conflict, onReload, busy }) {
  if (!contract) return null
  return (
    <aside data-testid="pptx-fidelity-panel" aria-label="PPTX fidelity"
      className="w-full min-w-0 space-y-3 rounded-2xl bg-secondary p-4">
      <FidelityStatus status={contract.fidelity.status} />
      <EditabilityTierBadge tier={contract.fidelity.editabilityTier} />
      <PptxExportChoices capabilities={contract.exports} actions={actions} busy={busy} />
      {!contract.officeCli.available && <p role="note">{contract.officeCli.guidance}</p>}
      <FidelityRecoveryPanel conflict={conflict} onReload={onReload} />
    </aside>
  )
}

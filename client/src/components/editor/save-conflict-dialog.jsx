import { Button } from '../ui'

export default function SaveConflictDialog({
  conflict,
  onUseRemote,
  onKeepLocal,
  onClose,
}) {
  if (!conflict) return null

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/45 p-4"
      role="presentation"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }}
    >
      <section
        className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="save-conflict-title"
        aria-describedby="save-conflict-description"
      >
        <h2 id="save-conflict-title" className="text-base font-semibold text-text-primary">
          Save conflict
        </h2>
        <p id="save-conflict-description" className="mt-2 text-sm text-text-secondary">
          This presentation changed elsewhere. Reload the remote version or keep your local
          changes and overwrite the latest version.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} autoFocus>
            Cancel
          </Button>
          <Button type="button" variant="secondary" onClick={onUseRemote}>
            Use Remote
          </Button>
          <Button type="button" variant="danger" onClick={onKeepLocal}>
            Keep Local
          </Button>
        </div>
      </section>
    </div>
  )
}

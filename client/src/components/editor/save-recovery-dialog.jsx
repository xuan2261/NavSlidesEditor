import { useRef } from 'react'
import { useEscapeClose } from '../../lib/utils'
import { Button } from '../ui'
import { useModalFocusTrap } from '../ui/ModalShell'

export default function SaveRecoveryDialog(props) {
  if (!props.draft) return null
  return <SaveRecoveryDialogContent {...props} />
}

function SaveRecoveryDialogContent({ onUseLocal, onUseRemote, onDefer }) {
  const recoverButtonRef = useRef(null)
  const { dialogRef, handleFocusTrapKeyDown } = useModalFocusTrap({
    initialFocusRef: recoverButtonRef,
  })
  useEscapeClose(onDefer || (() => {}))

  return (
    <div className="fixed inset-0 z-[510] flex items-center justify-center bg-black/45 p-4">
      <section
        ref={dialogRef}
        className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="save-recovery-title"
        aria-describedby="save-recovery-description"
        onKeyDown={handleFocusTrapKeyDown}
      >
        <h2 id="save-recovery-title" className="text-base font-semibold text-text-primary">
          Recover interrupted save
        </h2>
        <p id="save-recovery-description" className="mt-2 text-sm text-text-secondary">
          A local draft was recorded before the last save finished. The remote presentation is still
          shown. Choose which version to keep; no content is replaced automatically.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          {onDefer && (
            <Button type="button" variant="ghost" onClick={onDefer}>
              Keep Draft for Later
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onUseRemote}>
            Use Remote
          </Button>
          <Button
            ref={recoverButtonRef}
            type="button"
            variant="primary"
            onClick={onUseLocal}
          >
            Recover Local Draft
          </Button>
        </div>
      </section>
    </div>
  )
}

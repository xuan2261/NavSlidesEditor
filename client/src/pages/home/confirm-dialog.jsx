import { AlertCircle } from 'lucide-react'
import { Button, ModalShell } from '../../components/ui'

export function ConfirmDialog({ dialog, onClose }) {
  return (
        <ModalShell
          titleId="confirm-dialog-title"
          title={dialog.title}
          size="sm"
          onClose={() => onClose()}
        >
            <div className="flex items-start gap-3.5">
              <div
                className={`w-10 h-10 rounded-md shrink-0 flex items-center justify-center ${
                  dialog.variant === 'danger' ? 'bg-danger/10' : 'bg-warning/10'
                }`}
              >
                <AlertCircle
                  size={22}
                  className={dialog.variant === 'danger' ? 'text-danger' : 'text-warning'}
                />
              </div>
              <div className="flex-1">
                <p className="text-sm text-text-secondary leading-relaxed">
                  {dialog.message}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="secondary" onClick={() => onClose()}>
                Cancel
              </Button>
              <Button
                variant={dialog.variant === 'danger' ? 'danger' : 'primary'}
                onClick={() => {
                  dialog.onConfirm()
                  onClose()
                }}
              >
                {dialog.variant === 'danger' ? 'Delete' : 'Confirm'}
              </Button>
            </div>
        </ModalShell>
  )
}


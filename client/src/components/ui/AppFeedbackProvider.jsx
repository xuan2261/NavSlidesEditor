import { useEffect, useState } from 'react'
import { APP_FEEDBACK_EVENT } from '../../utils/app-feedback'
import { Button } from './Button'
import { ModalShell } from './ModalShell'

export function AppFeedbackProvider() {
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    const handleFeedback = (event) => setFeedback(event.detail)
    window.addEventListener(APP_FEEDBACK_EVENT, handleFeedback)
    return () => window.removeEventListener(APP_FEEDBACK_EVENT, handleFeedback)
  }, [])

  if (!feedback) return null

  const title =
    feedback.title || (feedback.type === 'confirm' ? 'Confirm action' : 'Notice')
  const messageId = 'app-feedback-message'
  const close = () => setFeedback(null)

  if (feedback.type === 'confirm') {
    const confirm = () => {
      close()
      feedback.onConfirm?.()
    }

    return (
      <ModalShell
        title={title}
        titleId="app-feedback-title"
        size="sm"
        onClose={close}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button variant={feedback.destructive ? 'danger' : 'primary'} onClick={confirm}>
              {feedback.confirmLabel || 'Confirm'}
            </Button>
          </div>
        }
      >
        <p id={messageId} className="m-0 whitespace-pre-wrap text-sm leading-6 text-text-secondary">
          {feedback.message}
        </p>
      </ModalShell>
    )
  }

  return (
    <ModalShell
      title={title}
      titleId="app-feedback-title"
      size="sm"
      onClose={close}
      footer={
        <div className="flex justify-end">
          <Button variant="primary" onClick={close}>
            OK
          </Button>
        </div>
      }
    >
      <p
        id={messageId}
        data-testid={feedback.testId || 'app-feedback-message'}
        role={feedback.tone === 'danger' ? 'alert' : 'status'}
        className="m-0 whitespace-pre-wrap text-sm leading-6 text-text-secondary"
      >
        {feedback.message}
      </p>
    </ModalShell>
  )
}

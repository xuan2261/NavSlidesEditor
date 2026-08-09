import { useState } from 'react'
import { Play } from 'lucide-react'
import { Button, ModalShell } from '../components/ui'
import { copyTextToClipboard } from '../utils/copy-to-clipboard'

export default function LivePresentationModal({
  presentationId,
  roomCode,
  presenterToken,
  onPresenterWindowOpened,
  onClose,
}) {
  const [isOpen, setIsOpen] = useState(true)
  const [copyError, setCopyError] = useState('')

  const handleCopy = async (event) => {
    event.target.select()
    const copiedSuccessfully = await copyTextToClipboard(event.target.value)
    if (!copiedSuccessfully) {
      setCopyError('Copy failed. Check browser clipboard permissions and try again.')
      return
    }
    setCopyError('')
  }

  const handleClose = () => {
    setIsOpen(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <ModalShell
      titleId="live-presentation-modal-title"
      title="Present Live"
      onClose={handleClose}
      size="sm"
    >
        <div className="text-center mb-4">
          <div className="text-[13px] text-text-muted mb-2">Room Code</div>
          <div className="text-4xl font-bold text-text-primary py-3 font-mono tracking-[0.25em]">
            {roomCode}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="text-xs text-text-muted mb-1">
            Share these links:
          </div>
          <div className="flex gap-2">
            <input
              readOnly
              value={`${window.location.origin}/live/${roomCode}`}
              className="flex-1 px-3 py-2 rounded-md border border-border bg-secondary text-text-primary text-xs"
              onClick={handleCopy}
            />
            <span className="text-[11px] text-text-muted flex items-center">
              Viewer
            </span>
          </div>
          <div className="flex gap-2">
            <input
              readOnly
              value={`${window.location.origin}/remote/${roomCode}`}
              className="flex-1 px-3 py-2 rounded-md border border-border bg-secondary text-text-primary text-xs"
              onClick={handleCopy}
            />
            <span className="text-[11px] text-text-muted flex items-center">
              Remote
            </span>
          </div>
          <div className="flex gap-2">
            <input
              readOnly
              value={`${window.location.origin}/speaker/${roomCode}`}
              className="flex-1 px-3 py-2 rounded-md border border-border bg-secondary text-text-primary text-xs"
              onClick={handleCopy}
            />
            <span className="text-[11px] text-text-muted flex items-center">
              Speaker
            </span>
          </div>
        </div>
        {copyError && (
          <p className="mt-3 text-xs text-danger" role="alert">
            {copyError}
          </p>
        )}
        <Button
          variant="primary"
          onClick={() => {
            const presenterWindow = window.open('', '_blank')
            if (presenterWindow) {
              presenterWindow.name = JSON.stringify({
                presentationId,
                roomCode,
                presenterToken: presenterToken || '',
              })
              onPresenterWindowOpened?.({ presenterWindow, presentationId, roomCode })
              presenterWindow.location.href =
                `/api/presentations/${presentationId}/present?live=${roomCode}`
            }
            handleClose()
          }}
          className="w-full mt-4 justify-center"
        >
          <Play size={14} /> Start Presenting
        </Button>
    </ModalShell>
  )
}

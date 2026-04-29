import { useState, useEffect } from 'react'
import { Radio, Play, X } from 'lucide-react'
import { Button } from '../components/ui'
import { isBackdropClick } from '../lib/utils'

export default function LivePresentationModal({ presentationId, roomCode, presenterToken, onClose }) {
  const [isOpen, setIsOpen] = useState(true)

  const handleClose = () => {
    setIsOpen(false)
    onClose()
  }

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50"
      onClick={(event) => {
        if (isBackdropClick(event)) handleClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-presentation-modal-title"
    >
      <div
        className="bg-card rounded-xl p-6 w-[400px] shadow-2xl border border-border"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 id="live-presentation-modal-title" className="m-0 text-base flex items-center gap-2 text-text-primary">
            <Radio size={18} /> Present Live
          </h3>
          <Button variant="icon" onClick={handleClose} className="w-6 h-6" aria-label="Close">
            <X size={16} />
          </Button>
        </div>
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
              onClick={(e) => {
                e.target.select()
                navigator.clipboard.writeText(e.target.value)
              }}
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
              onClick={(e) => {
                e.target.select()
                navigator.clipboard.writeText(e.target.value)
              }}
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
              onClick={(e) => {
                e.target.select()
                navigator.clipboard.writeText(e.target.value)
              }}
            />
            <span className="text-[11px] text-text-muted flex items-center">
              Speaker
            </span>
          </div>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            const presenterWindow = window.open(
              `/api/presentations/${presentationId}/present?live=${roomCode}`,
              '_blank'
            )
            if (presenterWindow) {
              presenterWindow.name = JSON.stringify({
                roomCode,
                presenterToken: presenterToken || '',
              })
            }
            handleClose()
          }}
          className="w-full mt-4 justify-center"
        >
          <Play size={14} /> Start Presenting
        </Button>
      </div>
    </div>
  )
}

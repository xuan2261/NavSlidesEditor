import { useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, SkipBack, SkipForward, X } from 'lucide-react'
import { Button } from '../components/ui'
import { useRevealPreviewFrame } from '../hooks/use-reveal-preview-frame'
import { generateRevealHTML } from '../utils/generateHTML'
import {
  advanceAnimationPreviewStep,
  buildAnimationPreviewPresentation,
  getAnimationPreviewState,
  getAnimationPreviewSteps,
  rewindAnimationPreviewStep,
} from './animation-preview-helpers'

const AUTO_PLAY_DELAY_MS = 800
const DIALOG_TITLE_ID = 'animation-preview-title'
const DIALOG_DESCRIPTION_ID = 'animation-preview-description'
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), iframe, [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function AnimationPreviewModal({ presentation, slideIndex, onClose }) {
  const previewPresentation = buildAnimationPreviewPresentation(presentation, slideIndex)
  const previewSlide = previewPresentation.slides[0]
  const previewSteps = getAnimationPreviewSteps(previewSlide)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const closeButtonRef = useRef(null)
  const dialogRef = useRef(null)
  const previousFocusRef = useRef(null)

  useEffect(() => {
    if (!isPlaying) return undefined
    if (currentStepIndex >= previewSteps.length - 1) return undefined

    const timer = window.setTimeout(() => {
      setCurrentStepIndex((previousIndex) => {
        const nextIndex = advanceAnimationPreviewStep(previewSteps, previousIndex)
        if (nextIndex >= previewSteps.length - 1) setIsPlaying(false)
        return nextIndex
      })
    }, AUTO_PLAY_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [currentStepIndex, isPlaying, previewSteps])

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return undefined

    const previousFocus = document.activeElement
    previousFocusRef.current =
      previousFocus && typeof previousFocus.focus === 'function' ? previousFocus : null

    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus()
    }, 0)

    return () => {
      window.clearTimeout(focusTimer)
      previousFocusRef.current?.focus?.()
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const getFocusableElements = () =>
      Array.from(dialogRef.current?.querySelectorAll(FOCUSABLE_SELECTOR) ?? []).filter(
        (element) => !element.hasAttribute('disabled')
      )

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') return

      const focusableElements = getFocusableElements()
      if (focusableElements.length === 0) {
        event.preventDefault()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const htmlContent = previewSlide ? generateRevealHTML(previewPresentation) : ''
  const previewState = getAnimationPreviewState(previewSteps, currentStepIndex)
  const { iframeRef } = useRevealPreviewFrame(htmlContent, previewState)

  if (!previewSlide) return null

  const currentFragmentIndex = previewSteps[currentStepIndex] ?? 0
  const totalFragmentSteps = Math.max(previewSteps.length - 1, 0)

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-3 sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={DIALOG_TITLE_ID}
        aria-describedby={DIALOG_DESCRIPTION_ID}
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 id={DIALOG_TITLE_ID} className="text-sm font-semibold text-text-primary">
              Animation Preview
            </h2>
            <p id={DIALOG_DESCRIPTION_ID} className="text-xs text-text-muted">
              Slide {slideIndex + 1} · Step {currentStepIndex} / {totalFragmentSteps}
              {currentFragmentIndex > 0 ? ` · Fragment ${currentFragmentIndex}` : ' · Initial state'}
            </p>
          </div>
          <Button
            ref={closeButtonRef}
            variant="icon"
            onClick={onClose}
            title="Close preview"
            aria-label="Close preview"
          >
            <X size={16} />
          </Button>
        </div>

        <div className="min-h-0 overflow-auto bg-black/30 p-3 sm:p-4">
          <div className="h-[60vh] min-h-[260px] max-h-[70vh] w-full overflow-hidden rounded-lg border border-border bg-black sm:h-[70vh]">
            <iframe
              ref={iframeRef}
              className="h-full w-full border-0 bg-black"
              title="Animation Preview"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
          <Button
            variant="secondary"
            className="min-w-[88px] px-3 py-1.5 text-xs"
            disabled={currentStepIndex === 0}
            onClick={() => {
              setIsPlaying(false)
              setCurrentStepIndex((previousIndex) =>
                rewindAnimationPreviewStep(previewSteps, previousIndex)
              )
            }}
          >
            <SkipBack size={14} /> Previous
          </Button>
          <Button
            variant="secondary"
            className="min-w-[76px] px-3 py-1.5 text-xs"
            disabled={previewSteps.length <= 1}
            onClick={() => {
              if (currentStepIndex >= previewSteps.length - 1) {
                setCurrentStepIndex(0)
                setIsPlaying(true)
                return
              }
              setIsPlaying((previousValue) => !previousValue)
            }}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            {isPlaying ? 'Pause' : 'Play'}
          </Button>
          <Button
            variant="secondary"
            className="min-w-[72px] px-3 py-1.5 text-xs"
            disabled={currentStepIndex >= previewSteps.length - 1}
            onClick={() => {
              setIsPlaying(false)
              setCurrentStepIndex((previousIndex) =>
                advanceAnimationPreviewStep(previewSteps, previousIndex)
              )
            }}
          >
            Next <SkipForward size={14} />
          </Button>
          <Button
            variant="secondary"
            className="min-w-[76px] px-3 py-1.5 text-xs"
            onClick={() => {
              setIsPlaying(false)
              setCurrentStepIndex(0)
            }}
          >
            <RotateCcw size={14} /> Replay
          </Button>
        </div>
      </div>
    </div>
  )
}

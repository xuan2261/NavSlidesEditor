import { useEffect, useMemo, useRef, useState } from 'react'
import { X, RotateCcw } from 'lucide-react'
import { Button } from '../components/ui'
import { generateOfflineHTML } from '../utils/offlineExport'
import { prepareSemanticOutputResources } from '../utils/generateHTML'
import { resolveEffectiveTransition } from 'revealjs-shared'
import { useRevealPreviewFrame } from '../hooks/use-reveal-preview-frame'
import { useTransitionPreviewDialog } from '../hooks/use-transition-preview-dialog'
import {
  buildTransitionPreviewHtml,
  resolveTransitionPreviewSlides,
} from './transition-preview-helpers'

const TRANSITIONS = ['none', 'fade', 'slide', 'convex', 'concave', 'zoom']
const DIALOG_TITLE_ID = 'transition-preview-title'
const DIALOG_DESCRIPTION_ID = 'transition-preview-description'

export default function TransitionPreview({
  presentation,
  fromIndex,
  verticalEdit = null,
  onClose,
}) {
  const [key, setKey] = useState(0)
  const [prepared, setPrepared] = useState(null)
  const dialogRef = useRef(null)
  const closeButtonRef = useRef(null)
  const previewSlides = useMemo(
    () =>
      resolveTransitionPreviewSlides({
        presentation,
        currentSlideIndex: fromIndex,
        verticalEdit,
      }),
    [presentation, fromIndex, verticalEdit]
  )
  const slide1 = previewSlides.currentSlide
  const slide2 = previewSlides.nextSlide
  const hasNextSlide = Boolean(slide1 && slide2)
  const effective = useMemo(
    () =>
      resolveEffectiveTransition({
        presentation,
        currentSlide: slide1,
        nextSlide: slide2,
      }),
    [presentation, slide1, slide2]
  )
  const [transitionOverride, setTransitionOverride] = useState(null)
  const selectedTransition = transitionOverride || effective.transition
  const previewSource = useMemo(() => {
    if (!slide1 || !slide2) return null
    return {
      presentation,
      currentSlide: slide1,
      nextSlide: slide2,
      transitionOverride: selectedTransition,
    }
  }, [presentation, slide1, slide2, selectedTransition])
  const matching = prepared?.source === previewSource
  const previewHtml = matching ? prepared.html : ''
  const previewError = matching ? prepared.error : null
  const resolution = presentation?.resolution || { width: 960, height: 540 }
  const { iframeRef, error: frameError, status } = useRevealPreviewFrame(previewHtml, null, key)

  useEffect(() => {
    if (!previewSource) return undefined
    const controller = new AbortController()
    prepareSemanticOutputResources(presentation, { signal: controller.signal })
      .then((semanticOutputResources) => {
        if (controller.signal.aborted) return null
        const { html } = buildTransitionPreviewHtml({ ...previewSource, semanticOutputResources })
        return generateOfflineHTML(html, { generatedDocument: true, strictRequiredAssets: true })
      })
      .then((offlineHtml) => {
        if (!controller.signal.aborted && offlineHtml) {
          setPrepared({ source: previewSource, html: offlineHtml, error: null })
        }
      })
      .catch((cause) => {
        if (controller.signal.aborted) return
        setPrepared({ source: previewSource, html: '', error: cause.message })
      })
    return () => {
      controller.abort()
    }
  }, [previewSource, presentation])

  useTransitionPreviewDialog({ dialogRef, closeButtonRef, onClose })

  if (!slide1 || !hasNextSlide) {
    return (
      <div
        className="fixed inset-0 z-[10000] bg-black/60 flex items-center justify-center"
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
          className="bg-card rounded-xl border border-border shadow-2xl w-[620px] max-w-[90vw] overflow-hidden"
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <div className="min-w-0 flex-1">
              <h2 id={DIALOG_TITLE_ID} className="font-semibold text-sm">
                Transition Preview
              </h2>
              <p id={DIALOG_DESCRIPTION_ID} className="text-xs text-text-muted">
                There is no next slide to preview.
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
        </div>
      </div>
    )
  }

  const previewScale = Math.min(560 / resolution.width, 320 / resolution.height)
  return (
    <div
      className="fixed inset-0 z-[10000] bg-black/60 flex items-center justify-center"
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
        className="bg-card rounded-xl border border-border shadow-2xl w-[620px] max-w-[90vw] overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <div className="min-w-0 flex-1">
            <h2 id={DIALOG_TITLE_ID} className="font-semibold text-sm">
              Transition Preview
            </h2>
            <p id={DIALOG_DESCRIPTION_ID} className="text-xs text-text-muted">
              Slide {previewSlides.currentAddress} → {previewSlides.nextAddress}
              {effective.direction !== 'default' ? ` · ${effective.direction}` : ''}
              {effective.duration !== null ? ` · ${effective.duration}ms` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <select
              aria-label="Transition"
              value={selectedTransition}
              onChange={(event) => {
                setTransitionOverride(event.target.value)
                setKey((value) => value + 1)
              }}
              className="bg-hover border border-border text-text-primary px-2 py-1 rounded text-xs cursor-pointer"
            >
              {TRANSITIONS.map((value) => (
                <option key={value} value={value}>
                  {value.charAt(0).toUpperCase() + value.slice(1)}
                </option>
              ))}
            </select>
            <Button
              variant="icon"
              onClick={() => setKey((value) => value + 1)}
              title="Replay preview"
              aria-label="Replay preview"
            >
              <RotateCcw size={14} />
            </Button>
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
        </div>
        <div className="p-4 flex items-center justify-center bg-black/30 overflow-hidden h-[360px]">
          <iframe
            key={key}
            ref={iframeRef}
            srcDoc={previewHtml}
            style={{
              width: resolution.width,
              height: resolution.height,
              border: 'none',
              transform: `scale(${previewScale})`,
              transformOrigin: 'center center',
            }}
            title="Transition Preview"
            sandbox={presentation?.pptxSemantic ? 'allow-scripts allow-same-origin' : 'allow-scripts'}
            aria-busy={status !== 'ready'}
          />
        </div>
        {(previewError || frameError) && (
          <p className="px-4 pb-3 text-[11px] text-text-muted" role="status">
            {previewError || frameError}
          </p>
        )}
      </div>
    </div>
  )
}

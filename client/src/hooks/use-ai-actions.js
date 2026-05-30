import { useCallback } from 'react'
import { buildSlidesFromOutline } from '../utils/build-slides-from-outline'
import { applyTranslatedNotes, getSlideNotesTranslationKey } from '../utils/slide-notes'
import { sanitizeRichTextHtml } from '../utils/content-safety'

/**
 * AI action handlers extracted from EditorPage. Owns slide generation from an
 * outline, the AI copywriter apply, and translation apply.
 *
 * Security (untrusted AI-provider boundary): translated HTML is sanitized
 * before it is written to element content — AI responses are not trusted to be
 * free of executable markup.
 *
 * @param {Object} deps
 * @param {Function} deps.setPresentation
 * @param {Function} deps.updateElement
 * @param {string|null} deps.selectedElementId
 */
export function useAiActions({ setPresentation, updateElement, selectedElementId }) {
  // Build slides locally from the outline (every field escaped by the builder).
  // No network round-trip — see build-slides-from-outline + the deprecated
  // /api/ai/generate-slides route.
  const onCreatePresentation = useCallback(
    (outline) => {
      try {
        const newSlides = buildSlidesFromOutline(outline)
        setPresentation((prev) => ({
          ...prev,
          slides: [...(prev.slides || []), ...newSlides],
        }))
      } catch (err) {
        alert('Failed to generate slides: ' + err.message)
      }
    },
    [setPresentation]
  )

  const onAICopywriterApply = useCallback(
    (newText) => {
      if (selectedElementId) {
        updateElement(selectedElementId, { content: `<p>${newText}</p>` })
      }
    },
    [selectedElementId, updateElement]
  )

  const onApplyTranslations = useCallback(
    (translationMap, keepOriginal) => {
      setPresentation((prev) => {
        const newSlides = prev.slides.map((slide, si) => {
          let updatedSlide = { ...slide }
          if (slide.elements) {
            updatedSlide.elements = slide.elements.map((el, ei) => {
              const key = `${si}-${ei}-content`
              const t = translationMap[key]
              // Sanitize provider HTML before it reaches the content sink.
              if (t) return { ...el, content: sanitizeRichTextHtml(t.translatedHtml) }
              return el
            })
          }
          const notesKey = getSlideNotesTranslationKey(si)
          const notesT = translationMap[notesKey]
          if (notesT) {
            updatedSlide = applyTranslatedNotes(
              updatedSlide,
              sanitizeRichTextHtml(notesT.translatedHtml),
              keepOriginal
            )
          }
          return updatedSlide
        })
        return { ...prev, slides: newSlides }
      })
    },
    [setPresentation]
  )

  return { onCreatePresentation, onAICopywriterApply, onApplyTranslations }
}

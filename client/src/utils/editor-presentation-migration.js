import { sanitizeRichTextHtml } from 'revealjs-shared/src/content-safety.js'
import { normalizeSemanticPresentation } from 'revealjs-shared/src/pptx-semantic-presentation.js'
import { migrateVideoSrc } from './migrate-video-src'
import { normalizePresentationNotes } from './slide-notes'
import {
  normalizeElementAction,
  normalizeImageAccessibility,
  normalizeMediaAccessibility,
  normalizeSlideConnectorConnections,
  normalizeGameElement,
  normalizePresentationEducation,
} from 'revealjs-shared'

const legacyTextElement = (content) => ({
  id: crypto.randomUUID(),
  type: 'text',
  x: 80,
  y: 100,
  width: 800,
  height: 340,
  zIndex: 1,
  content,
})

function migrateElement(element, gameOptions, canonical = true) {
  const withId =
    element && (typeof element.id !== 'string' || !element.id.trim())
      ? { ...element, id: crypto.randomUUID() }
      : element
  const migrated = migrateVideoSrc(withId)
  const withGameConfig =
    !canonical || migrated?.type !== 'game' || typeof migrated.gameType !== 'string'
      ? migrated
      : normalizeGameElement(migrated, gameOptions)
  const { action } = canonical ? normalizeElementAction(withGameConfig?.action) : {}
  const withAction = action ? { ...withGameConfig, action } : withGameConfig
  return normalizeMediaAccessibility(normalizeImageAccessibility(withAction))
}

function migrateElements(elements, gameOptions, canonical) {
  return normalizeSlideConnectorConnections(
    elements.map((element) => migrateElement(element, gameOptions, canonical))
  )
}

function translateChild(child, gameOptions, canonical) {
  const elements = Array.isArray(child.elements)
    ? migrateElements(child.elements, gameOptions, canonical)
    : child.html
      ? migrateElements(
          [legacyTextElement(sanitizeRichTextHtml(child.html))],
          gameOptions,
          canonical
        )
      : []
  return { ...child, elements }
}

function translateSlide(slide, gameOptions, canonical) {
  const withChildren =
    slide.children?.length > 0
      ? {
          ...slide,
          children: slide.children.map((child) => translateChild(child, gameOptions, canonical)),
        }
      : slide

  const elements = Array.isArray(withChildren.elements)
    ? migrateElements(withChildren.elements, gameOptions, canonical)
    : withChildren.html
      ? migrateElements([legacyTextElement(withChildren.html)], gameOptions, canonical)
      : []
  return { ...withChildren, elements }
}

// Standalone callers retain game/action normalization and their validation options.
export function migrateChild(child, gameOptions) {
  return translateChild(child, gameOptions, true)
}

export function migrateSlide(slide, gameOptions) {
  return translateSlide(slide, gameOptions, true)
}

export function migratePresentation(presentation, { draft = false } = {}) {
  presentation = normalizeSemanticPresentation(presentation)
  // Only local drafts bypass admission validation; canonical migration still throws.
  const gameOptions = { validate: !draft }
  return normalizePresentationNotes(
    normalizePresentationEducation(
      {
        ...presentation,
        slides: (presentation.slides || []).map((slide) =>
          translateSlide(slide, gameOptions, false)
        ),
      },
      gameOptions
    )
  )
}

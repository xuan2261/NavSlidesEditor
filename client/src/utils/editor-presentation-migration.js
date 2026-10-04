import { sanitizeRichTextHtml } from 'revealjs-shared/src/content-safety.js'
import { migrateVideoSrc } from './migrate-video-src'
import { normalizePresentationNotes } from './slide-notes'
import {
  normalizeElementAction,
  normalizeImageAccessibility,
  normalizeLayoutMasters,
  normalizeLayoutOverrides,
  normalizeMediaAccessibility,
  normalizeSlideConnectorConnections,
  normalizeGameElement,
  normalizePresentationGames,
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

function migrateElement(element, gameOptions) {
  const withId =
    element && (typeof element.id !== 'string' || !element.id.trim())
      ? { ...element, id: crypto.randomUUID() }
      : element
  const migrated = migrateVideoSrc(withId)
  const withGameConfig =
    migrated?.type !== 'game' || typeof migrated.gameType !== 'string'
      ? migrated
      : normalizeGameElement(migrated, gameOptions)
  const { action } = normalizeElementAction(withGameConfig?.action)
  const withAction = action ? { ...withGameConfig, action } : withGameConfig
  return normalizeMediaAccessibility(normalizeImageAccessibility(withAction))
}

function migrateElements(elements, gameOptions) {
  return normalizeSlideConnectorConnections(
    elements.map((element) => migrateElement(element, gameOptions))
  )
}

function migrateLayoutMetadata(slide) {
  const layoutOverrides = normalizeLayoutOverrides(slide.layoutOverrides)
  const children = Array.isArray(slide.children)
    ? slide.children.map(migrateLayoutMetadata)
    : slide.children
  if (!layoutOverrides && children === slide.children) return slide
  return {
    ...slide,
    ...(children !== slide.children ? { children } : {}),
    ...(layoutOverrides ? { layoutOverrides } : {}),
  }
}

export function migrateChild(child, gameOptions) {
  const elements = Array.isArray(child.elements)
    ? migrateElements(child.elements, gameOptions)
    : child.html
      ? migrateElements([legacyTextElement(sanitizeRichTextHtml(child.html))], gameOptions)
      : []
  return { ...child, elements }
}

export function migrateSlide(slide, gameOptions) {
  const withChildren =
    slide.children?.length > 0
      ? { ...slide, children: slide.children.map((child) => migrateChild(child, gameOptions)) }
      : slide

  const elements = Array.isArray(withChildren.elements)
    ? migrateElements(withChildren.elements, gameOptions)
    : withChildren.html
      ? migrateElements([legacyTextElement(withChildren.html)], gameOptions)
      : []
  return { ...withChildren, elements }
}

export function migratePresentation(presentation, { draft = false } = {}) {
  // Only local drafts bypass admission validation; canonical migration still throws.
  const gameOptions = { validate: !draft }
  const layoutMasters = normalizeLayoutMasters(presentation.layoutMasters)
  return normalizePresentationNotes(
    normalizePresentationGames(
      {
        ...presentation,
        slides: (presentation.slides || [])
          .map((slide) => migrateSlide(slide, gameOptions))
          .map(migrateLayoutMetadata),
        ...(layoutMasters ? { layoutMasters } : {}),
      },
      gameOptions
    )
  )
}

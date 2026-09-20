import { sanitizeRichTextHtml } from './content-safety'
import { resolveGameConfig } from '../constants/game-element-types-constants'
import { migrateVideoSrc } from './migrate-video-src'
import { normalizePresentationNotes } from './slide-notes'
import {
  normalizeElementAction,
  normalizeImageAccessibility,
  normalizeLayoutMasters,
  normalizeLayoutOverrides,
  normalizeMediaAccessibility,
  normalizeSlideConnectorConnections,
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

function migrateElement(element) {
  const withId =
    element && (typeof element.id !== 'string' || !element.id.trim())
      ? { ...element, id: crypto.randomUUID() }
      : element
  const migrated = migrateVideoSrc(withId)
  const withGameConfig =
    migrated?.type !== 'game' || typeof migrated.gameType !== 'string'
      ? migrated
      : {
          ...migrated,
          [migrated.gameType]: resolveGameConfig(migrated, migrated.gameType),
        }
  const { action } = normalizeElementAction(withGameConfig?.action)
  const withAction = action ? { ...withGameConfig, action } : withGameConfig
  return normalizeMediaAccessibility(normalizeImageAccessibility(withAction))
}

function migrateElements(elements) {
  return normalizeSlideConnectorConnections(elements.map(migrateElement))
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

export function migrateChild(child) {
  const elements = Array.isArray(child.elements)
    ? migrateElements(child.elements)
    : child.html
      ? migrateElements([legacyTextElement(sanitizeRichTextHtml(child.html))])
      : []
  return { ...child, elements }
}

export function migrateSlide(slide) {
  const withChildren =
    slide.children?.length > 0 ? { ...slide, children: slide.children.map(migrateChild) } : slide

  const elements = Array.isArray(withChildren.elements)
    ? migrateElements(withChildren.elements)
    : withChildren.html
      ? migrateElements([legacyTextElement(withChildren.html)])
      : []
  return { ...withChildren, elements }
}

export function migratePresentation(presentation) {
  const layoutMasters = normalizeLayoutMasters(presentation.layoutMasters)
  return normalizePresentationNotes({
    ...presentation,
    slides: (presentation.slides || []).map(migrateSlide).map(migrateLayoutMetadata),
    ...(layoutMasters ? { layoutMasters } : {}),
  })
}

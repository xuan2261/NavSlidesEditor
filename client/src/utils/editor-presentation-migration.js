import { sanitizeRichTextHtml } from './content-safety'
import { resolveGameConfig } from '../constants/game-element-types-constants'
import { migrateVideoSrc } from './migrate-video-src'
import { normalizePresentationNotes } from './slide-notes'

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
  const migrated = migrateVideoSrc(element)
  if (migrated?.type !== 'game' || typeof migrated.gameType !== 'string') return migrated
  return {
    ...migrated,
    [migrated.gameType]: resolveGameConfig(migrated, migrated.gameType),
  }
}

export function migrateChild(child) {
  const elements = Array.isArray(child.elements)
    ? child.elements.map(migrateElement)
    : child.html
      ? [legacyTextElement(sanitizeRichTextHtml(child.html))]
      : []
  return { ...child, elements }
}

export function migrateSlide(slide) {
  const withChildren =
    slide.children?.length > 0
      ? { ...slide, children: slide.children.map(migrateChild) }
      : slide

  if (!Array.isArray(withChildren.elements)) {
    return {
      ...withChildren,
      elements: withChildren.html ? [legacyTextElement(withChildren.html)] : [],
    }
  }
  return { ...withChildren, elements: withChildren.elements.map(migrateElement) }
}

export function migratePresentation(presentation) {
  return normalizePresentationNotes({
    ...presentation,
    slides: (presentation.slides || []).map(migrateSlide),
  })
}

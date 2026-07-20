import { sanitizeRichTextHtml } from './content-safety'
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

export function migrateChild(child) {
  if (child.elements) return child
  return {
    ...child,
    elements: child.html ? [legacyTextElement(sanitizeRichTextHtml(child.html))] : [],
  }
}

export function migrateSlide(slide) {
  const withChildren =
    slide.children?.length > 0
      ? { ...slide, children: slide.children.map(migrateChild) }
      : slide

  if (!withChildren.elements) {
    return {
      ...withChildren,
      elements: withChildren.html ? [legacyTextElement(withChildren.html)] : [],
    }
  }
  return { ...withChildren, elements: withChildren.elements.map(migrateVideoSrc) }
}

export function migratePresentation(presentation) {
  return normalizePresentationNotes({
    ...presentation,
    slides: (presentation.slides || []).map(migrateSlide),
  })
}

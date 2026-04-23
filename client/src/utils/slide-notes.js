import * as shared from 'revealjs-shared'

const sharedModule = shared.default || shared

function getSlideNotesFallback(slide) {
  if (!slide || typeof slide !== 'object') return ''
  if (typeof slide.notes === 'string') return slide.notes
  if (typeof slide.speakerNotes === 'string') return slide.speakerNotes
  return ''
}

function normalizeSlideNotesFallback(slide) {
  if (!slide || typeof slide !== 'object') return slide

  const normalized = {
    ...slide,
    notes: getSlideNotes(slide),
  }

  if (Array.isArray(slide.children)) {
    normalized.children = slide.children.map(normalizeSlideNotesFallback)
  }

  delete normalized.speakerNotes
  return normalized
}

function normalizePresentationNotesFallback(presentation) {
  if (!presentation || typeof presentation !== 'object') return presentation
  if (!Array.isArray(presentation.slides)) return presentation

  return {
    ...presentation,
    slides: presentation.slides.map(normalizeSlideNotes),
  }
}

export const getSlideNotes =
  typeof sharedModule.getSlideNotes === 'function'
    ? sharedModule.getSlideNotes
    : getSlideNotesFallback

export const normalizeSlideNotes =
  typeof sharedModule.normalizeSlideNotes === 'function'
    ? sharedModule.normalizeSlideNotes
    : normalizeSlideNotesFallback

export const normalizePresentationNotes =
  typeof sharedModule.normalizePresentationNotes === 'function'
    ? sharedModule.normalizePresentationNotes
    : normalizePresentationNotesFallback

export function getSlideNotesTranslationKey(slideIndex) {
  return `${slideIndex}-notes-notes`
}

export function applyTranslatedNotes(slide, translatedNotes, keepOriginal = false) {
  const currentNotes = getSlideNotes(slide)
  const notes =
    keepOriginal && currentNotes ? `${translatedNotes}\n\n---\n${currentNotes}` : translatedNotes

  return normalizeSlideNotes({
    ...slide,
    notes,
  })
}

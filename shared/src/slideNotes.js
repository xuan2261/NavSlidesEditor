function getSlideNotes(slide) {
  if (!slide || typeof slide !== 'object') return ''
  if (typeof slide.notes === 'string') return slide.notes
  if (typeof slide.speakerNotes === 'string') return slide.speakerNotes
  return ''
}

function normalizeSlideNotes(slide) {
  if (!slide || typeof slide !== 'object') return slide

  const normalized = {
    ...slide,
    notes: getSlideNotes(slide),
  }

  if (Array.isArray(slide.children)) {
    normalized.children = slide.children.map(normalizeSlideNotes)
  }

  delete normalized.speakerNotes
  return normalized
}

function normalizePresentationNotes(presentation) {
  if (!presentation || typeof presentation !== 'object') return presentation
  if (!Array.isArray(presentation.slides)) return presentation

  return {
    ...presentation,
    slides: presentation.slides.map(normalizeSlideNotes),
  }
}

module.exports = {
  getSlideNotes,
  normalizeSlideNotes,
  normalizePresentationNotes,
}

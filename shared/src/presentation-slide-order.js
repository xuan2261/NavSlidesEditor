// Reveal's first vertical section is the parent itself, then its children.
// Native fields use this global order, not optional footer numbering or print
// fragment pages. Keep this traversal shared by canvas and generated outputs.
function presentationSlideEntries(presentation) {
  const entries = []
  for (const [horizontalIndex, slide] of (presentation.slides || []).entries()) {
    entries.push({ slide, horizontalIndex, verticalIndex: 0, slideNumber: entries.length + 1 })
    for (const [index, child] of (slide.children || []).entries())
      entries.push({ slide: child, horizontalIndex, verticalIndex: index + 1, slideNumber: entries.length + 1 })
  }
  return entries
}
function slideFieldContext(slide, slideNumber, context = {}) {
  return { ...context, slideNumber, slideTitle: slide.title }
}
module.exports = { presentationSlideEntries, slideFieldContext }

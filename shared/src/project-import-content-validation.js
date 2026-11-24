const {
  normalizePresentationInteractions,
} = require('./education/presentation-interaction-normalization.js')

/** Renderer-critical field checks shared by project import admission paths. */
function getProjectImportContentErrors(presentation) {
  const errors = []
  try {
    normalizePresentationInteractions(presentation || {})
  } catch (error) {
    for (const issue of error.errors || [{ path: [], message: error.message }])
      errors.push(`${issue.path.join('.')}: ${issue.message}`)
  }
  const visit = (slides, path) => {
    if (!Array.isArray(slides)) return
    slides.forEach((slide, slideIndex) => {
      const slidePath = `${path}[${slideIndex}]`
      if (Array.isArray(slide?.elements)) {
        slide.elements.forEach((element, elementIndex) => {
          const elementPath = `${slidePath}.elements[${elementIndex}]`
          if (element?.type === 'table' && element.data != null) {
            if (!Array.isArray(element.data) || !element.data.every(Array.isArray)) {
              errors.push(`${elementPath}.data must be an array of rows`)
            }
          }
          if (
            element?.type === 'markdown' &&
            element.content != null &&
            typeof element.content !== 'string'
          ) {
            errors.push(`${elementPath}.content must be a string`)
          }
          if (
            element?.type === 'code' &&
            element.language != null &&
            typeof element.language !== 'string'
          ) {
            errors.push(`${elementPath}.language must be a string`)
          }
        })
      }
      visit(slide?.children, `${slidePath}.children`)
    })
  }
  visit(presentation?.slides, 'slides')
  return errors
}

module.exports = { getProjectImportContentErrors }

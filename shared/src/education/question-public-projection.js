const {
  PUBLIC_FIELDS,
  isRecord,
  result,
  validateQuestionShape,
  validationError,
} = require('./question-shape.js')

const projectMedia = (media) => (isRecord(media) ? { src: media.src, alt: media.alt } : media)
function projectItem(item, allowMedia) {
  if (!isRecord(item)) return item
  const projected = { id: item.id, text: item.text }
  if (allowMedia && item.media !== undefined) projected.media = projectMedia(item.media)
  return projected
}

function validatePublicQuestion(value) {
  const errors = []
  validateQuestionShape(value, errors)
  return result(errors)
}

function projectPublicQuestion(question) {
  if (!isRecord(question))
    throw validationError('Cannot project public question', [
      { path: [], message: 'Expected a question object.' },
    ])
  const projected = {}
  for (const field of PUBLIC_FIELDS) {
    if (field === 'options' || field === 'media') continue
    if (question[field] !== undefined) projected[field] = question[field]
  }
  if (question.media !== undefined) projected.media = projectMedia(question.media)
  if (question.options !== undefined) {
    if (question.kind === 'matching' && isRecord(question.options)) {
      projected.options = {}
      for (const side of ['left', 'right']) {
        const items = question.options[side]
        projected.options[side] = Array.isArray(items)
          ? items.map((item) => projectItem(item, true))
          : items
      }
    } else {
      projected.options = Array.isArray(question.options)
        ? question.options.map((item) => projectItem(item, question.kind !== 'image-hotspot'))
        : question.options
    }
  }
  const validation = validatePublicQuestion(projected)
  if (!validation.isValid)
    throw validationError('Cannot project public question', validation.errors)
  return projected
}

module.exports = { projectPublicQuestion, validatePublicQuestion }

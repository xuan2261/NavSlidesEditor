const { checkKeys, addError } = require('./question-shape.js')
const { itemIds, inUnit, validateAnswerPayload } = require('./question-answer-payload.js')

function validateRegions(question, errors) {
  const key = question.answerKey
  if (!checkKeys(key, ['regions'], ['answerKey'], errors)) return
  if (!Array.isArray(key.regions) || !key.regions.length) {
    addError(
      errors,
      ['answerKey', 'regions'],
      'Provide at least one correct bounded hotspot region.'
    )
    return
  }
  const known = itemIds(question.options)
  const seen = new Set()
  for (const [index, region] of key.regions.entries()) {
    const path = ['answerKey', 'regions', index]
    const fields =
      region?.shape === 'rect'
        ? ['id', 'shape', 'x', 'y', 'width', 'height']
        : ['id', 'shape', 'cx', 'cy', 'r']
    if (!checkKeys(region, fields, path, errors)) continue
    if (!known.includes(region.id))
      addError(
        errors,
        [...path, 'id'],
        'Correct region must reference an existing candidate option ID.'
      )
    if (seen.has(region.id)) addError(errors, [...path, 'id'], 'Correct region IDs must be unique.')
    seen.add(region.id)
    if (region.shape === 'rect') {
      for (const field of ['x', 'y', 'width', 'height']) {
        if (
          !inUnit(region[field]) ||
          (['width', 'height'].includes(field) && region[field] === 0)
        ) {
          addError(
            errors,
            [...path, field],
            'Rectangle coordinates must be in 0..1 and dimensions positive.'
          )
        }
      }
      if (region.x + region.width > 1 || region.y + region.height > 1)
        addError(errors, path, 'The entire rectangle must fit inside the image.')
    } else if (region.shape === 'circle') {
      for (const field of ['cx', 'cy', 'r']) {
        if (!inUnit(region[field]) || (field === 'r' && region.r === 0))
          addError(
            errors,
            [...path, field],
            'Circle coordinates must be in 0..1 and radius positive.'
          )
      }
      if (
        region.cx - region.r < 0 ||
        region.cy - region.r < 0 ||
        region.cx + region.r > 1 ||
        region.cy + region.r > 1
      ) {
        addError(errors, path, 'The entire circle must fit inside the image.')
      }
    } else addError(errors, [...path, 'shape'], 'Use a rect or circle hotspot shape.')
  }
}

function validateAnswerKey(question, errors) {
  if (question.kind === 'image-hotspot') validateRegions(question, errors)
  else validateAnswerPayload(question, question.answerKey, ['answerKey'], errors, true)
  if (
    ['single-choice', 'multi-choice'].includes(question.kind) &&
    Array.isArray(question.options)
  ) {
    const selected =
      question.kind === 'single-choice'
        ? [question.answerKey?.optionId]
        : question.answerKey?.optionIds
    question.options.forEach((option, index) => {
      if (
        Array.isArray(selected) &&
        selected.includes(option?.id) &&
        (typeof option?.text !== 'string' || !option.text.trim()) &&
        !option?.media
      ) {
        addError(
          errors,
          ['options', index, 'text'],
          'Provide text or an image for the selected correct option.'
        )
      }
    })
  }
}

module.exports = { validateAnswerKey }

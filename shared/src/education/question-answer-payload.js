const { checkKeys, addError, isId } = require('./question-shape.js')

const itemIds = (items) => (Array.isArray(items) ? items.map((item) => item?.id) : [])
const inUnit = (value) => Number.isFinite(value) && value >= 0 && value <= 1

function validateIdList(value, known, path, errors, complete = false, nonempty = false) {
  if (!Array.isArray(value)) {
    addError(errors, path, 'Provide an array of stable item IDs.')
    return
  }
  if (nonempty && value.length === 0) addError(errors, path, 'Select at least one correct item.')
  const seen = new Set()
  for (const id of value) {
    if (!isId(id) || !known.includes(id))
      addError(errors, path, `Unknown item ID "${String(id)}"; select an existing item.`)
    else if (seen.has(id))
      addError(errors, path, `Duplicate item ID "${id}"; use each ID only once.`)
    seen.add(id)
  }
  if (complete && (value.length !== known.length || known.some((id) => !seen.has(id)))) {
    addError(errors, path, 'Include every item exactly once.')
  }
}

function validatePairs(question, pairs, path, errors) {
  if (!Array.isArray(pairs)) {
    addError(errors, path, 'Provide a complete one-to-one array of matching pairs.')
    return
  }
  const left = [],
    right = []
  pairs.forEach((pair, index) => {
    if (!checkKeys(pair, ['leftId', 'rightId'], [...path, index], errors)) return
    left.push(pair.leftId)
    right.push(pair.rightId)
  })
  validateIdList(left, itemIds(question.options?.left), path, errors, true)
  validateIdList(right, itemIds(question.options?.right), path, errors, true)
}

function validateAnswerPayload(question, payload, path, errors, privateKey = false) {
  const known = itemIds(question.options)
  switch (question.kind) {
    case 'single-choice':
      if (
        checkKeys(payload, ['optionId'], path, errors) &&
        (!isId(payload.optionId) || !known.includes(payload.optionId))
      ) {
        addError(errors, [...path, 'optionId'], 'Select an existing option ID.')
      }
      break
    case 'multi-choice':
      if (checkKeys(payload, ['optionIds'], path, errors))
        validateIdList(payload.optionIds, known, [...path, 'optionIds'], errors, false, privateKey)
      break
    case 'true-false':
      if (checkKeys(payload, ['value'], path, errors) && typeof payload.value !== 'boolean')
        addError(errors, [...path, 'value'], 'Provide a boolean value.')
      break
    case 'fill-blank':
      if (privateKey) {
        if (!checkKeys(payload, ['accepted', 'caseSensitive'], path, errors)) break
        let validAccepted = Array.isArray(payload.accepted) && payload.accepted.length > 0
        if (validAccepted) {
          for (const text of payload.accepted)
            if (typeof text !== 'string' || !text.trim()) validAccepted = false
        }
        if (!validAccepted) {
          addError(
            errors,
            [...path, 'accepted'],
            'Provide at least one nonempty accepted answer string.'
          )
        }
        if (typeof payload.caseSensitive !== 'boolean')
          addError(errors, [...path, 'caseSensitive'], 'Choose a boolean case-sensitivity policy.')
      } else if (checkKeys(payload, ['text'], path, errors) && typeof payload.text !== 'string')
        addError(errors, [...path, 'text'], 'Provide answer text as a string.')
      break
    case 'ordering':
      if (checkKeys(payload, ['itemIds'], path, errors))
        validateIdList(payload.itemIds, known, [...path, 'itemIds'], errors, true)
      break
    case 'matching':
      if (checkKeys(payload, ['pairs'], path, errors))
        validatePairs(question, payload.pairs, [...path, 'pairs'], errors)
      break
    case 'image-hotspot':
      if (privateKey) break
      if (payload?.mode === 'point') {
        if (!checkKeys(payload, ['mode', 'x', 'y'], path, errors)) break
        for (const axis of ['x', 'y'])
          if (!inUnit(payload[axis]))
            addError(errors, [...path, axis], 'Point coordinates must be finite numbers in 0..1.')
      } else if (payload?.mode === 'region') {
        if (
          checkKeys(payload, ['mode', 'regionId'], path, errors) &&
          !known.includes(payload.regionId)
        ) {
          addError(errors, [...path, 'regionId'], 'Select an existing candidate region ID.')
        }
      } else
        addError(
          errors,
          [...path, 'mode'],
          'Use mode "point" with x/y or mode "region" with regionId.'
        )
      break
    default:
      addError(errors, path, 'Unsupported question kind.')
  }
}

module.exports = { itemIds, inUnit, validateAnswerPayload }

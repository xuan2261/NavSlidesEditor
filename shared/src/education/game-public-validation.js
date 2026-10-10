const { createValidation } = require('./game-validation-utils.js')
const { isGameSubtype } = require('./game-registry.js')
const { validateFields } = require('./game-field-rules.js')
const { validatePicker } = require('./game-content-validation.js')
const { validateTeams, validateTrivia } = require('./game-question-validation.js')
const { validatePublicQuestion } = require('./question-public-projection.js')
const {
  PUBLIC_DISPLAY_FIELDS,
  PUBLIC_COLLECTION_FIELDS,
  checkPublicFields,
  validatePublicMedia,
  validatePublicContent,
} = require('./game-public-shape.js')

function rows(value, path, fields, v, min = 0, max = 1000) {
  const result = v.list(value, path, min, max)
  v.unique(result, path)
  result.forEach((row, index) => checkPublicFields(row, fields, [...path, index], v))
  return result
}
function questions(value, path, v, minimum = 0) {
  const list = v.list(value, path, minimum, 1000),
    ids = v.unique(list, path)
  list.forEach((question, index) =>
    validatePublicQuestion(question).errors.forEach((error) =>
      v.add([...path, index, ...error.path], error.message)
    )
  )
  return ids
}
function validatePublicGameConfig(type, config) {
  const v = createValidation(),
    result = () => ({ isValid: v.errors.length === 0, errors: v.errors })
  if (!isGameSubtype(type)) {
    v.add(['gameType'], `Unknown game subtype: ${String(type)}`)
    return result()
  }
  if (
    !checkPublicFields(
      config,
      [...PUBLIC_DISPLAY_FIELDS[type], ...PUBLIC_COLLECTION_FIELDS[type]],
      [],
      v
    )
  )
    return result()
  validateFields(type, config, v)
  let questionIds = new Set()
  if (['hot-potato', 'four-corners', 'relay-race', 'trivia-champ', 'quiz'].includes(type)) {
    questionIds = questions(config.questions, ['questions'], v, type === 'quiz' ? 1 : 0)
    const authoredQuestions = Array.isArray(config.questions) ? config.questions : []
    if (type === 'hot-potato')
      authoredQuestions.forEach((question, i) =>
        v.number(question?.points, ['questions', i, 'points'], 1, 1000, true)
      )
    if (type === 'four-corners')
      authoredQuestions.forEach((question, i) => {
        if (question?.kind !== 'single-choice')
          v.add(['questions', i, 'kind'], 'Four Corners needs single-choice questions')
        if (question?.options?.length !== config.cornerCount)
          v.add(['questions', i, 'options'], 'Options must match cornerCount')
      })
  }
  if (['jeopardy', 'relay-race', 'trivia-champ', 'scattergories', 'scoreboard'].includes(type)) {
    rows(
      config.teams,
      ['teams'],
      type === 'scoreboard'
        ? ['id', 'name', 'color', 'initialScore', 'variableId']
        : ['id', 'name', 'color'],
      v,
      type === 'scoreboard' ? 1 : 0,
      100
    )
    validateTeams(config.teams, v, type === 'scoreboard', config)
  }
  if (type === 'trivia-champ') {
    rows(config.rounds, ['rounds'], ['id', 'name', 'mode', 'questionIds', 'timeLimit'], v, 0, 100)
    checkPublicFields(config.lightningRound, ['enabled', 'timePerQ'], ['lightningRound'], v)
    checkPublicFields(config.jackpotRound, ['enabled', 'multiplier'], ['jackpotRound'], v)
    validateTrivia(config, v, questionIds)
  }
  if (type === 'jeopardy') {
    const cells = new Set()
    rows(config.categories, ['categories'], ['id', 'title', 'questions'], v, 0, 100).forEach(
      (category, i) => {
        if (!category || typeof category !== 'object') return
        v.text(category.title, ['categories', i, 'title'])
        questions(category.questions, ['categories', i, 'questions'], v)
        const points = new Set()
        ;(Array.isArray(category.questions) ? category.questions : []).forEach((question, j) => {
          const path = ['categories', i, 'questions', j]
          if (cells.has(question?.id)) v.add([...path, 'id'], 'Duplicate cell ID')
          if (points.has(question?.points)) v.add([...path, 'points'], 'Duplicate point value')
          v.number(question?.points, [...path, 'points'], 1, 1e9, true)
          cells.add(question?.id)
          points.add(question?.points)
        })
      }
    )
  }
  if (['name-picker', 'lucky-wheel'].includes(type)) {
    rows(config.items, ['items'], ['id', 'label', 'weight'], v, 1, 1000)
    validatePicker(config, v, type === 'lucky-wheel')
  }
  if (type === 'poll' || type === 'sorting') {
    rows(
      config[type === 'poll' ? 'options' : 'items'],
      [type === 'poll' ? 'options' : 'items'],
      ['id', 'text', 'media'],
      v,
      type === 'poll' ? 2 : 1,
      type === 'poll' ? 6 : 1000
    ).forEach((item, i) => {
      const path = [type === 'poll' ? 'options' : 'items', i]
      v.text(item?.text, [...path, 'text'])
      if (item?.media !== undefined) validatePublicMedia(item.media, [...path, 'media'], v)
    })
  }
  if (type === 'scattergories' || type === 'sorting') {
    const key = type === 'sorting' ? 'buckets' : 'categories'
    rows(config[key], [key], ['id', 'label'], v, type === 'sorting' ? 2 : 1, 100).forEach(
      (item, i) => v.text(item?.label, [key, i, 'label'])
    )
  }
  if (['memory', 'flashcards'].includes(type))
    rows(
      config.cards,
      ['cards'],
      ['id', 'front'],
      v,
      type === 'memory' ? 2 : 1,
      type === 'memory' ? 24 : 100
    ).forEach((card, i) => validatePublicContent(card?.front, ['cards', i, 'front'], v))
  if (type === 'crossword')
    rows(
      config.entries,
      ['entries'],
      ['id', 'clue', 'row', 'column', 'direction'],
      v,
      1,
      100
    ).forEach((entry, i) => {
      const path = ['entries', i]
      v.text(entry?.clue, [...path, 'clue'])
      v.number(entry?.row, [...path, 'row'], 0, config.rows - 1, true)
      v.number(entry?.column, [...path, 'column'], 0, config.columns - 1, true)
      v.choice(entry?.direction, [...path, 'direction'], ['across', 'down'])
    })
  if (type === 'word-search') {
    rows(config.words, ['words'], ['id', 'text'], v, 1, 100).forEach((word, i) =>
      v.text(word?.text, ['words', i, 'text'])
    )
    v.text(config.alphabet, ['alphabet'])
    v.list(config.directions, ['directions'], 1, 8).forEach((direction, i) =>
      v.choice(direction, ['directions', i], ['E', 'W', 'N', 'S', 'NE', 'NW', 'SE', 'SW'])
    )
  }
  if (type === 'scoreboard' && config.maxScore < config.minScore)
    v.add(['maxScore'], 'maxScore must be at least minScore')
  return result()
}
module.exports = { validatePublicGameConfig }

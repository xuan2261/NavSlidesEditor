const { validateCanonicalQuestion } = require('./question-schema.js')
const { isColor } = require('./game-validation-utils.js')
function validateQuestions(value, path, v, minimum = 0) {
  const rows = v.list(value, path, minimum, 1000)
  const ids = v.unique(rows, path)
  rows.forEach((question, i) => {
    const result = validateCanonicalQuestion(question)
    result.errors.forEach((error) => v.add([...path, i, ...error.path], error.message))
  })
  return ids
}
function validateTeams(value, v, scoreboard = false, config = {}) {
  const rows = v.list(value, ['teams'], scoreboard ? 1 : 0, 100)
  v.unique(rows, ['teams'])
  rows.forEach((team, i) => {
    if (!team || typeof team !== 'object') return
    v.text(team.name, ['teams', i, 'name'])
    if (!isColor(team.color)) v.add(['teams', i, 'color'], 'Use a hex color such as #2196F3')
    if (!scoreboard) return
    if (team.variableId !== undefined) {
      v.text(team.variableId, ['teams', i, 'variableId'], false, 256)
      if (team.initialScore !== undefined)
        v.add(
          ['teams', i, 'initialScore'],
          'A bound team uses the deck variable initial value; remove initialScore'
        )
    } else
      v.number(team.initialScore, ['teams', i, 'initialScore'], config.minScore, config.maxScore)
  })
}
function validateJeopardy(config, v) {
  const categories = v.list(config.categories, ['categories'], 0, 100)
  v.unique(categories, ['categories'])
  const cells = new Set()
  categories.forEach((category, i) => {
    if (!category || typeof category !== 'object') return
    v.text(category.title, ['categories', i, 'title'])
    validateQuestions(category.questions, ['categories', i, 'questions'], v)
    const points = new Set()
    if (!Array.isArray(category.questions)) return
    category.questions.forEach((question, j) => {
      if (!question || typeof question !== 'object') return
      const path = ['categories', i, 'questions', j]
      if (cells.has(question.id))
        v.add([...path, 'id'], 'Duplicate cell ID across categories; assign a unique ID')
      if (points.has(question.points))
        v.add(
          [...path, 'points'],
          'Duplicate point value makes this category ambiguous; choose distinct cell values'
        )
      v.number(question.points, [...path, 'points'], 1, 1e9, true)
      cells.add(question.id)
      points.add(question.points)
    })
  })
  const doubles = v.list(config.dailyDouble, ['dailyDouble'], 0, 1000)
  const seen = new Set()
  doubles.forEach((id, i) => {
    if (typeof id !== 'string' || !cells.has(id))
      v.add(
        ['dailyDouble', i],
        'Unknown daily-double cell ID; restore the cell or remove this reference'
      )
    if (seen.has(id)) v.add(['dailyDouble', i], 'Duplicate daily-double cell reference')
    seen.add(id)
  })
  if (config.questions !== undefined)
    v.add(
      ['questions'],
      'Jeopardy cells belong only in categories[].questions; remove the obsolete parallel board'
    )
}
function validateTrivia(config, v, questionIds) {
  const rounds = v.list(config.rounds, ['rounds'], 0, 100)
  v.unique(rounds, ['rounds'])
  rounds.forEach((round, i) => {
    if (!round || typeof round !== 'object') return
    const path = ['rounds', i]
    v.text(round.name, [...path, 'name'])
    v.choice(round.mode, [...path, 'mode'], ['individual', 'team', 'buzzer'])
    v.number(round.timeLimit, [...path, 'timeLimit'], 1, 86400, true)
    const seen = new Set()
    v.list(round.questionIds, [...path, 'questionIds']).forEach((id, j) => {
      if (!questionIds.has(id))
        v.add(
          [...path, 'questionIds', j],
          'Unknown question ID; restore the question or remove this reference'
        )
      if (seen.has(id))
        v.add([...path, 'questionIds', j], 'Duplicate question reference within round')
      seen.add(id)
    })
    if (round.questions !== undefined)
      v.add([...path, 'questions'], 'Use questionIds referencing the canonical question list')
  })
  for (const [key, field, min, max] of [
    ['lightningRound', 'timePerQ', 1, 86400],
    ['jackpotRound', 'multiplier', 1, 1000],
  ]) {
    if (!v.object(config[key], [key])) continue
    v.boolean(config[key].enabled, [key, 'enabled'])
    v.number(config[key][field], [key, field], min, max, key === 'lightningRound')
  }
}
module.exports = { validateQuestions, validateTeams, validateJeopardy, validateTrivia }

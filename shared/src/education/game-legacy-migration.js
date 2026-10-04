const { normalizeLegacyQuestion } = require('./question-schema.js')
const { isObject, throwInvalid } = require('./game-validation-utils.js')
const COLORS = ['#2196F3', '#FF5722', '#4CAF50', '#FFC107', '#9C27B0', '#00BCD4']
function fail(path, message) {
  throwInvalid([{ path, message }], 'Legacy game migration')
}
function array(value, path) {
  if (!Array.isArray(value))
    fail(path, 'Expected an array; correct the authored data rather than discarding it')
  return value
}
function row(value, path, legacyField) {
  if (typeof value === 'string' && legacyField) return { [legacyField]: value }
  if (!isObject(value)) fail(path, 'Expected an authored object')
  return { ...value }
}
function identified(value, path, context, legacyField) {
  const result = row(value, path, legacyField)
  if (result.id === undefined) result.id = context
  return result
}
function question(value, context, path) {
  // Canonical drafts are preserved for form validation; strict admission validates later.
  if (isObject(value) && Object.prototype.hasOwnProperty.call(value, 'kind')) return value
  try {
    return normalizeLegacyQuestion(value, context)
  } catch (error) {
    const errors = Array.isArray(error.errors)
      ? error.errors.map((item) => ({ ...item, path: [...path, ...item.path] }))
      : [{ path, message: error.message }]
    throwInvalid(errors, 'Question migration')
  }
}
function questions(value, context, path) {
  return array(value, path).map((q, i) => question(q, `${context}-${i + 1}`, [...path, i]))
}
function migrateBoard(config, type) {
  const obsolete = config.questions
  if (obsolete !== undefined && (!isObject(obsolete) || Object.keys(obsolete).length))
    fail(
      ['questions'],
      'Move authored Jeopardy cells into categories[].questions before migration; parallel boards are ambiguous'
    )
  delete config.questions
  const legacyBoard =
    obsolete !== undefined ||
    (Array.isArray(config.categories) &&
      config.categories.some(
        (category) =>
          !isObject(category) ||
          category.id === undefined ||
          (Array.isArray(category.questions) &&
            category.questions.some(
              (q) => !isObject(q) || !Object.prototype.hasOwnProperty.call(q, 'kind')
            ))
      ))
  config.categories = array(config.categories, ['categories']).map((value, i) => {
    const path = ['categories', i]
    const category = identified(value, path, `${type}-categories-${i + 1}`, 'title')
    if (category.title === undefined && category.name !== undefined) category.title = category.name
    delete category.name
    category.questions = questions(
      category.questions === undefined ? [] : category.questions,
      `${category.id}-questions`,
      [...path, 'questions']
    )
    return category
  })
  const cellIds = new Set(
    config.categories.flatMap((category) => category.questions.map((q) => q.id))
  )
  config.dailyDouble = array(config.dailyDouble, ['dailyDouble']).map((id, i) => {
    if (cellIds.has(id) || !legacyBoard) return id
    const match = typeof id === 'string' && /^(\d+)-(\d+)$/.exec(id)
    if (!match) return id // Canonical unknown references are rejected by the schema, never repaired.
    const category = config.categories[Number(match[1])]
    const candidates = category?.questions.filter((q) => q.points === Number(match[2])) || []
    if (candidates.length !== 1)
      fail(
        ['dailyDouble', i],
        `Legacy cell ${id} resolves to ${candidates.length} questions; correct the category/point reference and duplicate or missing cells`
      )
    return candidates[0].id
  })
}
function migrateTrivia(config, type) {
  config.rounds = array(config.rounds, ['rounds']).map((value, i) => {
    const path = ['rounds', i]
    const round = identified(value, path, `${type}-rounds-${i + 1}`, 'name')
    if (round.mode === undefined) round.mode = 'individual'
    if (round.timeLimit === undefined) round.timeLimit = 30
    if (round.questions !== undefined) {
      if (round.questionIds !== undefined)
        fail(
          [...path, 'questionIds'],
          'Choose one source: legacy embedded questions or canonical questionIds, not both'
        )
      const migrated = questions(round.questions, `${round.id}-questions`, [...path, 'questions'])
      config.questions.push(...migrated)
      round.questionIds = migrated.map((q) => q.id)
      delete round.questions
    }
    if (round.questionIds === undefined) round.questionIds = []
    return round
  })
}
function migrateCollections(config, type) {
  if (config.teams !== undefined)
    config.teams = array(config.teams, ['teams']).map((value, i) => {
      const team = identified(value, ['teams', i], `${type}-teams-${i + 1}`, 'name')
      if (team.color === undefined) team.color = COLORS[i % COLORS.length]
      delete team.score
      if (type === 'scoreboard' && team.variableId === undefined && team.initialScore === undefined)
        team.initialScore = 0
      return team
    })
  if (['hot-potato', 'four-corners', 'relay-race', 'trivia-champ', 'quiz'].includes(type))
    config.questions = questions(config.questions, `${type}-questions`, ['questions'])
  if (type === 'jeopardy') migrateBoard(config, type)
  if (type === 'trivia-champ') migrateTrivia(config, type)
  if (type === 'scattergories')
    config.categories = array(config.categories, ['categories']).map((value, i) => {
      const category = identified(value, ['categories', i], `${type}-categories-${i + 1}`, 'label')
      if (category.label === undefined && category.name !== undefined)
        category.label = category.name
      delete category.name
      return category
    })
  if (['name-picker', 'lucky-wheel'].includes(type))
    config.items = array(config.items, ['items']).map((value, i) => {
      const item = identified(value, ['items', i], `${type}-items-${i + 1}`, 'label')
      if (item.weight === undefined) item.weight = 1
      return item
    })
  if (type === 'poll')
    config.options = array(config.options, ['options']).map((value, i) => {
      const option = identified(value, ['options', i], `${type}-options-${i + 1}`, 'text')
      if (option.text === undefined && option.label !== undefined) option.text = option.label
      delete option.label
      return option
    })
  if (type === 'matching')
    config.pairs = array(config.pairs, ['pairs']).map((value, i) => {
      const pair = row(value, ['pairs', i])
      const context = `${type}-pairs-${i + 1}`
      if (pair.promptId === undefined) pair.promptId = `${context}-prompt`
      if (pair.targetId === undefined) pair.targetId = `${context}-target`
      if (pair.prompt === undefined && pair.term !== undefined) pair.prompt = pair.term
      if (pair.target === undefined && pair.answer !== undefined) pair.target = pair.answer
      delete pair.term
      delete pair.answer
      return pair
    })
  for (const key of type === 'memory'
    ? ['pairs']
    : type === 'flashcards'
      ? ['cards']
      : type === 'sorting'
        ? ['buckets', 'items']
        : type === 'crossword'
          ? ['entries']
          : type === 'word-search'
            ? ['words']
            : []) {
    const field =
      key === 'words' || key === 'items' ? 'text' : key === 'buckets' ? 'label' : undefined
    config[key] = array(config[key], [key]).map((value, i) =>
      identified(value, [key, i], `${type}-${key}-${i + 1}`, field)
    )
  }
  return config
}
module.exports = { migrateCollections }

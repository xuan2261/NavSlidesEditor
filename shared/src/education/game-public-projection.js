const { isGameSubtype } = require('./game-registry.js')
const { isObject, throwInvalid } = require('./game-validation-utils.js')
const { projectPublicQuestion } = require('./question-public-projection.js')
const { validatePublicGameConfig } = require('./game-public-validation.js')
const { PUBLIC_DISPLAY_FIELDS, copyPublicFields } = require('./game-public-shape.js')
const displayContent = (value) =>
  copyPublicFields(value, value?.type === 'text' ? ['type', 'text'] : ['type', 'src', 'alt'])
const projectRows = (value, project) => (Array.isArray(value) ? value.map(project) : value)
const mediaItem = (value) => ({
  ...copyPublicFields(value, ['id', 'text']),
  ...(value?.media !== undefined ? { media: copyPublicFields(value.media, ['src', 'alt']) } : {}),
})
function projectPublicGameConfig(type, config) {
  if (!isGameSubtype(type))
    throwInvalid([{ path: ['gameType'], message: `Unknown game subtype: ${String(type)}` }])
  if (!isObject(config))
    throwInvalid([{ path: [], message: 'Expected a game configuration object' }])
  const output = copyPublicFields(config, PUBLIC_DISPLAY_FIELDS[type])
  if (
    config.questions !== undefined &&
    ['hot-potato', 'four-corners', 'relay-race', 'trivia-champ', 'quiz'].includes(type)
  )
    output.questions = projectRows(config.questions, projectPublicQuestion)
  if (['jeopardy', 'relay-race', 'trivia-champ', 'scattergories', 'scoreboard'].includes(type))
    output.teams = projectRows(config.teams, (team) =>
      copyPublicFields(
        team,
        type === 'scoreboard'
          ? ['id', 'name', 'color', 'initialScore', 'variableId']
          : ['id', 'name', 'color']
      )
    )
  if (type === 'jeopardy')
    output.categories = projectRows(config.categories, (category) => ({
      ...copyPublicFields(category, ['id', 'title']),
      questions: projectRows(category?.questions, projectPublicQuestion),
    }))
  if (type === 'trivia-champ') {
    output.rounds = projectRows(config.rounds, (round) =>
      copyPublicFields(round, ['id', 'name', 'mode', 'questionIds', 'timeLimit'])
    )
    output.lightningRound = copyPublicFields(config.lightningRound, ['enabled', 'timePerQ'])
    output.jackpotRound = copyPublicFields(config.jackpotRound, ['enabled', 'multiplier'])
  }
  if (['name-picker', 'lucky-wheel'].includes(type))
    output.items = projectRows(config.items, (item) =>
      copyPublicFields(item, ['id', 'label', 'weight'])
    )
  if (type === 'scattergories')
    output.categories = projectRows(config.categories, (category) =>
      copyPublicFields(category, ['id', 'label'])
    )
  if (type === 'poll') output.options = projectRows(config.options, mediaItem)
  if (type === 'memory')
    output.cards = projectRows(config.pairs, (pair) => ({
      id: pair?.id,
      front: displayContent(pair?.first),
    }))
  if (type === 'flashcards')
    output.cards = projectRows(config.cards, (card) => ({
      id: card?.id,
      front: displayContent(card?.front),
    }))
  if (type === 'sorting') {
    output.buckets = projectRows(config.buckets, (bucket) =>
      copyPublicFields(bucket, ['id', 'label'])
    )
    output.items = projectRows(config.items, mediaItem)
  }
  if (type === 'crossword')
    output.entries = projectRows(config.entries, (entry) =>
      copyPublicFields(entry, ['id', 'clue', 'row', 'column', 'direction'])
    )
  if (type === 'word-search')
    output.words = projectRows(config.words, (word) => copyPublicFields(word, ['id', 'text']))
  throwInvalid(validatePublicGameConfig(type, output).errors, 'Public game configuration')
  return output
}
module.exports = { projectPublicGameConfig, validatePublicGameConfig }

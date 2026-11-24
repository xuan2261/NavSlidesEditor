const { validateGameConfig } = require('../game-schema.js')
const { throwInvalid } = require('../game-validation-utils.js')

const normalize = (text) => text.trim().normalize('NFC').toLowerCase().normalize('NFC')
function scoreAnswers(config, answers, letter, validity) {
  const scores = Object.fromEntries(config.teams.map((team) => [team.id, 0])),
    results = {}
  for (const category of config.categories) {
    const entries = config.teams.map((team) => ({
      id: team.id,
      answer: normalize(answers[category.id]?.[team.id] ?? ''),
    }))
    const counts = new Map()
    for (const entry of entries)
      if (entry.answer) counts.set(entry.answer, (counts.get(entry.answer) ?? 0) + 1)
    results[category.id] = {}
    for (const entry of entries) {
      const eligible =
        entry.answer &&
        entry.answer.startsWith(normalize(letter)) &&
        validity[category.id]?.[entry.id] !== false
      const points =
        eligible && (config.scoring === 'all' || counts.get(entry.answer) === 1) ? 10 : 0
      results[category.id][entry.id] = points
      scores[entry.id] += points
    }
  }
  return { scores, results }
}
function createScattergoriesState(config) {
  throwInvalid(validateGameConfig('scattergories', config).errors, 'scattergories configuration')
  const error = !config.teams.length
    ? 'No teams available.'
    : !config.categories.length
      ? 'No categories available.'
      : null
  return {
    phase: error ? 'no-play' : 'setup',
    error,
    round: 1,
    letter: null,
    answers: {},
    validity: {},
    results: {},
    scores: Object.fromEntries(config.teams.map((team) => [team.id, 0])),
    deadline: null,
    winnerId: null,
  }
}
function review(config, state) {
  const { scores, results } = scoreAnswers(config, state.answers, state.letter, state.validity)
  const winner = config.teams.reduce(
    (best, team) => (!best || scores[team.id] > scores[best.id] ? team : best),
    null
  )
  return { ...state, phase: 'review', scores, results, winnerId: winner?.id ?? null, error: null }
}
function reduceScattergories(config, state, command, { now = () => 0, random = Math.random } = {}) {
  if (
    !command ||
    command.generation !== state.generation ||
    command.round !== state.round ||
    state.phase === 'no-play'
  )
    return state
  const time = now()
  if (command.type === 'new-round') {
    if (state.phase !== 'review') return state
    return {
      ...createScattergoriesState(config),
      generation: state.generation,
      round: state.round + 1,
    }
  }
  if (command.type === 'adjudicate') {
    const { categoryId, teamId, valid } = command
    if (
      state.phase !== 'review' ||
      typeof valid !== 'boolean' ||
      !config.categories.some((category) => category.id === categoryId) ||
      !config.teams.some((team) => team.id === teamId)
    )
      return state
    if (state.validity[categoryId]?.[teamId] === valid) return state
    return review(config, {
      ...state,
      validity: {
        ...state.validity,
        [categoryId]: { ...state.validity[categoryId], [teamId]: valid },
      },
    })
  }
  if (command.type === 'start') {
    if (state.phase !== 'setup') return state
    const chosen =
      config.letterMode === 'random'
        ? String.fromCharCode(65 + Math.min(25, Math.max(0, Math.floor(random() * 26))))
        : typeof (command.letter ?? config.letter) === 'string'
          ? (command.letter ?? config.letter).trim().normalize('NFC')
          : ''
    if (!/^\p{L}$/u.test(chosen)) return { ...state, error: 'Choose one Unicode letter.' }
    const uppercase = chosen.toUpperCase(),
      letter = /^\p{L}$/u.test(uppercase) ? uppercase : chosen
    return {
      ...state,
      phase: 'playing',
      letter,
      deadline: time + config.timePerRound * 1000,
      error: null,
    }
  }
  if (state.phase !== 'playing') return state
  if (command.type === 'deadline') return time >= state.deadline ? review(config, state) : state
  if (command.type === 'review') return review(config, state)
  if (command.type !== 'answer') return state
  if (time >= state.deadline) return review(config, state)
  if (
    typeof command.text !== 'string' ||
    !config.teams.some((team) => team.id === command.teamId) ||
    !config.categories.some((category) => category.id === command.categoryId)
  )
    return state
  return {
    ...state,
    answers: {
      ...state.answers,
      [command.categoryId]: {
        ...state.answers[command.categoryId],
        [command.teamId]: command.text,
      },
    },
    error: null,
  }
}
module.exports = { createScattergoriesState, reduceScattergories }

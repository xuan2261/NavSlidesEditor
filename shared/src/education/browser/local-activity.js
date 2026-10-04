const { createNamePickerState, reduceNamePicker } = require('../games/name-picker.js')
const { createHotPotatoState, reduceHotPotato } = require('../games/hot-potato.js')
const { createJeopardyState, reduceJeopardy } = require('../games/jeopardy.js')
const { createFourCornersState, reduceFourCorners } = require('../games/four-corners.js')
const { createRelayRaceState, reduceRelayRace } = require('../games/relay-race.js')
const { createTriviaChampState, reduceTriviaChamp } = require('../games/trivia-champ.js')
const { createScattergoriesState, reduceScattergories } = require('../games/scattergories.js')
const { createPollState, reducePoll } = require('../games/poll.js')
const { createWordCloudState, reduceWordCloud } = require('../games/word-cloud.js')
const { createMatchingState, reduceMatching } = require('../games/matching.js')
const { createSortingState, reduceSorting } = require('../games/sorting.js')
const { createLuckyWheelState, reduceLuckyWheel } = require('../lucky-wheel-state.js')
const { createCountdownState, reduceCountdown } = require('../countdown-state.js')
const { createScoreboardState, reduceScoreboard } = require('../scoreboard-state.js')
const { createQuizSession, reduceQuizSession } = require('../quiz-session.js')
const { createMemoryState, memoryReducer } = require('../memory-state.js')
const { createFlashcardsState, flashcardsReducer } = require('../flashcards-state.js')
const {
  validateCrosswordLayout,
  createCrosswordState,
  reduceCrossword,
} = require('../crossword-layout.js')
const { generateWordSearch } = require('../word-search-generator.js')
const { createWordSearchState, reduceWordSearch } = require('../word-search-selection.js')
const presenters = {
  'name-picker': require('./games/name-picker.js').presentNamePicker,
  'hot-potato': require('./games/hot-potato.js').presentHotPotato,
  jeopardy: require('./games/jeopardy.js').presentJeopardy,
  'four-corners': require('./games/four-corners.js').presentFourCorners,
  'relay-race': require('./games/relay-race.js').presentRelayRace,
  'trivia-champ': require('./games/trivia-champ.js').presentTriviaChamp,
  scattergories: require('./games/scattergories.js').presentScattergories,
  poll: require('./games/poll.js').presentPoll,
  'word-cloud': require('./games/word-cloud.js').presentWordCloud,
  matching: require('./games/matching.js').presentMatching,
  sorting: require('./sorting-presenter.js').presentSorting,
  quiz: require('./quiz-presenter.js').presentQuiz,
  'lucky-wheel': require('./lucky-wheel-presenter.js').presentLuckyWheel,
  countdown: require('./countdown-presenter.js').presentCountdown,
  scoreboard: require('./scoreboard-presenter.js').presentScoreboard,
  memory: require('./memory-presenter.js').presentMemory,
  flashcards: require('./flashcards-presenter.js').presentFlashcards,
  crossword: require('./crossword-presenter.js').presentCrossword,
  'word-search': require('./word-search-presenter.js').presentWordSearch,
}
const rules = {
  'name-picker': [createNamePickerState, reduceNamePicker],
  'hot-potato': [createHotPotatoState, reduceHotPotato],
  jeopardy: [createJeopardyState, reduceJeopardy],
  'four-corners': [createFourCornersState, reduceFourCorners],
  'trivia-champ': [createTriviaChampState, reduceTriviaChamp],
  scattergories: [createScattergoriesState, reduceScattergories],
  poll: [createPollState, reducePoll],
  'word-cloud': [createWordCloudState, reduceWordCloud],
  matching: [createMatchingState, reduceMatching],
  sorting: [createSortingState, reduceSorting],
  'lucky-wheel': [createLuckyWheelState, reduceLuckyWheel],
  scoreboard: [createScoreboardState, reduceScoreboard],
}
function createLocalActivity(type, config, { random = Math.random } = {}) {
  const present = presenters[type]
  if (!present) throw new Error(`Unknown local activity: ${type}`)
  if (type === 'relay-race') {
    let orderedConfig = config
    return {
      present,
      initial: () => {
        if (config.shuffleTeams) {
          const teams = [...config.teams]
          for (let i = teams.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1))
            ;[teams[i], teams[j]] = [teams[j], teams[i]]
          }
          orderedConfig = { ...config, teams }
        }
        return createRelayRaceState(orderedConfig)
      },
      reduce: (state, command, clock) =>
        reduceRelayRace(orderedConfig, state, command, { random, now: clock.now }),
    }
  }
  if (rules[type]) {
    const [create, reduce] = rules[type]
    return {
      present,
      initial: () => create(config, { random }),
      reduce: (state, command, clock) => reduce(config, state, command, { random, now: clock.now }),
    }
  }
  if (type === 'countdown')
    return {
      present,
      initial: (clock) => createCountdownState(config, { now: clock.now }),
      reduce: (state, command, clock) =>
        reduceCountdown(config, state, command, { now: clock.now }),
    }
  if (type === 'quiz')
    return {
      present,
      initial: (clock) => createQuizSession(config, { now: clock.now(), random }),
      reduce: (state, command, clock) => reduceQuizSession(state, { ...command, now: clock.now() }),
    }
  if (type === 'memory')
    return {
      present,
      initial: () => createMemoryState(config, { random }),
      reduce: (state, command) => memoryReducer(state, command, config, { random }),
    }
  if (type === 'flashcards')
    return {
      present,
      initial: () => createFlashcardsState(config, { random }),
      reduce: (state, command) => flashcardsReducer(state, command, config, { random }),
    }
  const puzzle = type === 'crossword' ? validateCrosswordLayout(config) : generateWordSearch(config)
  const create = type === 'crossword' ? createCrosswordState : createWordSearchState
  const reduce = type === 'crossword' ? reduceCrossword : reduceWordSearch
  return {
    present: (context) => present({ ...context, puzzle }),
    initial: () => create(puzzle),
    reduce: (state, command) => reduce(puzzle, state, command),
  }
}
module.exports = { createLocalActivity }

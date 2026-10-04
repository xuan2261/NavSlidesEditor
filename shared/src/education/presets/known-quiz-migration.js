const { createDefaultGameConfig, GAME_BASE_DEFAULTS } = require('../game-defaults.js')
const { KNOWN_QUIZ_QUESTIONS } = require('./known-quiz-questions.js')
const sourceManifest = require('./known-quiz-source-manifest.json')
const { exactTargets, assertValidGame } = require('./migration-validation.js')
const KNOWN_QUIZ_IDS = Object.freeze(Object.keys(KNOWN_QUIZ_QUESTIONS))

function migrateKnownQuizTemplates(records, { hashContent } = {}) {
  const targets = exactTargets(records, KNOWN_QUIZ_IDS)
  const replacements = new Map()
  for (const record of targets) {
    const specs = sourceManifest[record.id]
    const expected = KNOWN_QUIZ_QUESTIONS[record.id]
    const next = structuredClone(record)
    specs.forEach((spec, index) => {
      const slides = next.slides.filter((slide) => slide.id === spec.slideId)
      if (slides.length !== 1)
        throw new Error(`${record.id}: missing or ambiguous authored slide ${spec.slideId}.`)
      const slide = slides[0]
      const elements = slide.elements.filter((element) => element.id === spec.elementId)
      if (elements.length !== 1)
        throw new Error(`${record.id}: missing or ambiguous quiz element ${spec.elementId}.`)
      const element = elements[0]
      if (element.type === 'game' && element.gameType === 'quiz') {
        assertValidGame('quiz', element.quiz, `${record.id}/${element.id}`)
        return
      }
      if (
        element.type !== 'html' ||
        typeof element.content !== 'string' ||
        typeof hashContent !== 'function' ||
        hashContent(element.content) !== spec.sha256
      ) {
        throw new Error(
          `${record.id}/${element.id}: source differs from the audited builtin HTML. Restore its checked-in source; arbitrary HTML is not migrated.`
        )
      }
      const gameConfig = {
        ...createDefaultGameConfig('quiz'),
        title: record.titleVi || record.title,
        questions: structuredClone(expected[index]),
        attemptLimit:
          record.id === 'quiz-ordering' ||
          record.id === 'quiz-fill-blank' ||
          record.id === 'quiz-matching'
            ? 10
            : 1,
      }
      assertValidGame('quiz', gameConfig, `${record.id}/${element.id}`)
      const { content: removedContent, ...layout } = element
      void removedContent
      slide.elements[slide.elements.indexOf(element)] = {
        ...GAME_BASE_DEFAULTS,
        ...layout,
        type: 'game',
        gameType: 'quiz',
        quiz: gameConfig,
      }
    })
    replacements.set(record.id, next)
  }
  return records.map((record) => replacements.get(record.id) || record)
}
module.exports = { KNOWN_QUIZ_IDS, migrateKnownQuizTemplates }

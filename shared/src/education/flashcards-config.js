const { createValidation, throwInvalid } = require('./game-validation-utils.js')
const { validateCards } = require('./game-content-validation.js')
const { cloneCardContent } = require('./card-content.js')

function createFlashcardsConfig(input = {}) {
  const config = { title: 'Flashcards', shuffleOnStart: false, ...input }
  const v = createValidation()
  v.text(config.title, ['title'], true)
  v.boolean(config.shuffleOnStart, ['shuffleOnStart'])
  validateCards('flashcards', config, v)
  throwInvalid(v.errors, 'Flashcards configuration')
  return {
    title: config.title,
    shuffleOnStart: config.shuffleOnStart,
    cards: config.cards.map((card) => ({
      id: card.id,
      front: cloneCardContent(card.front),
      back: cloneCardContent(card.back),
    })),
  }
}

module.exports = { createFlashcardsConfig }

const { createDefaultGameConfig } = require('../../src/education/game-defaults.js')
const image = (name) => ({ src: `https://source.example/uploads/${name}.png`, alt: name })
const side = (name) => ({ type: 'image', ...image(name) })
const geometry = { x: 0, y: 0, width: 320, height: 200 }
const game = (gameType, config, id = gameType) => ({
  id,
  type: 'game',
  ...geometry,
  gameType,
  [gameType]: config,
})

function nativeMediaFixture() {
  const quiz = createDefaultGameConfig('quiz')
  quiz.questions[0].media = image('question')
  quiz.questions[0].options[0].media = image('option')
  const matchingQuestion = {
    id: 'question-matching',
    kind: 'matching',
    prompt: 'Match images',
    points: 10,
    timeLimit: null,
    media: image('matching-question'),
    options: {
      left: [{ id: 'left', text: 'Left', media: image('left') }],
      right: [{ id: 'right', text: 'Right', media: image('right') }],
    },
    answerKey: { pairs: [{ leftId: 'left', rightId: 'right' }] },
    feedback: { correct: '', incorrect: '', explanation: '' },
  }
  quiz.questions.push(matchingQuestion)
  const matching = createDefaultGameConfig('matching')
  matching.pairs[0].promptMedia = image('prompt')
  matching.pairs[0].targetMedia = image('target')
  const memory = createDefaultGameConfig('memory')
  memory.pairs[0].first = side('memory-first')
  memory.pairs[0].second = side('memory-second')
  const flashcards = createDefaultGameConfig('flashcards')
  flashcards.cards[0].front = side('front')
  flashcards.cards[0].back = side('back')
  const sorting = createDefaultGameConfig('sorting')
  sorting.items[0].media = image('sorting')
  const poll = createDefaultGameConfig('poll')
  poll.options[0].media = image('poll')
  const jeopardy = createDefaultGameConfig('jeopardy')
  jeopardy.categories[0].questions[0].media = image('jeopardy')
  return {
    id: 'native-source',
    title: 'Native media only',
    theme: 'black',
    slides: [
      {
        id: 'parent',
        elements: [game('quiz', quiz), game('poll', poll), game('jeopardy', jeopardy)],
        layoutId: 'master',
        layoutOverrides: {
          elementPatches: {
            matching: {
              matching: {
                ...matching,
                pairs: matching.pairs.map((pair, i) =>
                  i ? pair : { ...pair, promptMedia: image('patch') }
                ),
              },
            },
          },
        },
        children: [
          {
            id: 'vertical',
            elements: [
              game('memory', memory),
              game('flashcards', flashcards),
              game('sorting', sorting),
            ],
          },
        ],
      },
    ],
    layoutMasters: [
      {
        id: 'master',
        name: 'Native layout',
        fixedElements: [game('matching', matching)],
        placeholders: [
          {
            id: 'placeholder',
            type: 'image',
            role: 'image',
            ...geometry,
            contentPolicy: { elementDefaults: { src: image('placeholder').src } },
          },
        ],
      },
    ],
  }
}

module.exports = { nativeMediaFixture, image, side, game }

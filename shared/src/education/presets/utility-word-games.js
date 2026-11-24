const { gamePreset } = require('./preset-factory.js')
const UTILITY_WORD_GAME_PRESETS = Object.freeze([
  gamePreset('lucky-wheel', 'Vòng quay may mắn', 'utilities', ['wheel', 'prizes']),
  gamePreset('countdown', 'Đồng hồ đếm ngược', 'utilities', ['timer', 'clock'], {
    title: 'Thời gian thảo luận',
    durationSeconds: 60,
    expiryMessage: 'Hết giờ thảo luận!',
  }),
  gamePreset('scoreboard', 'Bảng điểm đội', 'utilities', ['score', 'teams']),
  gamePreset('crossword', 'Ô chữ kiến thức', 'words', ['crossword', 'vocabulary'], {
    title: 'Animals and transport',
    rows: 5,
    columns: 5,
    seed: 15,
    entries: [
      {
        id: 'cross-cat',
        answer: 'CAT',
        clue: 'A small feline',
        row: 0,
        column: 0,
        direction: 'across',
      },
      {
        id: 'cross-car',
        answer: 'CAR',
        clue: 'A road vehicle',
        row: 0,
        column: 0,
        direction: 'down',
      },
    ],
  }),
  gamePreset('word-search', 'Tìm từ trong bảng', 'words', ['search', 'vocabulary'], {
    title: 'Find the animals',
    rows: 8,
    columns: 8,
    seed: 15,
    words: [
      { id: 'search-cat', text: 'CAT' },
      { id: 'search-dog', text: 'DOG' },
      { id: 'search-bird', text: 'BIRD' },
    ],
    directions: ['E', 'S', 'SE'],
  }),
])
module.exports = { UTILITY_WORD_GAME_PRESETS }

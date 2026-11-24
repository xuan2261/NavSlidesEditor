const { gamePreset } = require('./preset-factory.js')
const { createCanonicalQuestion } = require('../question-factory.js')
const { KNOWN_QUIZ_QUESTIONS } = require('./known-quiz-questions.js')
const questions = [
  KNOWN_QUIZ_QUESTIONS['quiz-multiple-choice'][0][0],
  createCanonicalQuestion({
    id: 'example/multi-choice',
    kind: 'multi-choice',
    prompt: 'Chọn các số chẵn.',
    options: [
      { id: 'even-2', text: '2' },
      { id: 'odd-3', text: '3' },
      { id: 'even-4', text: '4' },
    ],
    answerKey: { optionIds: ['even-2', 'even-4'] },
    feedback: {
      correct: 'Chính xác!',
      incorrect: 'Hãy chọn 2 và 4.',
      explanation: 'Số chẵn chia hết cho 2.',
    },
  }),
  KNOWN_QUIZ_QUESTIONS['quiz-true-false'][0][0],
  KNOWN_QUIZ_QUESTIONS['quiz-fill-blank'][0][0],
  KNOWN_QUIZ_QUESTIONS['quiz-ordering'][0][0],
  KNOWN_QUIZ_QUESTIONS['quiz-matching'][0][0],
  createCanonicalQuestion({
    id: 'example/image-hotspot',
    kind: 'image-hotspot',
    prompt: 'Chọn hình vuông màu xanh ở giữa ảnh.',
    feedback: {
      correct: 'Đúng vùng!',
      incorrect: 'Chọn hình vuông ở giữa.',
      explanation: 'Vùng đúng là hình vuông màu xanh ở giữa ảnh.',
    },
  }),
]
const text = (value) => ({ type: 'text', text: value })
const LEARNING_GAME_PRESETS = Object.freeze([
  gamePreset(
    'quiz',
    'Bài kiểm tra bảy dạng câu hỏi',
    'learning',
    ['quiz', 'assessment', 'seven kinds'],
    { title: 'Kiểm tra kiến thức', questions }
  ),
  gamePreset('memory', 'Lật thẻ ghi nhớ', 'learning', ['memory', 'cards'], {
    pairs: [
      { id: 'memory-ohm', first: text('Định luật Ohm'), second: text('U = I × R') },
      { id: 'memory-power', first: text('Công suất điện'), second: text('P = U × I') },
    ],
  }),
  gamePreset('flashcards', 'Thẻ học tập', 'learning', ['flashcards', 'revision'], {
    cards: [
      { id: 'flash-ohm', front: text('Công thức định luật Ohm?'), back: text('U = I × R') },
      { id: 'flash-binary', front: text('10 trong hệ nhị phân?'), back: text('1010') },
    ],
  }),
  gamePreset('sorting', 'Phân loại kiến thức', 'learning', ['sorting', 'buckets']),
])
module.exports = { LEARNING_GAME_PRESETS }

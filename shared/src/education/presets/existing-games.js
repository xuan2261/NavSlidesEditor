const { gamePreset } = require('./preset-factory.js')
const { KNOWN_QUIZ_QUESTIONS } = require('./known-quiz-questions.js')
const ohm = KNOWN_QUIZ_QUESTIONS['quiz-multiple-choice'][0][0]
const languageQuestion = KNOWN_QUIZ_QUESTIONS['quiz-matching'][0][0]
const pairs = languageQuestion.answerKey.pairs.map((pair) => ({
  promptId: pair.leftId,
  prompt: languageQuestion.options.left.find((option) => option.id === pair.leftId).text,
  targetId: pair.rightId,
  target: languageQuestion.options.right.find((option) => option.id === pair.rightId).text,
}))
const EXISTING_GAME_PRESETS = Object.freeze([
  gamePreset('name-picker', 'Chọn tên học sinh', 'classroom', ['names', 'wheel', 'học sinh']),
  gamePreset('hot-potato', 'Khoai tây nóng', 'classroom', ['quiz', 'classroom'], {
    questions: [ohm],
  }),
  gamePreset('jeopardy', 'Bảng câu hỏi Jeopardy', 'classroom', ['teams', 'assessment']),
  gamePreset('four-corners', 'Bốn góc lớp học', 'classroom', ['corners', 'quiz'], {
    questions: [ohm],
  }),
  gamePreset('relay-race', 'Đua tiếp sức', 'classroom', ['teams', 'quiz'], {
    questions: [ohm],
    questionsPerRound: 1,
  }),
  gamePreset('trivia-champ', 'Nhà vô địch kiến thức', 'classroom', ['teams', 'trivia']),
  gamePreset('scattergories', 'Từ vựng theo chủ đề', 'words', ['vocabulary', 'categories']),
  gamePreset('poll', 'Bình chọn trực tiếp', 'classroom', ['poll', 'vote'], {
    prompt: 'Bạn muốn ôn lại chủ đề nào?',
    options: [
      { id: 'poll-ohm', text: 'Định luật Ohm' },
      { id: 'poll-binary', text: 'Hệ nhị phân' },
    ],
  }),
  gamePreset('word-cloud', 'Đám mây từ', 'words', ['cloud', 'brainstorm'], {
    prompt: 'Một từ mô tả bài học hôm nay?',
  }),
  gamePreset('matching', 'Nối cặp kiến thức', 'learning', ['pairs', 'languages'], {
    prompt: languageQuestion.prompt,
    pairs,
  }),
])
module.exports = { EXISTING_GAME_PRESETS }

const { projectPublicQuestion } = require('./question-public-projection.js')
const { cloneValue } = require('./question-shape.js')

function projectQuizQuestion(question, session) {
  const projected = { question: projectPublicQuestion(question) }
  if (!session) return projected
  const index = session.questionIds.indexOf(question.id)
  const terminal =
    index >= 0 &&
    (index < session.questionIndex ||
      (index === session.questionIndex && session.status !== 'active'))
  const attempts = session.attempts.filter((attempt) => attempt.questionId === question.id)
  projected.attemptsUsed = attempts.length
  projected.terminal = terminal
  const latest = attempts[attempts.length - 1]?.result
  if (latest && (terminal || session.config.feedbackMode === 'immediate')) {
    projected.result = {
      correct: latest.correct,
      pointsAwarded: latest.pointsAwarded,
      message: latest.correct ? question.feedback.correct : question.feedback.incorrect,
    }
  }
  if (terminal)
    projected.reveal = {
      answerKey: cloneValue(question.answerKey),
      explanation: question.feedback.explanation,
    }
  return projected
}

// Public audience documents never pass through the private config normalizer.
function projectPublicQuiz(config, session) {
  const projected = {
    title: config.title,
    attemptLimit: config.attemptLimit,
    shuffleQuestions: config.shuffleQuestions,
    feedbackMode: config.feedbackMode,
    showScore: config.showScore,
    questions: config.questions.map((question) => projectQuizQuestion(question, session)),
  }
  if (session) {
    projected.generation = session.generation
    projected.questionId = session.questionId
    projected.status = session.status
    projected.deadline = session.deadline
    if (config.showScore) projected.score = session.score
  }
  return projected
}

module.exports = { projectQuizQuestion, projectPublicQuiz }

const { projectQuizQuestion } = require('revealjs-shared/src/education/quiz-public-projection.js')
function projectQuizFeedback(room, question, session, result) {
  const closed = room.phase !== 'active'
  const projection = projectQuizQuestion(
    question,
    closed ? { ...session, status: 'terminal' } : session
  )
  const visible = { ...result, terminal: projection.terminal }
  if (projection.result) visible.message = projection.result.message
  else delete visible.correct
  if (!projection.result || !room.config.showScore) {
    delete visible.points
    delete visible.pointsAwarded
    delete visible.totalScore
  }
  return { result: visible, reveal: projection.reveal }
}
module.exports = { projectQuizFeedback }

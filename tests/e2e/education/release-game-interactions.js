import { expect } from '@playwright/test'
import { playQuiz, playClassroom } from './release-quiz-interactions.js'
import { playUtility } from './release-utility-interactions.js'
import { playRoundGame } from './release-round-interactions.js'
import { playQuestionRound } from './release-question-round-interactions.js'

export async function completeGame(root, type, config) {
  await expect(root).toBeVisible()
  if (type === 'quiz') return playQuiz(root, config)
  if (['poll', 'word-cloud', 'matching'].includes(type)) return playClassroom(root, type, config)
  if (['relay-race', 'trivia-champ', 'scattergories'].includes(type))
    return playRoundGame(root, type, config)
  if (['hot-potato', 'four-corners', 'jeopardy'].includes(type))
    return playQuestionRound(root, type, config)
  return playUtility(root, type, config)
}

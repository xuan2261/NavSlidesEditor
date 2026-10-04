import { expect } from '@playwright/test'
import {
  defineFields,
  scalar,
  titleCase,
  questionCase,
  participant,
  click,
  wrongAnswer,
} from './release-game-fields-harness.js'
import { answerQuestion } from './release-quiz-interactions.js'

async function start(root) {
  await participant(root)
  await click(root, 'Start quiz')
}
async function authored(root, config) {
  await start(root)
  await expect(root.getByRole('heading', { level: 4 })).toContainText('Edited capital question')
  await answerQuestion(root, config.questions[0])
  await expect(root.getByRole('status')).toContainText('Correct!')
  await click(root, 'Reveal answers')
  await expect(root).toContainText('Answer: Paris')
}
defineFields('hot-potato', [
  titleCase('hot-potato'),
  questionCase(authored),
  scalar(
    'allowLate',
    'Allow late answers',
    true,
    async (root, config) => {
      await start(root)
      await expect(root.getByRole('status')).toContainText(
        'Time expired; late answers are allowed',
        { timeout: 8000 }
      )
      await answerQuestion(root, config.questions[0])
      await expect(root.getByRole('status')).toContainText('Late answer.')
      await expect(root.getByRole('status')).toContainText('Correct!')
      await expect(root.locator('[aria-label="Participant score"]')).toHaveText(
        `Field learner: ${config.questions[0].points} points`
      )
    },
    (config) => {
      config.questions[0].timeLimit = 5
    }
  ),
  scalar('showLeaderboard', 'Show leaderboard', false, async (root, config) => {
    await start(root)
    await answerQuestion(root, config.questions[0])
    await expect(root.locator('[aria-label="Participant score"]')).not.toContainText(': 0 points')
    await expect(root.locator('[aria-label="Leaderboard"]')).toBeHidden()
  }),
  scalar(
    'shuffleQuestions',
    'Shuffle questions',
    false,
    async (root, config) => {
      await start(root)
      for (const [index, question] of config.questions.entries()) {
        await expect(root.getByRole('heading', { level: 4 })).toContainText(question.prompt)
        await answerQuestion(root, question)
        await expect(root.getByRole('status')).toContainText('Correct!')
        await click(root, 'Reveal answers')
        await click(root, index === config.questions.length - 1 ? 'Finish quiz' : 'Next question')
      }
      await expect(root.getByRole('status')).toHaveText('Game ended.')
    },
    (config) => {
      config.shuffleQuestions = true
      config.questions.push({
        ...structuredClone(config.questions[0]),
        id: 'second-question',
        prompt: 'Second authored prompt',
      })
    }
  ),
])

defineFields('quiz', [
  titleCase('quiz'),
  questionCase(async (root, config) => {
    await expect(root.getByRole('heading', { level: 4 })).toHaveText('Edited capital question')
    await answerQuestion(root, config.questions[0])
    await expect(root.getByRole('status')).toContainText('Correct.')
    await click(root, 'Finish quiz')
    await expect(root.getByRole('status')).toHaveText('Quiz complete.')
  }),
  scalar('attemptLimit', 'Attempt limit', 2, async (root, config) => {
    await wrongAnswer(root, config.questions[0])
    await expect(root).toContainText('Attempts 1/2')
    await expect(root.getByRole('button', { name: 'Submit answer', exact: true })).toBeEnabled()
    await wrongAnswer(root, config.questions[0])
    await expect(root).toContainText('Attempts 2/2')
    await expect(root.getByRole('button', { name: 'Submit answer', exact: true })).toBeDisabled()
  }),
  scalar(
    'shuffleQuestions',
    'Shuffle questions',
    false,
    async (root, config) => {
      for (const [index, question] of config.questions.entries()) {
        await expect(root.getByRole('heading', { level: 4 })).toHaveText(question.prompt)
        await answerQuestion(root, question)
        await expect(root.getByRole('status')).toContainText('Correct.')
        await click(root, index === config.questions.length - 1 ? 'Finish quiz' : 'Next question')
      }
      await expect(root.getByRole('status')).toHaveText('Quiz complete.')
    },
    (config) => {
      config.shuffleQuestions = true
      config.questions.push({
        ...structuredClone(config.questions[0]),
        id: 'second-question',
        prompt: 'Second authored prompt',
      })
    }
  ),
  {
    field: 'feedbackMode',
    setup: (config) => {
      config.attemptLimit = 2
    },
    change: (config) => {
      config.feedbackMode = 'after-question'
    },
    author: (panel) =>
      panel.getByLabel('Feedback mode', { exact: true }).selectOption('after-question'),
    exercise: async (root, config) => {
      await wrongAnswer(root, config.questions[0])
      await expect(root.getByRole('status')).toHaveText('Answer received.')
      await expect(root).not.toContainText(config.questions[0].feedback.incorrect)
      await answerQuestion(root, config.questions[0])
      await expect(root.getByRole('status')).toContainText('Correct.')
    },
  },
  scalar('showScore', 'Show score', false, async (root, config) => {
    await answerQuestion(root, config.questions[0])
    await expect(root.getByRole('status')).toContainText('Correct.')
    await expect(
      root.getByText(`Score: ${config.questions[0].points}`, { exact: true })
    ).toBeHidden()
  }),
])

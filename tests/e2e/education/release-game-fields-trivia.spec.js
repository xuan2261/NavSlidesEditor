import { expect } from '@playwright/test'
import {
  defineFields,
  scalar,
  nested,
  titleCase,
  questionCase,
  click,
  label,
} from './release-game-fields-harness.js'
import { answerQuestion } from './release-quiz-interactions.js'

async function start(root, config, bonus) {
  await click(root, 'Start championship')
  if (bonus) await click(root, bonus)
  await click(root, `Buzz: ${config.teams[0].name}`)
}
async function score(root, config, value) {
  await answerQuestion(root, config.questions[0])
  await expect(root.getByRole('status')).toHaveText('Correct answer.')
  await expect(root.locator('[aria-label="Scores"]')).toContainText(
    `${config.teams[0].name}: ${value}`
  )
}
defineFields('trivia-champ', [
  titleCase('trivia-champ'),
  questionCase(async (root, config) => {
    await start(root, config)
    await expect(root.getByRole('heading', { level: 4 })).toContainText('Edited capital question')
    await score(root, config, 20)
    await click(root, 'Next question / round')
    await expect(root.getByRole('status')).toContainText('wins!')
  }),
  nested(
    'teams',
    'Team 1 name',
    'Cobalt team',
    (config) => {
      config.teams[0].name = 'Cobalt team'
    },
    async (root, config) => {
      await start(root, config)
      await expect(
        root.getByRole('combobox', { name: 'Answering team', exact: true })
      ).toContainText('Cobalt team')
      await score(root, config, 20)
    }
  ),
  {
    field: 'rounds',
    setup: (config) => {
      const second = {
        ...structuredClone(config.questions[0]),
        id: 'trivia-second',
        prompt: 'Second authored question',
      }
      config.questions.push(second)
      config.rounds[0].questionIds.push(second.id)
    },
    change: (config) => {
      config.rounds[0].questionIds.reverse()
    },
    author: (panel) => click(panel, 'Move round 1 question 1 down'),
    exercise: async (root, config) => {
      await start(root, config)
      await expect(root.getByRole('heading', { level: 4 })).toContainText(
        'Second authored question'
      )
      await answerQuestion(root, config.questions[1])
      await click(root, 'Next question / round')
      await click(root, `Buzz: ${config.teams[0].name}`)
      await expect(root.getByRole('heading', { level: 4 })).toContainText(
        config.questions[0].prompt
      )
      await answerQuestion(root, config.questions[0])
      await expect(root.locator('[aria-label="Scores"]')).toContainText('Blue: 40')
    },
  },
  scalar('buzzPoints', 'Buzz points', 15, async (root, config) => {
    await start(root, config)
    await expect(root).toContainText('won the buzz (+15)')
    await score(root, config, 25)
  }),
  {
    field: 'lightningRound',
    setup: (config) => {
      config.lightningRound.enabled = false
    },
    change: (config) => {
      config.lightningRound = { enabled: true, timePerQ: 5 }
    },
    author: async (panel) => {
      await label(panel, 'Enable lightning round').check()
      await label(panel, 'Lightning time per question in seconds').fill('5')
    },
    exercise: async (root, config) => {
      await start(root, config, 'Lightning ×3')
      await expect(root.getByRole('timer')).toContainText(/^[1-5] seconds remaining$/)
      await score(root, config, 40)
    },
  },
  nested(
    'jackpotRound',
    'Jackpot multiplier',
    3,
    (config) => {
      config.jackpotRound.multiplier = 3
    },
    async (root, config) => {
      await start(root, config, 'Jackpot ×3')
      await score(root, config, 40)
    }
  ),
])

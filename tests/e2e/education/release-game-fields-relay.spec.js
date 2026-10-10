import { expect } from '@playwright/test'
import {
  defineFields,
  scalar,
  nested,
  titleCase,
  questionCase,
  click,
  wrongAnswer,
} from './release-game-fields-harness.js'
import { answerQuestion } from './release-quiz-interactions.js'

defineFields('relay-race', [
  titleCase('relay-race'),
  questionCase(async (root, config) => {
    await click(root, 'Start race')
    await expect(root.getByRole('heading', { level: 4 })).toHaveText('Edited capital question')
    await answerQuestion(root, config.questions[0])
    await expect(root.getByRole('status')).toContainText('wins!', { timeout: 5000 })
  }),
  nested(
    'teams',
    'Team 1 name',
    'Cobalt team',
    (config) => {
      config.teams[0].name = 'Cobalt team'
    },
    async (root, config) => {
      await expect(root.locator('[aria-label="Team lanes"]')).toContainText(
        'Cobalt team: 0/1 — baton'
      )
      await click(root, 'Start race')
      await answerQuestion(root, config.questions[0])
      await expect(root.getByRole('status')).toHaveText('Cobalt team wins!', { timeout: 5000 })
      await expect(
        root.getByRole('progressbar', { name: 'Cobalt team position', exact: true })
      ).toHaveAttribute('value', '1')
    }
  ),
  scalar(
    'questionsPerRound',
    'Questions per round',
    2,
    async (root, config) => {
      await click(root, 'Start race')
      await answerQuestion(root, config.questions[0])
      await expect(root.getByRole('progressbar').first()).toHaveAttribute('value', '1', {
        timeout: 5000,
      })
      await expect(root.getByRole('button', { name: 'Submit answer', exact: true })).toBeVisible()
      await answerQuestion(root, config.questions[0])
      await expect(root.getByRole('status')).toContainText('wins!', { timeout: 5000 })
      await expect(root.getByRole('progressbar').first()).toHaveAttribute('value', '2')
    },
    (config) => {
      config.teams = [config.teams[0]]
    }
  ),
  scalar(
    'shuffleTeams',
    'Shuffle teams',
    false,
    async (root, config) => {
      await expect(root.locator('[aria-label="Team lanes"] li')).toHaveText(
        config.teams.map((team, index) => `${team.name}: 0/1${index ? '' : ' — baton'}`)
      )
      await click(root, 'Start race')
      await expect(root.getByRole('status')).toHaveText(
        `${config.teams[0].name}: answer the question.`
      )
      await answerQuestion(root, config.questions[0])
      await expect(root.getByRole('status')).toHaveText(`${config.teams[0].name} wins!`, {
        timeout: 5000,
      })
    },
    (config) => {
      config.shuffleTeams = true
    }
  ),
  scalar('passOnWrong', 'Pass on wrong answer', false, async (root, config) => {
    await click(root, 'Start race')
    await wrongAnswer(root, config.questions[0])
    await expect(root.getByRole('status')).toContainText('Wrong or passed')
    await expect(root.getByRole('button', { name: 'Submit answer', exact: true })).toBeVisible({
      timeout: 5000,
    })
    await expect(root.getByRole('status')).toHaveText(
      `${config.teams[1].name}: answer the question.`
    )
    for (const team of config.teams)
      await expect(
        root.getByRole('progressbar', { name: `${team.name} position`, exact: true })
      ).toHaveAttribute('value', '0')
  }),
  scalar('timerDuration', 'Timer duration in seconds', 2, async (root) => {
    await click(root, 'Start race')
    await expect(root.getByRole('timer')).toContainText(/^[12] seconds remaining$/)
    await expect(root.getByRole('status')).toContainText('Wrong or passed', { timeout: 5000 })
  }),
])

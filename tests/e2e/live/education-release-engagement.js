import { test, expect } from '@playwright/test'
import {
  releaseJourney,
  latest,
  redacted,
  receipt,
  reconnect,
  replay,
  qualify,
  agreePublic,
} from './education-release-helper.js'

export function engagementJourneys() {
  test('poll native change-vote hydrates stable aggregate and resets two learners', async ({
    page,
    request,
    browser,
    baseURL,
  }, testInfo) => {
    const journey = await releaseJourney({ page, request, browser, baseURL }, 'poll', {
      prompt: 'Vote',
      options: [
        { id: 'a', text: 'Alpha' },
        { id: 'b', text: 'Beta' },
      ],
      allowVoteChange: true,
    })
    try {
      await journey.command('startPoll')
      await redacted(journey)
      const [ada, lin] = journey.learners
      for (const name of ['Alpha', 'Beta']) {
        await ada.getByRole('radio', { name, exact: true }).check()
        await ada.getByRole('button', { name: 'Vote', exact: true }).click()
        await receipt(journey, 0, 'game-poll-submit', name === 'Alpha' ? 1 : 2)
        await expect(ada.getByRole('button', { name: 'Vote', exact: true })).toBeEnabled()
      }
      await reconnect(journey)
      await expect(ada.getByRole('radio', { name: 'Beta', exact: true })).toBeChecked()
      await expect(lin.getByText(/1 votes/)).toBeVisible()
      expect(latest(journey).poll.totalVotes).toBe(1)
      expect(latest(journey).poll.options.map((row) => row.votes)).toEqual([0, 1])
      await lin.getByRole('radio', { name: 'Alpha', exact: true }).check()
      await lin.getByRole('button', { name: 'Vote', exact: true }).click()
      await receipt(journey, 1, 'game-poll-submit')
      await agreePublic(journey)
      expect(latest(journey).poll.totalVotes).toBe(2)
      expect(latest(journey).poll.options.map((row) => row.votes)).toEqual([1, 1])
      await journey.command('reveal')
      await reconnect(journey, 1)
      await replay(journey, () => journey.command('startPoll'))
      expect(latest(journey).poll.totalVotes).toBe(0)
      for (const learner of journey.learners)
        await expect(learner.getByRole('radio', { name: 'Alpha', exact: true })).not.toBeChecked()
      await qualify(testInfo, journey)
    } finally {
      await journey.close()
    }
  })
  test('cloud accepted quota, reconnect and Clear retain server counts without optimistic additions', async ({
    page,
    request,
    browser,
    baseURL,
  }, testInfo) => {
    const journey = await releaseJourney({ page, request, browser, baseURL }, 'word-cloud', {
      prompt: 'Ideas',
      maxSubmissionsPerPlayer: 2,
      maxPhraseLength: 40,
    })
    try {
      await journey.command('startWordCloud')
      await redacted(journey)
      const [ada, lin] = journey.learners,
        words = ['Bear', 'Bird']
      for (const [index, word] of words.entries()) {
        await ada.getByRole('textbox').fill(word)
        await ada.getByRole('button', { name: 'Submit word' }).click()
        await receipt(journey, 0, 'game-word-cloud-submit', index + 1)
        await expect
          .poll(() => latest(journey, 1)?.wordCloud.words)
          .toEqual(
            words.slice(0, index + 1).map((text) => ({ text: text.toLowerCase(), count: 1 }))
          )
        await expect(lin.getByRole('list').first().getByRole('listitem').nth(index)).toBeVisible()
      }
      await expect(ada.getByRole('button', { name: 'Submit word' })).toBeDisabled()
      await reconnect(journey)
      await expect(ada.getByText('2 / 2 submissions', { exact: true })).toBeVisible()
      await expect(ada.getByRole('button', { name: 'Submit word' })).toBeDisabled()
      await lin.getByRole('textbox').fill('Bear')
      await lin.getByRole('button', { name: 'Submit word' }).click()
      await receipt(journey, 1, 'game-word-cloud-submit')
      await agreePublic(journey)
      expect(latest(journey).wordCloud.words).toEqual([
        { text: 'bear', count: 2 },
        { text: 'bird', count: 1 },
      ])
      const round = latest(journey).roundId,
        generation = latest(journey).generation
      await journey.command('clear')
      await expect(ada.getByText('0 / 2 submissions', { exact: true })).toBeVisible()
      await expect(ada.getByRole('button', { name: 'Submit word' })).toBeEnabled()
      await expect
        .poll(() => journey.received.map((rows) => rows.at(-1)?.wordCloud.words))
        .toEqual([[], []])
      for (const learner of journey.learners)
        await expect(learner.getByRole('list').first().getByRole('listitem')).toHaveCount(0)
      expect(latest(journey).roundId).toBeGreaterThan(round)
      expect(latest(journey).generation).toBe(generation)
      await replay(journey, () => journey.command('startWordCloud'))
      await qualify(testInfo, journey)
    } finally {
      await journey.close()
    }
  })
  test('matching public sides withhold keys, hydrate stable submitted pairs and clear generation', async ({
    page,
    request,
    browser,
    baseURL,
  }, testInfo) => {
    const pairs = [
      { promptId: 'http', prompt: 'HTTP', targetId: 'protocol', target: 'Protocol' },
      { promptId: 'tls', prompt: 'TLS', targetId: 'security', target: 'Security' },
    ]
    const journey = await releaseJourney({ page, request, browser, baseURL }, 'matching', { pairs })
    try {
      await journey.command('startMatching')
      await redacted(journey)
      for (const [index, learner] of journey.learners.entries()) {
        for (const pair of pairs) {
          await learner.getByRole('button', { name: pair.prompt, exact: true }).click()
          await learner.getByRole('button', { name: pair.target, exact: true }).click()
        }
        await learner.getByRole('button', { name: 'Submit matches' }).click()
        await receipt(journey, index, 'game-matching-submit')
        await expect.poll(() => latest(journey, index)?.ownSubmission?.score).toBe(2)
        expect(latest(journey, index).ownSubmission.pairs).toEqual(
          pairs.map(({ promptId, targetId }) => ({ promptId, targetId }))
        )
      }
      await redacted(journey)
      expect(latest(journey).matching.submissions).toBe(2)
      await journey.command('reveal')
      await reconnect(journey)
      await expect(journey.learners[0].getByText('HTTP → Protocol', { exact: true })).toBeVisible()
      await expect(journey.learners[1].getByText('TLS → Security', { exact: true })).toBeVisible()
      await replay(journey, () => journey.command('startMatching'))
      expect(latest(journey).matching.submissions).toBe(0)
      await qualify(testInfo, journey)
    } finally {
      await journey.close()
    }
  })
}

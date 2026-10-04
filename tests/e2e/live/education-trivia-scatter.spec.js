import { test, expect } from '@playwright/test'
import { question, nativeAnswer, agreeTeamScores } from './education-player-fixture.js'
import {
  releaseJourney,
  assignTeams,
  redacted,
  receipt,
  reconnect,
  replay,
  qualify,
  latest,
} from './education-release-helper.js'
test('simultaneous independent trivia buzz has one winner, separate server answer points and shared scores', async ({
  page,
  request,
  browser,
  baseURL,
}, testInfo) => {
  const args = { page, request, browser, baseURL }
  const buzzFrames = []
  const journey = await releaseJourney(
    args,
    'trivia-champ',
    {
      questions: [question()],
      rounds: [{ id: 'r1', name: 'Buzz', mode: 'buzzer', timeLimit: 30, questionIds: ['q'] }],
      buzzPoints: 10,
    },
    async (context) => {
      await context.routeWebSocket(
        (url) => url.pathname === '/ws/' && url.searchParams.get('transport') === 'websocket',
        (socket) => {
          const server = socket.connectToServer()
          socket.onMessage((message) => {
            if (
              typeof message === 'string' &&
              message.startsWith('42/games,') &&
              JSON.parse(message.slice(message.indexOf('[')))[0] === 'game-trivia-buzz'
            ) {
              buzzFrames.push({ server, message })
              if (buzzFrames.length === 2)
                for (const frame of buzzFrames) frame.server.send(frame.message)
            } else server.send(message)
          })
        }
      )
    }
  )
  try {
    await assignTeams(journey)
    await journey.command('start')
    await redacted(journey)
    const [ada, lin] = journey.learners
    for (const learner of journey.learners)
      await expect(learner.getByRole('button', { name: 'Buzz in' })).toBeEnabled()
    await Promise.all(
      journey.learners.map((learner) => learner.getByRole('button', { name: 'Buzz in' }).click())
    )
    await expect.poll(() => buzzFrames.length).toBe(2)
    await expect(ada.getByRole('button', { name: 'Buzz in' })).toBeDisabled()
    await expect(lin.getByRole('button', { name: 'Buzz in' })).toBeDisabled()
    await expect
      .poll(
        async () =>
          Number(await ada.getByRole('button', { name: 'Submit answer' }).isEnabled()) +
          Number(await lin.getByRole('button', { name: 'Submit answer' }).isEnabled())
      )
      .toBe(1)
    const holder = (await ada.getByRole('button', { name: 'Submit answer' }).isEnabled())
      ? ada
      : lin
    await agreeTeamScores(journey)
    expect(
      latest(journey)
        .teams.map((row) => row.score)
        .sort((a, b) => a - b)
    ).toEqual([0, 10])
    await expect
      .poll(() =>
        journey.wires
          .flatMap((wire) =>
            wire.incoming.filter(
              (row) =>
                row.name === 'game-command-result' &&
                wire.outgoing.some(
                  (sent) =>
                    sent.name === 'game-trivia-buzz' && sent.data.commandId === row.data.commandId
                )
            )
          )
          .map((row) => row.data.accepted)
          .sort()
      )
      .toEqual([false, true])
    await redacted(journey)
    await nativeAnswer(holder)
    await expect(holder.getByText('Correct.', { exact: true })).toBeVisible()
    await receipt(journey, journey.learners.indexOf(holder), 'game-trivia-answer')
    await agreeTeamScores(journey)
    expect(latest(journey).revealed.question.answerKey).toEqual(question().answerKey)
    expect(
      latest(journey)
        .teams.map((row) => row.score)
        .sort((a, b) => a - b)
    ).toEqual([0, 20])
    await reconnect(journey, journey.learners.indexOf(holder))
    await expect(holder.getByRole('button', { name: 'Submit answer' })).toBeDisabled()
    await replay(journey, () => journey.command('start'))
    await qualify(testInfo, journey)
  } finally {
    await journey.close()
  }
})
test('scatter native category submits retain duplicate status and server adjudication across reveal/reconnect', async ({
  page,
  request,
  browser,
  baseURL,
}, testInfo) => {
  const args = { page, request, browser, baseURL }
  const journey = await releaseJourney(args, 'scattergories', {
    letterMode: 'manual',
    letter: 'B',
    categories: [{ id: 'animal', label: 'Animal' }],
    timePerRound: 30,
  })
  try {
    await assignTeams(journey)
    await journey.root.getByRole('button', { name: 'Start selected letter', exact: true }).click()
    await redacted(journey)
    for (const learner of journey.learners) {
      const input = learner.getByRole('textbox', { name: /Animal/ })
      await expect(input).toBeEditable()
      await input.fill('Bear')
      await learner.getByRole('button', { name: 'Submit categories' }).click()
      await expect(learner.getByRole('button', { name: 'Submit categories' })).toBeDisabled()
    }
    for (const index of [0, 1]) await receipt(journey, index, 'game-scatter-submit')
    await redacted(journey)
    await journey.command('reveal')
    for (const learner of journey.learners)
      await expect(learner.getByText(/Animal.*Bear.*duplicate/).first()).toBeVisible()
    await agreeTeamScores(journey)
    expect(latest(journey).teams.map((row) => row.score)).toEqual([0, 0])
    await journey.root.getByRole('button', { name: 'Invalid meaning', exact: true }).first().click()
    await receipt(journey, 'host', 'game-scatter-adjudicate')
    await agreeTeamScores(journey)
    expect(latest(journey).teams.map((row) => row.score)).toEqual([0, 0])
    await reconnect(journey)
    await expect(journey.learners[0].getByText(/Animal.*Bear.*duplicate/).first()).toBeVisible()
    await expect(
      journey.learners[0].getByRole('button', { name: 'Submit categories' })
    ).toBeDisabled()
    await replay(journey, () =>
      journey.root.getByRole('button', { name: 'Start selected letter', exact: true }).click()
    )
    for (const learner of journey.learners)
      await expect(learner.getByRole('textbox', { name: /Animal/ })).toHaveValue('')
    await qualify(testInfo, journey)
  } finally {
    await journey.close()
  }
})

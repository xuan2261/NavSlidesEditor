import { expect } from '@playwright/test'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'
import { createDefaultGameConfig } from '../../../shared/src/education/game-defaults.js'
export const question = (id = 'q') => ({
  id,
  kind: 'single-choice',
  prompt: 'Choose Earth',
  points: 10,
  timeLimit: 30,
  options: [
    { id: 'earth', text: 'Earth' },
    { id: 'mars', text: 'Mars' },
    { id: 'venus', text: 'Venus' },
    { id: 'jupiter', text: 'Jupiter' },
  ],
  answerKey: { optionId: 'earth' },
  feedback: { correct: 'Correct', incorrect: 'Try again', explanation: 'Earth is our home.' },
})
export async function liveJourney(
  { page, request, browser, baseURL },
  type,
  fields = {},
  prepareLearner = async () => {}
) {
  const deck = await apiCreatePresentation(request, `Education learner ${type}`),
    contexts = []
  let host
  const config = { ...createDefaultGameConfig(type), ...fields }
  try {
    await apiUpdatePresentation(request, deck.id, {
      slides: [
        {
          id: 'education-slide',
          background: { type: 'color', color: '#111827' },
          elements: [
            {
              id: 'education-game',
              type: 'game',
              gameType: type,
              x: 40,
              y: 40,
              width: 900,
              height: 620,
              [type]: config,
            },
          ],
        },
      ],
    })
    const response = await request.post('/api/live/room')
    expect(response.ok()).toBe(true)
    const room = await response.json()
    await page.goto('/')
    const popup = page.waitForEvent('popup')
    await page.evaluate(
      ({ id, room }) => {
        const host = window.open('about:blank', '_blank')
        host.name = JSON.stringify({ roomCode: room.roomCode, presenterToken: room.presenterToken })
        host.location.href = `/api/presentations/${id}/present?live=${room.roomCode}`
      },
      { id: deck.id, room }
    )
    host = await popup
    const root = host.locator('[data-ns-element-id="education-game"]').first()
    const link = root.locator('[data-ns-learner-join]')
    await expect(link).toHaveAttribute('href', /game\/join\?gameId=/)
    const joinURL = new URL(await link.getAttribute('href'), host.url())
    const learners = [],
      received = []
    for (const name of ['Ada', 'Lin']) {
      const context = await browser.newContext({
        baseURL,
        viewport: { width: name === 'Ada' ? 320 : 768, height: 800 },
        reducedMotion: 'reduce',
        hasTouch: name === 'Ada',
      })
      contexts.push(context)
      const learner = await context.newPage()
      await prepareLearner(context, name)
      const snapshots = []
      received.push(snapshots)
      const websocketReady = learner.waitForEvent('websocket')
      learner.on('websocket', (socket) =>
        socket.on('framereceived', (frame) => {
          if (typeof frame.payload !== 'string' || !frame.payload.startsWith('42/games,')) return
          const packet = JSON.parse(frame.payload.slice(frame.payload.indexOf('[')))
          if (packet[0] === 'game-round-state') snapshots.push(packet[1])
        })
      )
      const target = new URL(joinURL)
      target.searchParams.set('name', name)
      await learner.goto(target.href)
      await websocketReady
      await expect(
        learner.getByRole('status').filter({ hasText: /Waiting for the host/ })
      ).toBeVisible()
      learners.push(learner)
    }
    return {
      host,
      root,
      learners,
      received,
      contexts,
      request,
      config,
      deck,
      command: (action) => root.locator(`[data-ns-command="${action}"]`).click(),
      close: async () => {
        await host.close()
        for (const context of contexts) await context.close()
        await apiDeletePresentation(request, deck.id)
      },
    }
  } catch (error) {
    await host?.close()
    for (const context of contexts) await context.close()
    await apiDeletePresentation(request, deck.id)
    throw error
  }
}
export async function nativeAnswer(page, option = 'Earth') {
  await page.getByRole('radio', { name: option, exact: true }).check()
  await page.getByRole('button', { name: 'Submit answer', exact: true }).click()
}
export async function agreeTeamScores(journey) {
  const projection = (state) => ({
    roomInstanceId: state.roomInstanceId,
    generation: state.generation,
    roundId: state.roundId,
    phase: state.phase,
    teams: state.teams,
    turn: state.turn,
    buzz: state.buzz,
    relay: state.relay,
    leaderboard: state.leaderboard,
  })
  await expect
    .poll(async () => {
      const host = await journey.root.evaluate(
        (root) => NavSlidesEducation.mount(root).getState().state
      )
      return journey.received
        .map((states) => states.at(-1))
        .every(
          (state) => state && JSON.stringify(projection(state)) === JSON.stringify(projection(host))
        )
    })
    .toBe(true)
  const learnerScores = await journey.learners[0]
    .getByRole('list', { name: 'Leaderboard' })
    .textContent()
  await expect(journey.learners[1].getByRole('list', { name: 'Leaderboard' })).toHaveText(
    learnerScores
  )
}

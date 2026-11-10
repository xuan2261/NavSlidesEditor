import { test, expect } from '@playwright/test'
import { liveJourney, question } from './education-player-fixture.js'
test('a previously issued server frame cannot overwrite a new-generation learner draft', async ({
  page,
  request,
  browser,
  baseURL,
}) => {
  const args = { page, request, browser, baseURL }
  let delayed, deliver
  const q = {
    ...question(),
    kind: 'fill-blank',
    answerKey: { accepted: ['Earth'], caseSensitive: false },
  }
  delete q.options
  const journey = await liveJourney(args, 'quiz', { questions: [q] }, async (context, name) => {
    if (name !== 'Ada') return
    await context.addInitScript(() => {
      const originalAdd = EventTarget.prototype.addEventListener
      const observed = new WeakSet()
      window.__educationInboundFrames = []
      EventTarget.prototype.addEventListener = function (type, listener, options) {
        if (
          type === 'message' &&
          this instanceof window.WebSocket &&
          new URL(this.url).pathname === '/ws/' &&
          !observed.has(this)
        ) {
          observed.add(this)
          originalAdd.call(this, 'message', ({ data }) => {
            if (typeof data === 'string' && data.startsWith('42/games,'))
              window.__educationInboundFrames.push(data)
          })
        }
        return originalAdd.call(this, type, listener, options)
      }
    })
    await context.routeWebSocket(
      (url) => url.pathname === '/ws/' && url.searchParams.get('transport') === 'websocket',
      (socket) => {
        const server = socket.connectToServer()
        server.onMessage((message) => {
          if (typeof message === 'string' && message.startsWith('42/games,')) {
            const [event, state] = JSON.parse(message.slice(message.indexOf('[')))
            if (!delayed && event === 'game-round-state' && state.phase === 'active') {
              delayed = message
              deliver = () => socket.send(delayed)
            }
          }
          socket.send(message)
        })
      }
    )
  })
  try {
    const ada = journey.learners[0]
    await journey.command('nextQuestion')
    await expect(ada.getByRole('textbox')).toBeVisible()
    await expect.poll(() => Boolean(delayed)).toBe(true)
    await journey.command('reset')
    await journey.command('nextQuestion')
    const oldGeneration = JSON.parse(delayed.slice(delayed.indexOf('[')))[1].generation
    await expect.poll(() => journey.received[0].at(-1)?.generation).toBeGreaterThan(oldGeneration)
    await ada.getByRole('textbox').fill('new draft')
    await ada.getByRole('textbox').focus()
    const deliveries = () =>
      ada.evaluate(
        (frame) => window.__educationInboundFrames.filter((message) => message === frame).length,
        delayed
      )
    await expect.poll(deliveries).toBe(1)
    deliver()
    await expect.poll(deliveries).toBe(2)
    expect(journey.received[0].at(-1).generation).toBeGreaterThan(oldGeneration)
    await expect(ada.getByRole('textbox')).toHaveValue('new draft')
    await expect(ada.getByRole('textbox')).toBeFocused()
    await ada.getByRole('textbox').fill('Earth')
    await ada.getByRole('textbox').press('Enter')
    await expect(ada.getByText('Correct.', { exact: true })).toBeVisible()
  } finally {
    await journey.close()
  }
})

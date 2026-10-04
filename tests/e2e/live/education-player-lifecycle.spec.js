import { test, expect } from '@playwright/test'
import { liveJourney, question } from './education-player-fixture.js'
test('native draft survives disconnect, new generation clears it and late learner sees public reveal', async ({
  page,
  request,
  browser,
  baseURL,
}) => {
  const args = { page, request, browser, baseURL }
  const q = {
    ...question(),
    kind: 'fill-blank',
    prompt: 'Planet',
    answerKey: { accepted: ['Earth'], caseSensitive: false },
  }
  delete q.options
  const journey = await liveJourney(args, 'quiz', {
    questions: [q],
    attemptLimit: 2,
    showScore: true,
  })
  let lateContext
  try {
    const [ada, lin] = journey.learners
    await journey.command('nextQuestion')
    await ada.getByRole('textbox').fill('Earth')
    await journey.contexts[0].setOffline(true)
    await expect(ada.getByText(/Disconnected/)).toBeVisible()
    await expect(ada.getByRole('textbox')).toHaveValue('Earth')
    await expect(ada.getByRole('button', { name: 'Submit answer' })).toBeDisabled()
    await journey.contexts[0].setOffline(false)
    await expect(ada.getByRole('button', { name: 'Submit answer' })).toBeEnabled()
    await expect(ada.getByRole('textbox')).toHaveValue('Earth')
    await ada.getByRole('textbox').press('Enter')
    await expect(ada.getByText('Correct.', { exact: true })).toBeVisible()
    await lin.getByRole('textbox').fill('Mars')
    await lin.getByRole('button', { name: 'Submit answer' }).click()
    await expect(lin.getByText('Incorrect. You may try again.')).toBeVisible()
    await journey.command('reveal')
    const join = new URL(
      await journey.root.locator('[data-ns-learner-join]').getAttribute('href'),
      journey.host.url()
    )
    join.searchParams.set('name', 'Late')
    lateContext = await args.browser.newContext({ baseURL: args.baseURL })
    const late = await lateContext.newPage()
    await late.goto(join.href)
    await expect(late.getByText('Answer: Earth')).toBeVisible()
    await expect(late.getByRole('button', { name: 'Submit answer' })).toBeDisabled()
    await journey.command('reset')
    await journey.command('nextQuestion')
    await expect(ada.getByRole('textbox')).toHaveValue('')
    await expect(lin.getByRole('textbox')).toHaveValue('')
    await expect(ada.getByRole('button', { name: 'Submit answer' })).toBeEnabled()
    await journey.command('end')
    for (const learner of [ada, lin, late])
      await expect(learner.getByText('Game finished.', { exact: true })).toBeVisible()
  } finally {
    await lateContext?.close()
    await journey.close()
  }
})
test('existing poll change-vote and matching stable pair hydration remain real native server behavior', async ({
  page,
  request,
  browser,
  baseURL,
}) => {
  const args = { page, request, browser, baseURL }
  const poll = await liveJourney(args, 'poll', {
    prompt: 'Vote',
    options: [
      { id: 'a', text: 'Alpha' },
      { id: 'b', text: 'Beta' },
    ],
    allowVoteChange: true,
  })
  try {
    await poll.command('startPoll')
    const ada = poll.learners[0]
    await ada.getByRole('radio', { name: 'Alpha', exact: true }).check()
    await ada.getByRole('button', { name: 'Vote', exact: true }).click()
    await expect(ada.getByRole('button', { name: 'Vote', exact: true })).toBeEnabled()
    await ada.getByRole('radio', { name: 'Beta', exact: true }).check()
    await ada.getByRole('button', { name: 'Vote', exact: true }).click()
    await ada.reload()
    await expect(ada.getByRole('radio', { name: 'Beta', exact: true })).toBeChecked()
    await expect(poll.learners[1].getByText(/1 votes/)).toBeVisible()
  } finally {
    await poll.close()
  }
  const matching = await liveJourney(args, 'matching', {
    pairs: [
      { promptId: 'http', prompt: 'HTTP', targetId: 'protocol', target: 'Protocol' },
      { promptId: 'tls', prompt: 'TLS', targetId: 'security', target: 'Security' },
    ],
  })
  try {
    await matching.command('startMatching')
    const ada = matching.learners[0]
    await ada.getByRole('button', { name: 'HTTP', exact: true }).click()
    await ada.getByRole('button', { name: 'Protocol', exact: true }).click()
    await ada.getByRole('button', { name: 'TLS', exact: true }).click()
    await ada.getByRole('button', { name: 'Security', exact: true }).click()
    await ada.getByRole('button', { name: 'Submit matches' }).click()
    await matching.command('reveal')
    await ada.reload()
    await expect(ada.getByText('HTTP → Protocol', { exact: true })).toBeVisible()
    await expect(matching.learners[1].getByText('TLS → Security', { exact: true })).toBeVisible()
  } finally {
    await matching.close()
  }
})
test('cloud accepted quota, reconnect and host Clear hydrate all learners without optimistic counts', async ({
  page,
  request,
  browser,
  baseURL,
}) => {
  const args = { page, request, browser, baseURL }
  const journey = await liveJourney(args, 'word-cloud', {
    prompt: 'Ideas',
    maxSubmissionsPerPlayer: 2,
    maxPhraseLength: 40,
  })
  try {
    await journey.command('startWordCloud')
    const [ada, lin] = journey.learners
    const words = ['Bear', 'Bird']
    for (const [index, word] of words.entries()) {
      await ada.getByRole('textbox').fill(word)
      await ada.getByRole('button', { name: 'Submit word' }).click()
      await expect
        .poll(() => journey.received[1].at(-1)?.wordCloud.words)
        .toEqual(words.slice(0, index + 1).map((text) => ({ text: text.toLowerCase(), count: 1 })))
      await expect(lin.getByRole('list').first().getByRole('listitem').nth(index)).toBeVisible()
    }
    await expect(ada.getByRole('button', { name: 'Submit word' })).toBeDisabled()
    await ada.reload()
    await expect(ada.getByText('2 / 2 submissions', { exact: true })).toBeVisible()
    await expect(ada.getByRole('button', { name: 'Submit word' })).toBeDisabled()
    await journey.command('clear')
    await expect(ada.getByText('0 / 2 submissions', { exact: true })).toBeVisible()
    await expect(ada.getByRole('button', { name: 'Submit word' })).toBeEnabled()
    await expect
      .poll(() => journey.received.map((states) => states.at(-1)?.wordCloud.words))
      .toEqual([[], []])
    for (const learner of [ada, lin])
      await expect(learner.getByRole('list').first().getByRole('listitem')).toHaveCount(0)
  } finally {
    await journey.close()
  }
})
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

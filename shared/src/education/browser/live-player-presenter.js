const { node } = require('./dom.js')
const { createLivePlayerClock } = require('./live-player-clock.js')
const { createLiveQuizCard } = require('./live-quiz-card.js')
const { createLiveFourCornersCard } = require('./live-four-corners-card.js')
const { createLiveRelayCard } = require('./live-relay-card.js')
const { createLiveTriviaCard } = require('./live-trivia-card.js')
const { createLiveScattergoriesCard } = require('./live-scattergories-card.js')
const { createLivePollCard } = require('./live-poll-card.js')
const { createLiveWordCloudCard } = require('./live-word-cloud-card.js')
const { createLiveMatchingCard } = require('./live-matching-card.js')
const { createLiveJeopardyCard } = require('./live-jeopardy-card.js')
const { createLiveNamePickerCard } = require('./live-name-picker-card.js')
const renderers = {
  quiz: createLiveQuizCard,
  'hot-potato': createLiveQuizCard,
  'four-corners': createLiveFourCornersCard,
  'relay-race': createLiveRelayCard,
  'trivia-champ': createLiveTriviaCard,
  scattergories: createLiveScattergoriesCard,
  poll: createLivePollCard,
  'word-cloud': createLiveWordCloudCard,
  matching: createLiveMatchingCard,
  jeopardy: createLiveJeopardyCard,
  'name-picker': createLiveNamePickerCard,
}
function mountLivePlayer(root, { transport, clock = { now: () => performance.now() } }) {
  if (!root || !transport?.getSnapshot || !transport?.subscribe || !transport?.emit)
    throw new TypeError('A root and live transport are required')
  const document = root.ownerDocument
  const status = node(document, 'p', '', { role: 'status', 'aria-live': 'polite' })
  const timer = node(document, 'p', '', { 'aria-live': 'off' }),
    body = node(document, 'section'),
    board = node(document, 'ol', undefined, { 'aria-label': 'Leaderboard' })
  root.setAttribute('data-ns-live-player', '')
  root.style.cssText += ';max-width:640px;width:100%;min-width:0;overflow-wrap:anywhere'
  root.replaceChildren(status, timer, body, board)
  const countdown = createLivePlayerClock(clock)
  let state = transport.getSnapshot(),
    card,
    key,
    destroyed = false,
    disposers = []
  const session = {
    getState: () => state,
    own: (fn) => {
      disposers.push(fn)
      return fn
    },
  }
  function clearCard() {
    card?.destroy?.()
    card = null
    disposers
      .splice(0)
      .reverse()
      .forEach((fn) => fn())
    body.replaceChildren()
  }
  function displayTime() {
    const seconds = countdown.seconds()
    timer.textContent = seconds === null ? '' : `Time remaining: ${seconds} seconds`
  }
  function render(next = transport.getSnapshot()) {
    if (destroyed) return
    state = next
    const token = JSON.stringify([
      state.roomInstanceId,
      state.generation,
      state.roundId,
      state.gameType,
      state.question?.id,
      Boolean(
        state.question ||
        state.poll ||
        state.wordCloud ||
        state.matching ||
        state.scatter ||
        state.jeopardy ||
        state.picker
      ),
    ])
    if (token !== key) {
      const restoreFocus = body.contains(document.activeElement)
      clearCard()
      key = token
      const create = renderers[state.gameType]
      const ready =
        state.gameType === 'name-picker'
          ? state.picker
          : state.gameType === 'jeopardy'
            ? state.jeopardy
            : ['poll', 'word-cloud', 'matching', 'scattergories'].includes(state.gameType)
              ? state[
                  {
                    poll: 'poll',
                    'word-cloud': 'wordCloud',
                    matching: 'matching',
                    scattergories: 'scatter',
                  }[state.gameType]
                ]
              : state.question
      if (create && ready) {
        try {
          card = create({ root: body, session, transport })
        } catch (error) {
          clearCard()
          body.append(
            node(document, 'p', `Unable to display this question: ${error.message}`, {
              role: 'alert',
            })
          )
        }
      }
      if (restoreFocus) body.querySelector('input,select,button')?.focus()
    }
    card?.render(state)
    const finished = ['finished', 'ended', 'complete'].includes(state.phase)
    const message = !state.connected
      ? state.error || 'Disconnected. Your draft is saved. Reconnecting…'
      : state.error ||
        (finished
          ? 'Game finished.'
          : state.phase === 'waiting' || !state.hydrated
            ? 'Waiting for the host to start…'
            : state.ownEligible === false && !state.readOnly
              ? 'Waiting for the next playable round.'
              : ['revealed', 'review'].includes(state.phase)
                ? 'Answers revealed.'
                : 'Live game in progress.')
    if (status.textContent !== message) status.textContent = message
    body.hidden = finished
    countdown.hydrate(state)
    displayTime()
    board.hidden = state.quiz?.showScore === false
    board.replaceChildren()
    for (const row of state.leaderboard || [])
      board.append(
        node(
          document,
          'li',
          `${row.name || row.teamName || row.playerId || row.teamId}: ${row.score}`
        )
      )
    for (const team of state.teams || [])
      if (Number.isFinite(team.score))
        board.append(node(document, 'li', `${team.name || team.id}: ${team.score}`))
    for (const control of body.querySelectorAll('button,input,select')) {
      control.style.minHeight = '44px'
      control.style.maxWidth = '100%'
      if (state.readOnly) control.disabled = true
    }
  }
  const keyboard = (event) => {
    if (
      event.target.closest('input,select,textarea,button,[data-ns-assignment-controls]') &&
      ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter', 'Escape'].includes(
        event.key
      )
    )
      event.stopPropagation()
  }
  root.addEventListener('keydown', keyboard)
  const unsubscribe = transport.subscribe(render)
  const interval = setInterval(() => {
    if (!destroyed) displayTime()
  }, 250)
  const visibility = () => {
    if (!document.hidden) displayTime()
  }
  document.addEventListener('visibilitychange', visibility)
  render()
  return {
    getState: () => state,
    destroy() {
      if (destroyed) return
      destroyed = true
      clearInterval(interval)
      unsubscribe()
      clearCard()
      root.removeEventListener('keydown', keyboard)
      document.removeEventListener('visibilitychange', visibility)
      root.replaceChildren()
      root.removeAttribute('data-ns-live-player')
      // The adapter borrows its transport; its connection owner releases the socket.
    },
  }
}
module.exports = { mountLivePlayer }

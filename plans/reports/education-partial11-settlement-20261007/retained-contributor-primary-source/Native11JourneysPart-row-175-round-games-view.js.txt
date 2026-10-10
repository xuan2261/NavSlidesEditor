const { node, listen, button } = require('../dom.js')

// DOM lifecycle shared only by Relay, Trivia and Scatter presenters; the session owns every timer/listener.
function createRoundGamesView({ root, session, reset, clock }) {
  const document = root.ownerDocument,
    ui = root.querySelector('[data-ns-game-ui]')
  let identity,
    body,
    status,
    timer,
    dispose = [],
    cancelDeadline,
    cancelTick,
    scheduledKey
  const scoped = {
    getState: session.getState,
    own: (cleanup) => {
      const release = session.own(cleanup)
      dispose.push(typeof release === 'function' ? release : cleanup)
      return release
    },
  }
  function build(key) {
    if (identity === key) return false
    identity = key
    for (const cleanup of dispose.splice(0)) cleanup()
    ui.replaceChildren()
    body = node(document, 'div')
    status = node(document, 'p', '', { role: 'status', 'aria-live': 'polite' })
    timer = node(document, 'p', '', { role: 'timer', 'aria-label': 'Time remaining' })
    const replay = button(document, 'Reset', 'reset')
    listen(scoped, replay, 'click', reset)
    ui.append(body, timer, status, replay)
    return true
  }
  function schedule(state, due, command, render) {
    const key =
      due === null
        ? null
        : JSON.stringify([state.generation, state.turn ?? state.round, state.phase, due])
    if (scheduledKey === key) return
    cancelDeadline?.()
    cancelTick?.()
    scheduledKey = key
    if (key === null) return
    const captured = { ...command }
    function fireDeadline() {
      const remaining = due - clock.now()
      if (remaining > 0) {
        cancelDeadline = session.schedule(fireDeadline, remaining)
        return
      }
      session.dispatch(captured)
      render(session.getState())
    }
    cancelDeadline = session.schedule(fireDeadline, Math.max(0, due - clock.now()))
    function tick() {
      timer.textContent = `${Math.max(0, Math.ceil((due - clock.now()) / 1000))} seconds remaining`
      if (clock.now() < due) cancelTick = session.schedule(tick, Math.min(250, due - clock.now()))
    }
    tick()
  }
  return {
    document,
    session: scoped,
    build,
    schedule,
    get body() {
      return body
    },
    feedback: (text) => {
      status.textContent = text
    },
    timer: (due) => {
      timer.textContent =
        due === null
          ? ''
          : `${Math.max(0, Math.ceil((due - clock.now()) / 1000))} seconds remaining`
    },
    control(label, command, action, parent = body) {
      const control = button(document, label, command)
      listen(scoped, control, 'click', action)
      parent.append(control)
      return control
    },
  }
}
module.exports = { createRoundGamesView }

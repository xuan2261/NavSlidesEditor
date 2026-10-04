const { node, button, listen } = require('./dom.js')
const controls = {
  'name-picker': [['pick', 'Pick name']],
  poll: [
    ['startPoll', 'Start poll'],
    ['reveal', 'Reveal results'],
  ],
  'word-cloud': [
    ['startWordCloud', 'Start word cloud'],
    ['reveal', 'Reveal words'],
    ['clear', 'Clear words'],
  ],
  matching: [
    ['startMatching', 'Start matching'],
    ['reveal', 'Reveal matches'],
  ],
  'hot-potato': [
    ['nextQuestion', 'Next question'],
    ['reveal', 'Reveal answer'],
  ],
  quiz: [
    ['nextQuestion', 'Start / next question'],
    ['reveal', 'Reveal answer'],
  ],
  'four-corners': [
    ['start', 'Start / next corners'],
    ['reveal', 'Reveal corners'],
  ],
  'relay-race': [
    ['start', 'Start relay'],
    ['pass', 'Pass baton'],
  ],
  'trivia-champ': [
    ['start', 'Start trivia'],
    ['reveal', 'Reveal answer'],
    ['next', 'Next question'],
  ],
  scattergories: [
    ['start', 'Start letter round'],
    ['reveal', 'Close and review'],
  ],
  jeopardy: [['reveal', 'Reveal answer']],
}
function presentLiveHost({ root, config, session, transport }) {
  const document = root.ownerDocument,
    ui = root.querySelector('[data-ns-game-ui]'),
    type = root.dataset.nsGameType
  const tuple = {
    effectiveSlideId: root.closest('[data-ns-effective-slide-id]').dataset.nsEffectiveSlideId,
    elementId: root.dataset.nsElementId,
  }
  const status = node(document, 'p', undefined, { role: 'status', 'aria-live': 'polite' }),
    title = node(document, 'h3', config.prompt || config.title || 'Live activity')
  const primary = node(document, 'div'),
    dynamic = node(document, 'div'),
    results = node(document, 'pre')
  const binding = transport.getHostBinding(tuple),
    join = node(document, 'a', 'Learner join link', {
      href: `/game/join?gameId=${encodeURIComponent(binding.transportGameId)}`,
      'data-ns-learner-join': '',
    })
  const dispatch = (action, fields = {}) => transport.dispatch(tuple, { action, ...fields })
  const buttons = [...(controls[type] || []), ['reset', 'Replay'], ['end', 'End game']].map(
    ([action, label]) => {
      const control = button(document, label, action)
      listen(session, control, 'click', () => dispatch(action))
      return control
    }
  )
  primary.append(...buttons)
  ui.replaceChildren(
    node(document, 'small', 'Live host — server authority'),
    status,
    title,
    join,
    primary,
    dynamic,
    results
  )
  session.own(() => ui.replaceChildren())
  let dynamicCleanup = [],
    latest
  function clearDynamic() {
    for (const cleanup of dynamicCleanup) cleanup()
    dynamicCleanup = []
    dynamic.replaceChildren()
  }
  function control(label, action, fields) {
    const element = button(document, label, action),
      handler = () => dispatch(action, fields)
    element.disabled = latest.connection !== 'connected'
    element.addEventListener('click', handler)
    dynamicCleanup.push(() => element.removeEventListener('click', handler))
    dynamic.append(element)
    return element
  }
  function input(label, type, initial) {
    const wrapper = node(document, 'label', label),
      element = node(document, 'input', undefined, { type })
    element.value = initial
    wrapper.append(element)
    dynamic.append(wrapper)
    return element
  }
  function renderDynamic(state) {
    clearDynamic()
    if (state.rosterWindow && state.teams?.length) {
      for (const player of state.players || [])
        if (!player.isHost && player.pending && !player.teamId)
          for (const team of state.teams) {
            const assign = control(
              `${player.name} → ${team.name}${player.teamId === team.id ? ' (assigned)' : ''}`,
              'assignTeam',
              { playerId: player.playerId, teamId: team.id }
            )
            assign.dataset.nsPlayerId = player.playerId
            assign.dataset.nsTeamId = team.id
          }
    }
    if (type === 'trivia-champ') {
      for (const mode of ['normal', 'lightning', 'jackpot'])
        if (mode === 'normal' || config[`${mode}Round`]?.enabled) control(mode, 'bonus', { mode })
    }
    if (type === 'scattergories') {
      if (config.letterMode !== 'random' && ['waiting', 'setup', 'review'].includes(state.phase)) {
        const letter = input('Round letter', 'text', config.letter || 'A'),
          start = button(document, 'Start selected letter', 'start')
        const handler = () => dispatch('start', { letter: letter.value })
        start.disabled = latest.connection !== 'connected'
        start.addEventListener('click', handler)
        dynamicCleanup.push(() => start.removeEventListener('click', handler))
        dynamic.append(start)
      }
      for (const submission of state.revealed?.submissions || [])
        for (const entry of submission.entries) {
          dynamic.append(
            node(document, 'p', `${submission.teamId} · ${entry.categoryId}: ${entry.text}`)
          )
          for (const valid of [true, false])
            control(valid ? 'Valid meaning' : 'Invalid meaning', 'adjudicate', {
              submissionId: submission.submissionId,
              categoryId: entry.categoryId,
              valid,
            })
        }
    }
    if (type === 'jeopardy') {
      if (state.phase === 'board' || state.phase === 'waiting')
        for (const cell of state.jeopardy?.cells || [])
          if (!cell.used) {
            for (const team of state.teams || [])
              control(`${cell.categoryId} ${cell.points} · ${team.name}`, 'select', {
                cellId: cell.cellId,
                teamId: team.id,
              })
          }
      if (state.phase === 'wager') {
        const wager = input(
          `Wager (${state.jeopardy.wagerLimits.min}–${state.jeopardy.wagerLimits.max})`,
          'number',
          state.jeopardy.wagerLimits.defaultWager
        )
        const submit = button(document, 'Submit wager', 'wager'),
          handler = () => dispatch('wager', { amount: Number(wager.value) })
        submit.disabled = latest.connection !== 'connected'
        submit.addEventListener('click', handler)
        dynamicCleanup.push(() => submit.removeEventListener('click', handler))
        dynamic.append(submit)
      }
      if (state.revealed && state.phase === 'question')
        for (const correct of [true, false])
          control(correct ? 'Correct' : 'Incorrect', 'adjudicate', { correct })
    }
  }
  session.own(clearDynamic)
  function render(snapshot) {
    latest = snapshot
    const connected = snapshot.connection === 'connected',
      state = snapshot.state || {}
    status.textContent = connected
      ? state.commandError || 'Connected — server authoritative'
      : 'Waiting for server; local scoring disabled'
    for (const control of buttons) control.disabled = !connected
    title.textContent = state.question?.prompt || config.prompt || config.title || 'Live activity'
    renderDynamic(state)
    results.textContent = JSON.stringify(state, null, 2)
  }
  return { render }
}
module.exports = { presentLiveHost }

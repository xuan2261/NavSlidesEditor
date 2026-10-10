const { node, listen, button } = require('./dom.js')
const { setCardContent } = require('./card-content-dom.js')

function presentMemory({ root, config, session, reset }) {
  const document = root.ownerDocument,
    ui = root.querySelector('[data-ns-game-ui]')
  const heading = node(document, 'h3', config.title)
  const label = node(document, 'small', 'Local classroom — one device')
  const grid = node(document, 'div', undefined, {
    class: 'ns-memory-grid',
    'aria-label': 'Memory cards',
  })
  grid.style.display = 'grid'
  grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(min(100%, 100px), 1fr))'
  grid.style.gap = '8px'
  const status = node(document, 'div', '', {
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': 'true',
  })
  const progress = node(document, 'output', '', { 'data-ns-memory-progress': '' })
  const reveal = button(document, 'Reveal all', 'reveal'),
    replay = button(document, 'Reset', 'reset')
  const controls = node(document, 'div', undefined, { class: 'ns-game-controls' })
  controls.append(reveal, replay)
  ui.replaceChildren(heading, label, progress, grid, status, controls)
  const cards = new Map()
  for (const card of session.getState().cards) {
    const control = button(document, '', `card:${card.id}`)
    control.dataset.nsMemoryCard = card.id
    control.style.minHeight = '64px'
    const concealed = node(document, 'span'),
      face = node(document, 'span')
    control.append(concealed, face)
    cards.set(card.id, { control, concealed, face, visible: undefined })
    listen(session, control, 'click', () => session.dispatch({ type: 'flip', cardId: card.id }))
  }
  listen(session, reveal, 'click', () => session.dispatch({ type: 'reveal' }))
  listen(session, replay, 'click', reset)
  let scheduledKey,
    cancelMismatch,
    lastOrder,
    lastAttempts = 0,
    lastMatches = 0
  session.own(() => {
    cancelMismatch?.()
    ui.replaceChildren()
  })
  function render(state) {
    if (state.order !== lastOrder) {
      grid.replaceChildren(...state.order.map((id) => cards.get(id).control))
      lastOrder = state.order
    }
    const focused = document.activeElement
    for (const [index, id] of state.order.entries()) {
      const card = state.cards.find((item) => item.id === id),
        entry = cards.get(id)
      const matched = state.matchedPairIds.includes(card.pairId)
      const visible = state.revealMode || matched || state.faceUp.includes(id)
      entry.control.disabled =
        state.paused || state.revealMode || matched || Boolean(state.pendingMismatch)
      entry.control.setAttribute(
        'aria-label',
        visible
          ? `Card ${index + 1}, ${card.content.type === 'text' ? card.content.text : card.content.alt}${matched ? ', matched' : ', face up'}`
          : `Card ${index + 1}, face down`
      )
      entry.control.setAttribute('aria-pressed', String(visible))
      entry.control.dataset.nsCardState = matched ? 'matched' : visible ? 'face-up' : 'face-down'
      entry.concealed.textContent = `Card ${index + 1}, face down`
      entry.concealed.hidden = visible
      if (entry.visible !== visible) {
        setCardContent(entry.face, card.content, visible)
        entry.visible = visible
      }
    }
    reveal.disabled = state.revealMode
    progress.textContent = `${state.matchedPairIds.length} / ${config.pairs.length} pairs matched · ${state.attempts} attempts · ${state.score} points`
    if (state.revealMode)
      status.textContent = 'Practice view: all cards revealed. No points awarded. Reset to play.'
    else if (state.matchedPairIds.length > lastMatches)
      status.textContent =
        state.matchedPairIds.length === config.pairs.length
          ? `All pairs matched. ${state.score} points.`
          : `Pair matched. ${state.score} points.`
    else if (state.pendingMismatch)
      status.textContent = 'No match. Wait for these cards to turn face down.'
    else if (state.attempts > lastAttempts || (scheduledKey && !state.pendingMismatch))
      status.textContent = 'No match. Choose another pair.'
    else if (!state.attempts)
      status.textContent = state.faceUp.length ? 'Choose a second card.' : 'Choose a card.'
    lastAttempts = state.attempts
    lastMatches = state.matchedPairIds.length
    const pending = state.pendingMismatch
    const key = pending && !state.paused ? `${pending.generation}:${pending.token}` : null
    if (key !== scheduledKey) {
      cancelMismatch?.()
      cancelMismatch = undefined
      scheduledKey = key
      if (pending && key)
        cancelMismatch = session.schedule(
          () =>
            session.dispatch({
              type: 'mismatch-expired',
              generation: pending.generation,
              token: pending.token,
            }),
          pending.remainingMs
        )
    }
    if (root.contains(focused) && focused.disabled) {
      const target =
        state.order.map((id) => cards.get(id).control).find((control) => !control.disabled) ||
        (!reveal.disabled ? reveal : replay)
      target.focus()
    }
  }
  return { render }
}

module.exports = { presentMemory }

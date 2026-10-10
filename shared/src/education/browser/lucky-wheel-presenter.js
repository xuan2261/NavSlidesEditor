const { node, listen, button } = require('./dom.js')
const { wheel, confetti } = require('./games/picker-visuals.js')
const { createPickerProbabilities } = require('./picker-probabilities.js')

function presentLuckyWheel({ root, config, session, reset }) {
  const document = root.ownerDocument,
    ui = root.querySelector('[data-ns-game-ui]')
  const heading = node(document, 'h3', config.title)
  const label = node(document, 'small', 'Local classroom — one device')
  const display = wheel(document, {
    items: config.items,
    wheelSegments: config.items.length,
    wheelColors: ['#6366f1', '#2563eb', '#059669', '#d97706', '#dc2626', '#9333ea'],
  })
  const winner = node(document, 'output', '', {
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': 'true',
    'data-ns-winner': '',
  })
  const remaining = node(document, 'p', '', { 'data-ns-wheel-remaining': '' })
  const prizes = node(document, 'ul', undefined, { 'aria-label': 'Prizes' })
  const entries = config.items.map((item) => {
    const entry = node(document, 'li', `${item.label} · weight ${item.weight ?? 1}`)
    prizes.append(entry)
    return [item.id, entry]
  })
  const probabilities = createPickerProbabilities(document, config)
  const spin = button(document, 'Spin', 'spin'),
    replay = button(document, 'Reset', 'reset')
  const controls = node(document, 'div', undefined, { class: 'ns-game-controls' })
  controls.append(spin, replay)
  ui.replaceChildren(
    heading,
    label,
    display.stage,
    winner,
    remaining,
    prizes,
    probabilities.element,
    controls
  )
  session.own(() => ui.replaceChildren())
  const reducedMotion =
    document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  let angle = 0,
    celebratedTurn = 0
  listen(session, replay, 'click', reset)
  listen(session, spin, 'click', () => {
    const before = session.getState(),
      after = session.dispatch({ type: 'spin' })
    if (after === before || after.phase !== 'spinning') return
    const command = { type: 'finish', turn: after.turn, generation: after.generation }
    if (reducedMotion || config.animationDuration === 0) session.dispatch(command)
    else session.schedule(() => session.dispatch(command), config.animationDuration)
  })
  function render(state) {
    spin.disabled = state.phase !== 'idle' || !state.poolIds.length
    spin.textContent = state.phase === 'spinning' ? 'Spinning…' : 'Spin'
    const message =
      state.phase === 'spinning' ? 'Spinning…' : state.result?.label || 'Spin to choose a prize.'
    if (winner.textContent !== message) winner.textContent = message
    remaining.textContent = state.poolIds.length
      ? `${state.poolIds.length} prizes available`
      : 'No prizes left. Reset to spin again.'
    const available = new Set(state.poolIds)
    probabilities.render(available)
    for (const [id, entry] of entries) {
      entry.style.opacity = available.has(id) ? '1' : '.5'
      entry.setAttribute(
        'aria-label',
        `${entry.textContent}${available.has(id) ? '' : ' · picked'}`
      )
    }
    if (state.phase === 'spinning' && state.wheelAngle !== angle) {
      display.svg.style.setProperty('--ns-spin-from', `${angle}deg`)
      display.svg.style.setProperty('--ns-spin-to', `${state.wheelAngle}deg`)
      display.svg.style.animation = 'none'
      if (!reducedMotion) {
        void display.svg.getBoundingClientRect()
        display.svg.style.animation = `ns-picker-spin ${config.animationDuration}ms ease-out forwards`
      } else display.svg.style.transform = `rotate(${state.wheelAngle}deg)`
      angle = state.wheelAngle
    }
    for (const group of display.svg.children)
      group.style.opacity = available.has(group.dataset.nsPickerItem) ? '1' : '.3'
    if (state.result && state.phase !== 'spinning' && celebratedTurn !== state.turn) {
      celebratedTurn = state.turn
      ui.querySelector('.ns-picker-confetti')?.remove()
      if (config.showConfetti && !reducedMotion) ui.append(confetti(document))
    }
  }
  return { render }
}
module.exports = { presentLuckyWheel }

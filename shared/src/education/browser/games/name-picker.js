const { node, listen, button } = require('../dom.js')
const { wheel, dice, confetti } = require('./picker-visuals.js')
const { createPickerProbabilities } = require('../picker-probabilities.js')
function presentNamePicker({ root, config, session, reset }) {
  const document = root.ownerDocument
  const ui = root.querySelector('[data-ns-game-ui]')
  const heading = node(document, 'h3', 'Name Picker')
  const label = node(document, 'small', 'Local classroom — one device')
  const mode = node(document, 'select', undefined, { 'aria-label': 'Picker mode' })
  for (const value of ['wheel', 'dice', 'button'])
    mode.append(node(document, 'option', value, { value }))
  const visual = node(document, 'div', undefined, { class: 'ns-picker-visual' })
  const winner = node(document, 'output', undefined, {
    'aria-live': 'polite',
    'data-ns-winner': '',
  })
  const remaining = node(document, 'small')
  const probabilities = createPickerProbabilities(document, config)
  const pick = button(document, 'Spin', 'pick'),
    replay = button(document, 'Reset', 'reset')
  const controls = node(document, 'div', undefined, { class: 'ns-game-controls' })
  controls.append(mode, pick, replay)
  ui.replaceChildren(heading, label, visual, winner, remaining, probabilities.element, controls)
  session.own(() => ui.replaceChildren())
  let visualMode,
    wheelSvg,
    lastAngle = 0,
    lastResult
  function render(state) {
    mode.value = state.mode
    mode.disabled = state.phase === 'picking'
    pick.disabled = state.phase === 'picking' || state.phase === 'exhausted'
    pick.textContent =
      state.phase === 'picking'
        ? 'Picking…'
        : { wheel: 'Spin', dice: 'Roll', button: 'Pick' }[state.mode]
    winner.textContent =
      state.lastWinner?.label ||
      (state.phase === 'picking'
        ? 'Picking…'
        : state.phase === 'exhausted'
          ? 'No choices left. Reset to pick again.'
          : 'Choose a name')
    remaining.textContent = `${config.items.length - state.excludedIds.length} names available • ${state.picks} picks`
    const excluded = new Set(state.excludedIds)
    probabilities.render(
      new Set(config.items.filter((item) => !excluded.has(item.id)).map((item) => item.id))
    )
    if (visualMode !== state.mode) {
      visualMode = state.mode
      if (state.mode === 'wheel') {
        const display = wheel(document, config)
        wheelSvg = display.svg
        visual.replaceChildren(display.stage)
      } else if (state.mode === 'button')
        visual.replaceChildren(
          node(document, 'div', 'Choose the next name', { class: 'ns-picker-button-display' })
        )
    }
    if (state.mode === 'wheel') {
      if (state.phase === 'picking' && state.wheelAngle !== lastAngle) {
        wheelSvg.style.setProperty('--ns-spin-from', `${lastAngle}deg`)
        wheelSvg.style.setProperty('--ns-spin-to', `${state.wheelAngle}deg`)
        wheelSvg.style.animation = 'none'
        void wheelSvg.getBoundingClientRect()
        wheelSvg.style.animation = `ns-picker-spin ${config.animationDuration}ms ease-out forwards`
        lastAngle = state.wheelAngle
      }
      for (const group of wheelSvg.children)
        group.style.opacity = state.excludedIds.includes(group.dataset.nsPickerItem) ? '.25' : '1'
    } else if (state.mode === 'dice')
      visual.replaceChildren(dice(document, config.diceCount, state.diceValues))
    if (config.showConfetti && state.lastWinner && lastResult !== state.picks) {
      lastResult = state.picks
      ui.querySelector('.ns-picker-confetti')?.remove()
      ui.append(confetti(document))
    }
  }
  listen(session, mode, 'change', () => session.dispatch({ type: 'mode', mode: mode.value }))
  listen(session, replay, 'click', reset)
  listen(session, pick, 'click', () => {
    const state = session.dispatch({ type: 'pick' })
    if (state.phase !== 'picking') return
    if (config.animationDuration === 0) session.dispatch({ type: 'resolve' })
    else session.schedule(() => session.dispatch({ type: 'resolve' }), config.animationDuration)
  })
  return { render }
}
module.exports = { presentNamePicker }

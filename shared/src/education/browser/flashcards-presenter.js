const { node, listen, button } = require('./dom.js')
const { setCardContent } = require('./card-content-dom.js')
const { getFlashcardsProgress } = require('../flashcards-state.js')

function presentFlashcards({ root, config, session, reset }) {
  const document = root.ownerDocument,
    ui = root.querySelector('[data-ns-game-ui]')
  const heading = node(document, 'h3', config.title)
  const label = node(document, 'small', 'Local classroom — one device')
  const board = node(document, 'div', undefined, { class: 'ns-flashcard' })
  const front = node(document, 'div', undefined, { role: 'group', 'aria-label': 'Card front' })
  const back = node(document, 'div', undefined, { role: 'group', 'aria-label': 'Card back' })
  board.append(front, back)
  const progress = node(document, 'output', '', { 'data-ns-flashcards-progress': '' })
  const status = node(document, 'div', '', {
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': 'true',
  })
  const flip = button(document, 'Flip', 'flip'),
    previous = button(document, 'Previous', 'previous')
  const next = button(document, 'Next', 'next'),
    shuffle = button(document, 'Shuffle', 'shuffle')
  const replay = button(document, 'Reset', 'reset')
  const controls = node(document, 'div', undefined, { class: 'ns-game-controls' })
  controls.append(flip, previous, next, shuffle, replay)
  ui.replaceChildren(heading, label, board, progress, status, controls)
  session.own(() => ui.replaceChildren())
  let currentId,
    side,
    announcement = ''
  for (const [control, type] of [
    [flip, 'flip'],
    [previous, 'previous'],
    [next, 'next'],
    [shuffle, 'shuffle'],
  ]) {
    listen(session, control, 'click', () => {
      announcement = type === 'shuffle' ? 'Cards shuffled. ' : ''
      const before = session.getState(),
        after = session.dispatch({ type })
      if (after === before) render(after)
    })
  }
  listen(session, replay, 'click', reset)
  function render(state) {
    const id = state.order[state.currentIndex],
      card = state.cards.find((item) => item.id === id)
    const { position, total, studied } = getFlashcardsProgress(state)
    if (currentId !== id || side !== state.side) {
      setCardContent(front, card.front, state.side === 'front')
      setCardContent(back, card.back, state.side === 'back')
      currentId = id
      side = state.side
    }
    const focused = document.activeElement
    previous.disabled = state.currentIndex === 0
    next.disabled = state.currentIndex === state.order.length - 1
    shuffle.disabled = total < 2
    flip.setAttribute(
      'aria-label',
      `Show ${state.side === 'front' ? 'back' : 'front'} of card ${position}`
    )
    flip.setAttribute('aria-pressed', String(state.side === 'back'))
    progress.textContent = `Card ${position} / ${total} · ${studied} / ${total} studied`
    status.textContent = `${announcement}${state.side === 'front' ? 'Front' : 'Back'} of card ${position}. ${studied} of ${total} studied.`
    announcement = ''
    if (root.contains(focused) && focused.disabled) flip.focus()
  }
  return { render }
}

module.exports = { presentFlashcards }

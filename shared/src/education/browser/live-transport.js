const { node } = require('./dom.js')
function presentLiveObserver({ root, config, session }) {
  const document = root.ownerDocument,
    ui = root.querySelector('[data-ns-game-ui]')
  const label = node(document, 'small', 'Live — server authority')
  const status = node(document, 'p', undefined, { role: 'status', 'aria-live': 'polite' })
  const prompt = node(document, 'h3'),
    options = node(document, 'ul')
  ui.replaceChildren(label, status, prompt, options)
  session.own(() => ui.replaceChildren())
  function render(snapshot) {
    status.textContent =
      snapshot.connection === 'connected'
        ? 'Live observer'
        : snapshot.connection === 'disconnected'
          ? 'Disconnected — waiting for server; local scoring disabled'
          : 'Waiting for live connection; local scoring disabled'
    const question = snapshot.state?.question || snapshot.state?.currentQuestion
    prompt.textContent = question?.prompt || config.prompt || config.title || 'Live activity'
    const rows = Array.isArray(question?.options) ? question.options : []
    options.replaceChildren(...rows.map((option) => node(document, 'li', option.text)))
  }
  return { render }
}
function subscribeLive(session, root, transport) {
  if (!transport) return
  const tuple = {
    effectiveSlideId: root.closest('[data-ns-effective-slide-id]')?.dataset.nsEffectiveSlideId,
    elementId: root.dataset.nsElementId,
  }
  const generation = session.getState().generation
  const unsubscribe = transport.subscribe(tuple, (event) =>
    session.dispatch(
      {
        type: 'transport',
        connection: event.connection,
        ...(event.state === undefined ? {} : { state: structuredClone(event.state) }),
      },
      generation
    )
  )
  if (typeof unsubscribe !== 'function')
    throw new Error('Live transport must return an unsubscribe function')
  session.own(unsubscribe)
}
module.exports = { presentLiveObserver, subscribeLive }

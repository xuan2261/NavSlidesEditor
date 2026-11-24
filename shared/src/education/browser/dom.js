function node(document, tag, text, attributes = {}) {
  const element = document.createElement(tag)
  if (text !== undefined) element.textContent = text
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value)
  return element
}
function listen(session, element, event, handler) {
  const generation = session.getState().generation
  const listener = (...args) => {
    if (session.getState().generation === generation) handler(...args)
  }
  element.addEventListener(event, listener)
  session.own(() => element.removeEventListener(event, listener))
}
function button(document, label, command) {
  return node(document, 'button', label, { type: 'button', 'data-ns-command': command })
}
module.exports = { node, listen, button }

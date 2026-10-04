const { cloneCardContent } = require('../card-content.js')
const { node } = require('./dom.js')

function createCardContent(document, content) {
  const safe = cloneCardContent(content)
  if (safe.type === 'text') return node(document, 'span', safe.text)
  const image = node(document, 'img', undefined, { src: safe.src, alt: safe.alt })
  image.style.maxWidth = '100%'
  image.style.maxHeight = '100%'
  image.style.objectFit = 'contain'
  image.draggable = false
  return image
}

function setCardContent(container, content, visible) {
  container.hidden = !visible
  container.inert = !visible
  if (visible) {
    container.removeAttribute('aria-hidden')
    container.replaceChildren(createCardContent(container.ownerDocument, content))
  } else {
    container.setAttribute('aria-hidden', 'true')
    container.replaceChildren()
  }
}

module.exports = { createCardContent, setCardContent }

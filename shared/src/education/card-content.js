const { createValidation, throwInvalid } = require('./game-validation-utils.js')

function cloneCardContent(content) {
  const v = createValidation()
  v.content(content, ['content'])
  if (
    content?.type === 'image' &&
    /^data:/i.test(content.src || '') &&
    !/^data:image\//i.test(content.src)
  ) {
    v.add(['content', 'src'], 'Use an image URL, not audio or video data')
  }
  throwInvalid(v.errors, 'Card content')
  return content.type === 'text'
    ? { type: 'text', text: content.text }
    : { type: 'image', src: content.src.trim(), alt: content.alt }
}

function shuffleCardIds(ids, random = Math.random) {
  const order = [...ids]
  for (let i = order.length - 1; i > 0; i--) {
    const draw = random()
    if (typeof draw !== 'number' || !Number.isFinite(draw) || draw < 0 || draw >= 1) {
      throw new Error('Card random must return a finite number in [0, 1)')
    }
    const j = Math.floor(draw * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

module.exports = { cloneCardContent, shuffleCardIds }

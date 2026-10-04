const { node, listen } = require('./dom.js')
const { projectPublicQuestion } = require('../question-public-projection.js')
const { validateAnswerPayload } = require('../question-answer-payload.js')

function createQuizHotspotControls({ document, question, session }) {
  const publicQuestion = projectPublicQuestion(question)
  const element = node(document, 'fieldset')
  element.append(node(document, 'legend', 'Choose a point on the image or a named region'))
  const image = node(document, 'img', undefined, publicQuestion.media)
  image.style.cssText =
    'display:block;width:100%;max-height:320px;object-fit:contain;object-position:center;cursor:crosshair;touch-action:manipulation'
  const label = node(document, 'label', 'Named region ')
  const select = node(document, 'select', undefined, { 'aria-label': 'Named region' })
  select.append(node(document, 'option', 'Choose a region', { value: '' }))
  for (const option of publicQuestion.options)
    select.append(node(document, 'option', option.text, { value: option.id }))
  label.append(select)
  const selected = node(document, 'output', '', { 'aria-live': 'polite' })
  element.append(image, label, selected)
  let point = null
  listen(session, select, 'change', () => {
    point = null
    selected.textContent = ''
  })
  listen(session, image, 'pointerdown', (event) => {
    if (element.disabled || !image.naturalWidth || !image.naturalHeight) return
    const bounds = image.getBoundingClientRect()
    const scale = Math.min(bounds.width / image.naturalWidth, bounds.height / image.naturalHeight)
    const width = image.naturalWidth * scale,
      height = image.naturalHeight * scale
    if (!width || !height) return
    const x = (event.clientX - bounds.left - (bounds.width - width) / 2) / width
    const y = (event.clientY - bounds.top - (bounds.height - height) / 2) / height
    if (x < 0 || x > 1 || y < 0 || y > 1) return
    point = { mode: 'point', x, y }
    select.value = ''
    selected.textContent = `Selected point: ${Math.round(x * 100)}%, ${Math.round(y * 100)}%`
  })
  function setAnswer(answer) {
    const errors = []
    validateAnswerPayload(publicQuestion, answer, ['answer'], errors)
    if (errors.length) return false
    if (answer.mode === 'point') {
      point = { mode: 'point', x: answer.x, y: answer.y }
      select.value = ''
      selected.textContent = `Selected point: ${Math.round(point.x * 100)}%, ${Math.round(point.y * 100)}%`
    } else {
      point = null
      select.value = answer.regionId
      selected.textContent = ''
    }
    return true
  }
  return {
    element,
    getAnswer: () => (point ? { ...point } : { mode: 'region', regionId: select.value }),
    setAnswer,
  }
}

module.exports = { createQuizHotspotControls }

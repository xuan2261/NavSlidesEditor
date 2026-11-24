const { node } = require('./dom.js')
const { projectPublicQuestion } = require('../question-public-projection.js')
const { createQuizHotspotControls } = require('./quiz-hotspot-controls.js')
const { createAssignmentControls, createOrderingControls } = require('./assignment-controls.js')
const { validateAnswerPayload } = require('../question-answer-payload.js')
const { createAssignmentState, reduceAssignment } = require('../assignment-state.js')

function appendItem(document, parent, item) {
  parent.append(node(document, 'span', item.text))
  if (item.media) {
    const image = node(document, 'img', undefined, item.media)
    image.style.cssText = 'max-width:100%;max-height:160px;object-fit:contain'
    parent.append(image)
  }
}

function createQuizAnswerControls({ document, question, session }) {
  const q = projectPublicQuestion(question)
  if (q.kind === 'image-hotspot')
    return createQuizHotspotControls({ document, question: q, session })
  const element = node(document, 'fieldset')
  element.append(node(document, 'legend', 'Your answer'))
  let getAnswer, applyAnswer, assignment
  const rows = (items) =>
    items.map(({ id, text, media }) => ({ id, label: text, ...(media ? { media } : {}) }))
  if (['single-choice', 'multi-choice', 'true-false'].includes(q.kind)) {
    const multiple = q.kind === 'multi-choice'
    const options =
      q.kind === 'true-false'
        ? [
            { id: 'true', text: 'True' },
            { id: 'false', text: 'False' },
          ]
        : q.options
    const inputs = options.map((option) => {
      const label = node(document, 'label')
      label.style.cssText = 'display:block;min-height:24px'
      const input = node(document, 'input', undefined, {
        type: multiple ? 'checkbox' : 'radio',
        name: `quiz-${q.id}`,
        value: option.id,
      })
      label.append(input)
      appendItem(document, label, option)
      element.append(label)
      return input
    })
    getAnswer = () => {
      const selected = inputs.filter((input) => input.checked).map((input) => input.value)
      if (multiple) return { optionIds: selected }
      if (q.kind === 'true-false')
        return { value: selected.length ? selected[0] === 'true' : undefined }
      return { optionId: selected[0] }
    }
    applyAnswer = (answer) => {
      for (const input of inputs)
        input.checked = multiple
          ? answer.optionIds.includes(input.value)
          : q.kind === 'true-false'
            ? input.value === String(answer.value)
            : input.value === answer.optionId
      return true
    }
  } else if (q.kind === 'fill-blank') {
    const label = node(document, 'label', 'Answer ')
    const input = node(document, 'input', undefined, { type: 'text', autocomplete: 'off' })
    label.append(input)
    element.append(label)
    getAnswer = () => ({ text: input.value })
    applyAnswer = (answer) => {
      input.value = answer.text
      return true
    }
  } else if (q.kind === 'ordering') {
    assignment = createOrderingControls({ document, items: rows(q.options), session })
    element.append(assignment.element)
    getAnswer = assignment.getAnswer
    applyAnswer = (answer) => assignment.setAnswer(answer)
  } else if (q.kind === 'matching') {
    assignment = createAssignmentControls({
      document,
      sources: rows(q.options.left),
      targets: rows(q.options.right),
      bijection: true,
      session,
    })
    element.append(assignment.element)
    getAnswer = () => ({
      pairs: assignment
        .getAnswer()
        .map(({ sourceId, targetId }) => ({ leftId: sourceId, rightId: targetId })),
    })
    applyAnswer = (answer) => {
      if (!Array.isArray(answer?.pairs)) return false
      const config = {
        sourceIds: q.options.left.map((item) => item.id),
        targetIds: q.options.right.map((item) => item.id),
        bijection: true,
      }
      let draft = createAssignmentState()
      const sources = new Set()
      for (const pair of answer.pairs) {
        if (!pair || sources.has(pair.leftId)) return false
        sources.add(pair.leftId)
        draft = reduceAssignment(config, draft, {
          type: 'assign',
          sourceId: pair.leftId,
          targetId: pair.rightId,
        })
        if (draft.error) return false
      }
      assignment.cancel()
      assignment.render(draft)
      return true
    }
  }
  return {
    element,
    getAnswer,
    setAnswer: (answer) => {
      if (q.kind !== 'matching') {
        const errors = []
        validateAnswerPayload(q, answer, ['answer'], errors)
        if (errors.length) return false
      }
      return applyAnswer(answer)
    },
    cancel: () => assignment?.cancel(),
    destroy: () => assignment?.destroy(),
    setDisabled: (disabled) => {
      element.disabled = disabled
      if (q.kind === 'matching') assignment.render(assignment.getState(), { disabled })
      if (disabled) assignment?.cancel()
    },
  }
}

module.exports = { createQuizAnswerControls }

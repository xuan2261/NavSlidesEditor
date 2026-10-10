const { cloneValue } = require('./question-shape.js')

const SAMPLE_HOTSPOT_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#e2e8f0"/><rect x="50" y="50" width="100" height="100" fill="#2563eb"/><text x="100" y="105" text-anchor="middle" fill="white" font-size="16">Target</text></svg>'

function createCanonicalQuestion(overrides = {}) {
  const id = overrides.id ?? globalThis.crypto.randomUUID()
  const kind = overrides.kind ?? 'single-choice'
  const question = {
    id,
    kind,
    prompt: 'Question',
    points: 10,
    timeLimit: null,
    feedback: { correct: '', incorrect: '', explanation: '' },
  }
  const item = (side, index, text) => ({ id: `${id}/${side}-${index}`, text })
  if (['single-choice', 'multi-choice', 'ordering'].includes(kind)) {
    question.options = [item('option', 1, 'Option A'), item('option', 2, 'Option B')]
  } else if (kind === 'matching') {
    question.options = {
      left: [item('left', 1, 'Left item')],
      right: [item('right', 1, 'Right item')],
    }
  } else if (kind === 'image-hotspot') {
    question.media = {
      src: `data:image/svg+xml;base64,${globalThis.btoa(SAMPLE_HOTSPOT_SVG)}`,
      alt: 'Blue target square in the center of a gray image',
    }
    question.options = [item('option', 1, 'Target'), item('option', 2, 'Elsewhere')]
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) question[key] = cloneValue(value)
  }
  question.feedback = {
    correct: '',
    incorrect: '',
    explanation: '',
    ...cloneValue(overrides.feedback),
  }
  if (overrides.answerKey === undefined) {
    switch (kind) {
      case 'single-choice':
        question.answerKey = { optionId: question.options?.[0]?.id }
        break
      case 'multi-choice':
        question.answerKey = { optionIds: [question.options?.[0]?.id] }
        break
      case 'true-false':
        question.answerKey = { value: true }
        break
      case 'fill-blank':
        question.answerKey = { accepted: ['Answer'], caseSensitive: false }
        break
      case 'ordering':
        question.answerKey = { itemIds: question.options?.map((option) => option.id) }
        break
      case 'matching':
        question.answerKey = {
          pairs: question.options?.left?.map((left, index) => ({
            leftId: left.id,
            rightId: question.options.right?.[index]?.id,
          })),
        }
        break
      case 'image-hotspot':
        question.answerKey = {
          regions: [
            {
              id: question.options?.[0]?.id,
              shape: 'rect',
              x: 0.25,
              y: 0.25,
              width: 0.5,
              height: 0.5,
            },
          ],
        }
        break
      default:
        throw new Error(`Unsupported question kind "${kind}".`)
    }
  }
  return question
}

module.exports = { createCanonicalQuestion }

import { expect } from '@playwright/test'
import { validateAnswerPayload } from '../../../shared/src/education/question-answer-payload.js'
const text = (value, sensitive = false) =>
  sensitive
    ? value.trim().normalize('NFC')
    : value.trim().normalize('NFC').toLowerCase().normalize('NFC')
export function answerCorrect(question, answer) {
  const errors = []
  validateAnswerPayload(question, answer, ['answer'], errors)
  expect(errors, 'Accepted command has a canonical answer payload').toEqual([])
  const key = question.answerKey
  switch (question.kind) {
    case 'single-choice':
      return answer.optionId === key.optionId
    case 'multi-choice':
      return (
        answer.optionIds.length === key.optionIds.length &&
        answer.optionIds.every((id) => key.optionIds.includes(id))
      )
    case 'true-false':
      return answer.value === key.value
    case 'fill-blank':
      return key.accepted.some(
        (value) => text(value, key.caseSensitive) === text(answer.text, key.caseSensitive)
      )
    case 'ordering':
      return (
        answer.itemIds.length === key.itemIds.length &&
        answer.itemIds.every((id, index) => id === key.itemIds[index])
      )
    case 'matching':
      return (
        answer.pairs.length === key.pairs.length &&
        answer.pairs.every((pair) =>
          key.pairs.some((row) => row.leftId === pair.leftId && row.rightId === pair.rightId)
        )
      )
    case 'image-hotspot':
      return key.regions.some((region) =>
        answer.mode === 'region'
          ? region.id === answer.regionId
          : region.shape === 'rect'
            ? answer.x >= region.x &&
              answer.x <= region.x + region.width &&
              answer.y >= region.y &&
              answer.y <= region.y + region.height
            : (answer.x - region.cx) ** 2 + (answer.y - region.cy) ** 2 <= region.r ** 2
      )
    default:
      throw new Error(`No independent evaluator for ${question.kind}`)
  }
}
export function submittedPairs(config, pairs) {
  expect(Array.isArray(pairs)).toBe(true)
  const prompts = new Set(),
    targets = new Set()
  for (const pair of pairs) {
    expect(Object.keys(pair).sort()).toEqual(['promptId', 'targetId'])
    expect(config.pairs.some((row) => row.promptId === pair.promptId)).toBe(true)
    expect(config.pairs.some((row) => row.targetId === pair.targetId)).toBe(true)
    expect(prompts.has(pair.promptId) || targets.has(pair.targetId)).toBe(false)
    prompts.add(pair.promptId)
    targets.add(pair.targetId)
  }
  return pairs.reduce(
    (score, pair) =>
      score +
      Number(
        config.pairs.some((row) => row.promptId === pair.promptId && row.targetId === pair.targetId)
      ),
    0
  )
}

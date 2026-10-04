import React, { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { createCanonicalQuestion, validateCanonicalQuestion } from 'revealjs-shared'
import QuestionFields from './game-question-fields'

afterEach(cleanup)

function mount(question) {
  let current = question
  function Harness() {
    const [value, setValue] = useState(question)
    return (
      <QuestionFields
        value={value}
        onChange={(next) => {
          current = next
          setValue(next)
        }}
      />
    )
  }
  render(<Harness />)
  return () => current
}

const options = [
  { id: 'a', text: 'Alpha' },
  { id: 'b', text: 'Beta' },
  { id: 'c', text: 'Gamma' },
]
const question = (overrides) =>
  createCanonicalQuestion({ prompt: 'Choose an answer', ...overrides })

describe('QuestionFields stable answer identities', () => {
  it('keeps the selected choice through reorder and deleting another option; deleting the answer shows a repair error', async () => {
    const user = userEvent.setup()
    const current = mount(question({ options, answerKey: { optionId: 'b' } }))
    await user.click(screen.getByRole('button', { name: 'Move option 2 up' }))
    expect(current().options.map((option) => option.id)).toEqual(['b', 'a', 'c'])
    expect(screen.getByRole('radio', { name: 'Correct option 1' }).checked).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Delete option 2' }))
    expect(current().answerKey).toEqual({ optionId: 'b' })
    await user.click(screen.getByRole('button', { name: 'Delete option 1' }))
    expect(current().answerKey).toEqual({ optionId: 'b' })
    expect(validateCanonicalQuestion(current()).isValid).toBe(false)
    expect(screen.getByRole('alert').textContent).toMatch(/answerKey.*optionId/s)
    await user.click(screen.getByRole('radio', { name: 'Correct option 1' }))
    expect(current().answerKey).toEqual({ optionId: 'c' })
    expect(screen.getByRole('radio', { name: 'Correct option 1' }).checked).toBe(true)
    expect(validateCanonicalQuestion(current()).isValid).toBe(true)
  })

  it('edits multiple selected IDs without deriving correctness from display order', async () => {
    const user = userEvent.setup()
    const current = mount(
      question({ kind: 'multi-choice', options, answerKey: { optionIds: ['a', 'c'] } })
    )
    await user.click(screen.getByRole('button', { name: 'Move option 3 up' }))
    expect(current().answerKey.optionIds).toEqual(['a', 'c'])
    await user.click(screen.getByRole('checkbox', { name: 'Correct option 2' }))
    expect(current().answerKey.optionIds).toEqual(['a'])
    expect(screen.getByRole('checkbox', { name: 'Correct option 2' }).checked).toBe(false)
    await user.click(screen.getByRole('checkbox', { name: 'Correct option 3' }))
    expect(current().answerKey.optionIds).toEqual(['a', 'b'])
    expect(screen.getByRole('checkbox', { name: 'Correct option 3' }).checked).toBe(true)
    expect(current().options.map((option) => option.id)).toEqual(['a', 'c', 'b'])
  })

  it('separates ordering display order from the private authored answer sequence', async () => {
    const user = userEvent.setup()
    const current = mount(
      question({ kind: 'ordering', options, answerKey: { itemIds: ['c', 'a', 'b'] } })
    )
    await user.click(screen.getByRole('button', { name: 'Move item 1 down' }))
    expect(current().options.map((item) => item.id)).toEqual(['b', 'a', 'c'])
    expect(current().answerKey.itemIds).toEqual(['c', 'a', 'b'])
    await user.click(screen.getByRole('button', { name: 'Move answer step 1 down' }))
    expect(current().answerKey.itemIds).toEqual(['a', 'c', 'b'])
    await user.click(screen.getByRole('button', { name: 'Delete item 3' }))
    expect(current().answerKey.itemIds).toEqual(['a', 'c', 'b'])
    expect(screen.getByRole('alert').textContent).toContain('answerKey')
    await user.click(screen.getByRole('button', { name: 'Remove answer step 2' }))
    expect(current().answerKey.itemIds).toEqual(['a', 'b'])
    expect(validateCanonicalQuestion(current()).isValid).toBe(true)
  })

  it('changes kind without losing identity, prompt, image, scoring or feedback', async () => {
    const user = userEvent.setup()
    const authored = question({
      id: 'authored',
      points: 25,
      timeLimit: 45,
      media: { src: '/uploads/map.png', alt: 'Map' },
      feedback: { correct: 'Good', incorrect: 'Try again', explanation: 'Because' },
    })
    const current = mount(authored)
    await user.selectOptions(screen.getByLabelText('Question kind'), 'true-false')
    expect(current()).toMatchObject({
      id: 'authored',
      kind: 'true-false',
      prompt: authored.prompt,
      media: authored.media,
      points: 25,
      timeLimit: 45,
      feedback: authored.feedback,
    })
    await user.selectOptions(screen.getByLabelText('Correct boolean answer'), 'false')
    expect(current().answerKey).toEqual({ value: false })
    expect(current()).not.toHaveProperty('options')
  })

  it('authors fill answers, case sensitivity, numeric fields and all feedback without mutating prior values', async () => {
    const user = userEvent.setup()
    const original = question({
      kind: 'fill-blank',
      answerKey: { accepted: ['Hà Nội'], caseSensitive: false },
    })
    const current = mount(original)
    await user.click(screen.getByLabelText('Case-sensitive answers'))
    expect(screen.getByLabelText('Case-sensitive answers').checked).toBe(true)
    expect(current().answerKey.caseSensitive).toBe(true)
    fireEvent.change(screen.getByLabelText('Accepted answer 1'), { target: { value: 'Huế' } })
    await user.click(screen.getByRole('button', { name: 'Add accepted answer' }))
    fireEvent.change(screen.getByLabelText('Accepted answer 2'), { target: { value: 'Hội An' } })
    fireEvent.change(screen.getByLabelText('Question points'), { target: { value: '19' } })
    fireEvent.change(screen.getByLabelText('Question time limit in seconds'), {
      target: { value: '60' },
    })
    for (const label of ['Correct feedback', 'Incorrect feedback', 'Explanation feedback'])
      fireEvent.change(screen.getByLabelText(label), { target: { value: label } })
    expect(current().answerKey).toEqual({ accepted: ['Huế', 'Hội An'], caseSensitive: true })
    expect(current()).toMatchObject({
      points: 19,
      timeLimit: 60,
      feedback: {
        correct: 'Correct feedback',
        incorrect: 'Incorrect feedback',
        explanation: 'Explanation feedback',
      },
    })
    expect(original.answerKey).toEqual({ accepted: ['Hà Nội'], caseSensitive: false })
    await user.click(screen.getByLabelText('Case-sensitive answers'))
    expect(current().answerKey).toEqual({ accepted: ['Huế', 'Hội An'], caseSensitive: false })
    expect(screen.getByLabelText('Case-sensitive answers').checked).toBe(false)
  })

  it('shows invalid numeric bounds rather than silently clamping and supports an explicit unlimited timer', () => {
    const current = mount(question({ kind: 'true-false', answerKey: { value: true } }))
    fireEvent.change(screen.getByLabelText('Question points'), { target: { value: '-1' } })
    expect(current().points).toBe(-1)
    expect(screen.getByLabelText('Question points').getAttribute('aria-invalid')).toBe('true')
    fireEvent.change(screen.getByLabelText('Question points'), { target: { value: '0.5' } })
    fireEvent.change(screen.getByLabelText('Question time limit in seconds'), {
      target: { value: '301' },
    })
    expect(current().timeLimit).toBe(301)
    expect(validateCanonicalQuestion(current()).isValid).toBe(false)
    fireEvent.change(screen.getByLabelText('Question time limit in seconds'), {
      target: { value: '' },
    })
    expect(current().timeLimit).toBeNull()
    expect(validateCanonicalQuestion(current()).isValid).toBe(true)
  })
})

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

describe('QuestionFields matching and hotspot authoring', () => {
  it('preserves matching pairs on either display reorder and surfaces a deleted mapped target until explicitly repaired', async () => {
    const user = userEvent.setup()
    const current = mount(
      createCanonicalQuestion({
        kind: 'matching',
        prompt: 'Match capitals',
        options: {
          left: [
            { id: 'l1', text: 'Vietnam' },
            { id: 'l2', text: 'Japan' },
          ],
          right: [
            { id: 'r1', text: 'Hanoi' },
            { id: 'r2', text: 'Tokyo' },
          ],
        },
        answerKey: {
          pairs: [
            { leftId: 'l1', rightId: 'r1' },
            { leftId: 'l2', rightId: 'r2' },
          ],
        },
      })
    )
    await user.click(screen.getByRole('button', { name: 'Move left item 1 down' }))
    await user.click(screen.getByRole('button', { name: 'Move right item 2 up' }))
    expect(current().answerKey.pairs).toEqual([
      { leftId: 'l1', rightId: 'r1' },
      { leftId: 'l2', rightId: 'r2' },
    ])
    await user.click(screen.getByRole('button', { name: 'Delete right item 2' }))
    expect(current().answerKey.pairs[0]).toEqual({ leftId: 'l1', rightId: 'r1' })
    expect(validateCanonicalQuestion(current()).isValid).toBe(false)
    expect(screen.getByRole('alert').textContent).toContain('answerKey')
    expect(screen.getByLabelText('Pair 1 right item').value).toBe('r1')
    await user.selectOptions(screen.getByLabelText('Pair 1 right item'), 'r2')
    expect(current().answerKey.pairs[0].rightId).toBe('r2')
    expect(current().answerKey.pairs[1].rightId).toBe('r2')
    expect(validateCanonicalQuestion(current()).isValid).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Add right item' }))
    const replacementId = current().options.right[1].id
    expect(['r1', 'r2']).not.toContain(replacementId)
    fireEvent.change(screen.getByLabelText('Right item 2 text'), { target: { value: 'Hanoi' } })
    expect(current().options.right[1].id).toBe(replacementId)
    await user.selectOptions(screen.getByLabelText('Pair 1 right item'), replacementId)
    expect(validateCanonicalQuestion(current()).isValid).toBe(true)
  })

  it('edits row images and alt text, preserves row identity and rejects unsafe image entry visibly', async () => {
    const user = userEvent.setup()
    const current = mount(
      createCanonicalQuestion({
        prompt: 'Choose',
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
        ],
        answerKey: { optionId: 'a' },
      })
    )
    fireEvent.change(screen.getByLabelText('Option 1 image URL'), {
      target: { value: '/uploads/answer.png' },
    })
    fireEvent.change(screen.getByLabelText('Option 1 image alt text'), {
      target: { value: 'Answer diagram' },
    })
    expect(current().options[0]).toEqual({
      id: 'a',
      text: 'A',
      media: { src: '/uploads/answer.png', alt: 'Answer diagram' },
    })
    fireEvent.change(screen.getByLabelText('Option 1 image URL'), {
      target: { value: 'javascript:alert(1)' },
    })
    expect(screen.getByLabelText('Option 1 image URL').getAttribute('aria-invalid')).toBe('true')
    expect(validateCanonicalQuestion(current()).isValid).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Remove Option 1 image' }))
    expect(current().options[0]).toEqual({ id: 'a', text: 'A' })
  })

  it('maintains neutral hotspot labels independently of correct regions and validates the full normalized shape bounds', async () => {
    const user = userEvent.setup()
    const current = mount(
      createCanonicalQuestion({
        kind: 'image-hotspot',
        prompt: 'Find the lake',
        media: { src: '/uploads/map.png', alt: 'Map' },
        options: [
          { id: 'lake', text: 'Lake' },
          { id: 'hill', text: 'Hill' },
        ],
        answerKey: {
          regions: [{ id: 'lake', shape: 'rect', x: 0.1, y: 0.2, width: 0.3, height: 0.4 }],
        },
      })
    )
    await user.click(screen.getByRole('button', { name: 'Move region label 1 down' }))
    expect(current().answerKey.regions[0].id).toBe('lake')
    fireEvent.change(screen.getByLabelText('Correct region 1 x'), { target: { value: '0.9' } })
    expect(validateCanonicalQuestion(current()).isValid).toBe(false)
    expect(screen.getByRole('alert').textContent).toContain('answerKey')
    fireEvent.change(screen.getByLabelText('Correct region 1 x'), { target: { value: '0.1' } })
    await user.selectOptions(screen.getByLabelText('Correct region 1 shape'), 'circle')
    expect(current().answerKey.regions[0]).toMatchObject({ id: 'lake', shape: 'circle' })
    expect(current().answerKey.regions[0]).not.toHaveProperty('width')
    fireEvent.change(screen.getByLabelText('Correct region 1 cx'), { target: { value: '0.05' } })
    fireEvent.change(screen.getByLabelText('Correct region 1 r'), { target: { value: '0.2' } })
    expect(validateCanonicalQuestion(current()).isValid).toBe(false)
    fireEvent.change(screen.getByLabelText('Correct region 1 cx'), { target: { value: '0.5' } })
    expect(validateCanonicalQuestion(current()).isValid).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Delete region label 2' }))
    expect(current().answerKey.regions[0].id).toBe('lake')
    expect(validateCanonicalQuestion(current()).isValid).toBe(false)
  })

  it('uses the provided initial focus ref and associates actionable validation paths with invalid controls', () => {
    const initialFocusRef = React.createRef()
    const value = createCanonicalQuestion({ prompt: '' })
    function Harness() {
      const [draft, setDraft] = React.useState(value)
      return (
        <QuestionFields
          value={draft}
          onChange={setDraft}
          errors={validateCanonicalQuestion(draft).errors}
          initialFocusRef={initialFocusRef}
        />
      )
    }
    const { container } = render(<Harness />)
    expect(initialFocusRef.current).toBe(screen.getByLabelText('Question text'))
    expect(initialFocusRef.current.getAttribute('aria-invalid')).toBe('true')
    const errorId = initialFocusRef.current.getAttribute('aria-describedby')
    expect(container.contains(document.getElementById(errorId))).toBe(true)
    fireEvent.change(initialFocusRef.current, { target: { value: 'Repaired prompt' } })
    expect(initialFocusRef.current.getAttribute('aria-invalid')).not.toBe('true')
    expect(initialFocusRef.current.getAttribute('aria-describedby')).toBeNull()
  })
})

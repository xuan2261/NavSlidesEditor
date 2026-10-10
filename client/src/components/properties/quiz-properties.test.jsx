// @vitest-environment jsdom
import React, { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createCanonicalQuestion } from 'revealjs-shared'
import QuizProperties from './quiz-properties.jsx'

function mount() {
  let current
  const first = createCanonicalQuestion({ id: 'first', prompt: 'First question' })
  const second = createCanonicalQuestion({ id: 'second', prompt: 'Second question' })
  function Harness() {
    const [config, setConfig] = useState({
      title: 'Lesson',
      questions: [first, second],
      attemptLimit: 1,
      shuffleQuestions: false,
      feedbackMode: 'immediate',
      showScore: true,
    })
    current = config
    return (
      <QuizProperties
        config={config}
        onChange={(patch) => setConfig((value) => ({ ...value, ...patch }))}
        onEditQuestion={(question, save) =>
          save(
            question ? { ...question, prompt: 'Edited' } : createCanonicalQuestion({ id: 'third' })
          )
        }
      />
    )
  }
  render(<Harness />)
  return () => current
}

describe('quiz properties', () => {
  it('changes quiz settings without removing question identities or answer references', () => {
    const current = mount()
    const key = current().questions[0].answerKey
    fireEvent.change(screen.getByLabelText('Attempt limit'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Feedback mode'), {
      target: { value: 'after-question' },
    })
    fireEvent.click(screen.getByLabelText('Show score'))
    expect(current()).toMatchObject({
      attemptLimit: 3,
      feedbackMode: 'after-question',
      showScore: false,
    })
    expect(current().questions[0].answerKey).toEqual(key)
  })
  it('reorders, edits, adds and deletes questions through the existing modal callback contract', () => {
    const current = mount()
    const answerKey = current().questions[0].answerKey
    fireEvent.click(screen.getByRole('button', { name: 'Move question 1 down' }))
    expect(current().questions.map((q) => q.id)).toEqual(['second', 'first'])
    fireEvent.click(screen.getByRole('button', { name: 'Edit question 2' }))
    expect(current().questions[1]).toMatchObject({ id: 'first', prompt: 'Edited', answerKey })
    fireEvent.click(screen.getByRole('button', { name: 'Add question' }))
    expect(current().questions.map((q) => q.id)).toEqual(['second', 'first', 'third'])
    fireEvent.click(screen.getByRole('button', { name: 'Delete question 1' }))
    expect(current().questions.map((q) => q.id)).toEqual(['first', 'third'])
  })
})

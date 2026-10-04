import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { GamePropertiesQuestionEditor } from './game-properties-question-editor'

const question = {
  id: 'q-stable',
  kind: 'single-choice',
  prompt: 'Which city?',
  points: 10,
  timeLimit: 30,
  options: [
    { id: 'london', text: 'London' },
    { id: 'paris', text: 'Paris' },
  ],
  answerKey: { optionId: 'paris' },
  feedback: { correct: '', incorrect: '', explanation: '' },
}

describe('canonical question modal', () => {
  it('traps focus, closes with Escape and restores the trigger without editor Escape propagation', async () => {
    const user = userEvent.setup()
    const underlyingEscape = vi.fn()
    function Harness() {
      const [open, setOpen] = React.useState(false)
      return (
        <div onKeyDown={(event) => event.key === 'Escape' && underlyingEscape()}>
          <button onClick={() => setOpen(true)}>Add quiz question</button>
          <GamePropertiesQuestionEditor
            isOpen={open}
            question={null}
            onSave={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        </div>
      )
    }
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Add quiz question' })
    await user.click(trigger)
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Question text' }))
    await user.tab({ shift: true })
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
    screen.getByRole('button', { name: 'Close question editor' }).focus()
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Save' }))
    await user.tab()
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Close question editor' })
    )
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    expect(underlyingEscape).not.toHaveBeenCalled()
  })

  it('does not replace an authored question with an invalid blank prompt', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [saved, setSaved] = React.useState(question)
      return (
        <>
          <output aria-label="Saved question">{JSON.stringify(saved)}</output>
          <GamePropertiesQuestionEditor
            isOpen
            question={saved}
            onSave={setSaved}
            onCancel={() => {}}
          />
        </>
      )
    }
    render(<Harness />)
    await user.clear(screen.getByRole('textbox', { name: 'Question text' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(JSON.parse(screen.getByLabelText('Saved question').textContent)).toEqual(question)
    const field = screen.getByRole('textbox', { name: 'Question text' })
    expect(field.getAttribute('aria-invalid')).toBe('true')
    expect(field.getAttribute('aria-describedby')).toBeTruthy()
  })

  it('saves changed prompt without losing stable identity, correctness or source content', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [saved, setSaved] = React.useState(question)
      return (
        <>
          <output aria-label="Saved question">{JSON.stringify(saved)}</output>
          <GamePropertiesQuestionEditor
            isOpen
            question={question}
            onSave={setSaved}
            onCancel={() => {}}
          />
        </>
      )
    }
    render(<Harness />)
    const prompt = screen.getByRole('textbox', { name: 'Question text' })
    await user.clear(prompt)
    await user.type(prompt, 'Capital of France?')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(JSON.parse(screen.getByLabelText('Saved question').textContent)).toEqual({
      ...question,
      prompt: 'Capital of France?',
    })
    expect(question.prompt).toBe('Which city?')
  })
})

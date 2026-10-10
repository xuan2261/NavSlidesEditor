import React, { useState } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import PickerAuthoring from './game-authoring-picker'
import JeopardyAuthoring from './game-authoring-jeopardy'
import TeamRoundsAuthoring from './game-authoring-team-rounds'
import ResponsesAuthoring from './game-authoring-responses'
import { QuestionList } from './game-authoring-fields'
import { GamePropertiesQuestionEditor } from './game-properties-question-editor'

afterEach(cleanup)
const question = (id, prompt) => ({
  id,
  kind: 'single-choice',
  prompt,
  points: 10,
  timeLimit: 30,
  options: [
    { id: `${id}-a`, text: 'A' },
    { id: `${id}-b`, text: 'B' },
  ],
  answerKey: { optionId: `${id}-b` },
  feedback: { correct: '', incorrect: '', explanation: '' },
})
function Harness({ Component, initial, gameType }) {
  const [config, setConfig] = useState(initial)
  const [editing, setEditing] = useState(null)
  return (
    <>
      <Component
        config={config}
        gameType={gameType}
        onChange={(patch) => setConfig((current) => ({ ...current, ...patch }))}
        onEditQuestion={(question, save) => setEditing({ question, save })}
      />
      <GamePropertiesQuestionEditor
        isOpen={!!editing}
        question={editing?.question}
        onSave={(question) => {
          editing.save(question)
          setEditing(null)
        }}
        onCancel={() => setEditing(null)}
      />
      <output data-testid="config">{JSON.stringify(config)}</output>
    </>
  )
}
const saved = () => JSON.parse(screen.getByTestId('config').textContent)
const change = (label, value) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

describe('teacher-authored stable identities', () => {
  it('edits, weights, reorders and removes picker items without changing their identities', () => {
    render(
      <Harness
        Component={PickerAuthoring}
        initial={{
          items: [
            { id: 'alice', label: 'Alice', weight: 1 },
            { id: 'bob', label: 'Bob', weight: 2 },
          ],
          pickerMode: 'wheel',
          weighted: true,
          excludeAfterPick: false,
          animationDuration: 3000,
          showConfetti: true,
          wheelColors: ['#ff0000'],
          diceCount: 1,
          wheelSegments: 6,
        }}
      />
    )
    change('Item 1 label', 'Alicia')
    change('Item 1 weight', '2.5')
    fireEvent.click(screen.getByRole('button', { name: 'Move item 1 down' }))
    expect(saved().items).toEqual([
      { id: 'bob', label: 'Bob', weight: 2 },
      { id: 'alice', label: 'Alicia', weight: 2.5 },
    ])
    fireEvent.click(screen.getByRole('button', { name: 'Delete item 1' }))
    expect(saved().items[0].id).toBe('alice')
  })

  it('keeps canonical answers after question reordering and actual modal editing', () => {
    const initial = [question('q1', 'First'), question('q2', 'Second')]
    function Questions({ config, onChange, onEditQuestion }) {
      return (
        <QuestionList
          questions={config.questions}
          onChange={(questions) => onChange({ questions })}
          onEditQuestion={onEditQuestion}
        />
      )
    }
    render(<Harness Component={Questions} initial={{ questions: initial }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Move question 1 down' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit question 2' }))
    change('Question text', 'Edited')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(saved().questions[1]).toEqual({ ...initial[0], prompt: 'Edited' })
    expect(saved().questions[1].answerKey).toEqual({ optionId: 'q1-b' })
  })

  it('preserves daily double and answer IDs while moving categories and editing cells', () => {
    const cell = question('cell-a', 'First')
    render(
      <Harness
        Component={JeopardyAuthoring}
        initial={{
          categories: [
            { id: 'cat-a', title: 'Science', questions: [cell] },
            { id: 'cat-b', title: 'History', questions: [question('cell-b', 'Second')] },
          ],
          dailyDouble: ['cell-a'],
          teams: [],
          timerDuration: 30,
          showTimer: true,
          wagerLimit: 1000,
          negativePoints: false,
        }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Move category 1 down' }))
    change('Category 2 title', 'Physics')
    fireEvent.click(screen.getByRole('button', { name: 'Edit category 2 cell 1 question' }))
    change('Question text', 'New prompt')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(saved().dailyDouble).toEqual(['cell-a'])
    expect(saved().categories[1]).toEqual({
      id: 'cat-a',
      title: 'Physics',
      questions: [{ ...cell, prompt: 'New prompt' }],
    })
    fireEvent.click(screen.getByRole('button', { name: 'Delete category 2 cell 1' }))
    expect(saved().dailyDouble).toEqual(['cell-a'])
    expect(
      screen
        .getAllByRole('alert')
        .map((alert) => alert.textContent)
        .join(' ')
    ).toMatch(/missing.*cell/i)
  })
  it('keeps round references on deletion and lets teachers explicitly remove missing references', () => {
    render(
      <Harness
        Component={TeamRoundsAuthoring}
        gameType="trivia-champ"
        initial={{
          questions: [question('q1', 'First')],
          rounds: [
            { id: 'round1', name: 'Buzz', mode: 'buzzer', questionIds: ['q1'], timeLimit: 30 },
          ],
          teams: [],
          buzzPoints: 10,
          lightningRound: { enabled: false, timePerQ: 10 },
          jackpotRound: { enabled: false, multiplier: 2 },
        }}
      />
    )
    change('Buzz points', '0')
    expect(saved().buzzPoints).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Delete question 1' }))
    expect(saved().rounds[0].questionIds).toEqual(['q1'])
    expect(screen.getByRole('alert').textContent).toMatch(/missing question/i)
    fireEvent.click(screen.getByRole('button', { name: 'Remove missing question q1 from round 1' }))
    expect(saved().rounds[0].questionIds).toEqual([])
  })

  it('preserves poll option IDs and matching side IDs after edits and reorder', () => {
    const poll = render(
      <Harness
        Component={ResponsesAuthoring}
        gameType="poll"
        initial={{
          prompt: 'Vote',
          options: [
            { id: 'yes', text: 'Yes' },
            { id: 'no', text: 'No' },
          ],
          showResults: true,
          allowVoteChange: true,
          timerDuration: 30,
        }}
      />
    )
    change('Poll option 1 text', 'Absolutely')
    fireEvent.click(screen.getByRole('button', { name: 'Move poll option 1 down' }))
    expect(saved().options).toEqual([
      { id: 'no', text: 'No' },
      { id: 'yes', text: 'Absolutely' },
    ])
    poll.unmount()
    render(
      <Harness
        Component={ResponsesAuthoring}
        gameType="matching"
        initial={{
          prompt: 'Match',
          pairs: [
            { promptId: 'p1', targetId: 't1', prompt: 'Cat', target: 'Meow' },
            { promptId: 'p2', targetId: 't2', prompt: 'Dog', target: 'Woof' },
          ],
          timerDuration: 30,
        }}
      />
    )
    change('Pair 1 prompt', 'Kitten')
    fireEvent.click(screen.getByRole('button', { name: 'Move pair 1 down' }))
    expect(saved().pairs[1]).toEqual({
      promptId: 'p1',
      targetId: 't1',
      prompt: 'Kitten',
      target: 'Meow',
    })
    const pair = screen.getByRole('group', { name: 'Pair 2' })
    expect(within(pair).getByLabelText('Pair 2 prompt image URL')).toBeTruthy()
  })
})

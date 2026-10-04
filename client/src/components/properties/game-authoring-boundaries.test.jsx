import React, { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { createCanonicalQuestion, createDefaultGameConfig } from 'revealjs-shared'
import PickerAuthoring from './game-authoring-picker'
import JeopardyAuthoring from './game-authoring-jeopardy'
import TeamRoundsAuthoring from './game-authoring-team-rounds'
import ResponsesAuthoring from './game-authoring-responses'
import { TeamFields } from './game-authoring-fields'
import { GamePropertiesQuestionEditor } from './game-properties-question-editor'

afterEach(cleanup)
function Harness({ Component, gameType, initial }) {
  const [config, setConfig] = useState(() => initial || createDefaultGameConfig(gameType))
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
const toggle = (label) => fireEvent.click(screen.getByRole('checkbox', { name: label }))

describe('authoring boundaries and list transitions', () => {
  it('accepts unbounded finite canonical cell points without changing the answer key', () => {
    render(<Harness Component={JeopardyAuthoring} gameType="jeopardy" />)
    const key = saved().categories[0].questions[0].answerKey
    const wasDailyDouble = saved().dailyDouble.includes(saved().categories[0].questions[0].id)
    change('Category 1 cell 1 points', '2000000000')
    expect(saved().categories[0].questions[0].points).toBe(2000000000)
    expect(saved().categories[0].questions[0].answerKey).toEqual(key)
    toggle('Category 1 cell 1 daily double')
    expect(saved().dailyDouble.includes(saved().categories[0].questions[0].id)).toBe(
      !wasDailyDouble
    )
  })

  it('caps team additions at the registry limit and preserves identity across keyboard reorder', async () => {
    const initial = Array.from({ length: 100 }, (_, index) => ({
      id: `team-${index}`,
      name: `Team ${index}`,
      color: '#123456',
      score: 9,
    }))
    function Teams() {
      const [teams, setTeams] = useState(initial)
      return (
        <>
          <TeamFields teams={teams} onChange={setTeams} />
          <output data-testid="config">{JSON.stringify({ teams })}</output>
        </>
      )
    }
    render(<Teams />)
    expect(screen.getByRole('button', { name: 'Add team' }).disabled).toBe(true)
    const user = userEvent.setup()
    screen.getByRole('button', { name: 'Move team 1 down' }).focus()
    await user.keyboard('{Enter}')
    expect(saved().teams[1]).toEqual({ id: 'team-0', name: 'Team 0', color: '#123456' })
    expect(saved().teams.every((team) => !Object.hasOwn(team, 'score'))).toBe(true)
  })

  it('authors picker modes, dice, wheel colors and zero duration while rejecting nonpositive weights', () => {
    render(<Harness Component={PickerAuthoring} gameType="name-picker" />)
    const before = saved()
    change('Picker mode', 'dice')
    change('Dice count', '6')
    change('Wheel segments', '10')
    change('Animation duration in milliseconds', '0')
    toggle('Weighted selection')
    toggle('Exclude after pick')
    toggle('Confetti animation')
    change('Wheel color 1', '#112233')
    expect(saved()).toMatchObject({
      pickerMode: 'dice',
      diceCount: 6,
      wheelSegments: 10,
      animationDuration: 0,
      weighted: !before.weighted,
      excludeAfterPick: !before.excludeAfterPick,
      showConfetti: !before.showConfetti,
    })
    expect(saved().wheelColors[0]).toBe('#112233')
    change('Item 1 weight', '0')
    expect(saved().items[0].weight).toBe(before.items[0].weight)
    expect(screen.getByRole('alert').textContent).toMatch(/number/)
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }))
    expect(saved().items.at(-1).id).not.toBe(before.items[0].id)
    expect(saved().items.at(-1).weight).toBe(1)
  })

  it('reorders round question references independently of the question list', () => {
    const initial = createDefaultGameConfig('trivia-champ')
    const second = createCanonicalQuestion({ id: crypto.randomUUID(), prompt: 'Second question' })
    initial.questions.push(second)
    initial.rounds[0].questionIds.push(second.id)
    render(<Harness Component={TeamRoundsAuthoring} gameType="trivia-champ" initial={initial} />)
    const originalQuestionOrder = saved().questions.map((question) => question.id)
    fireEvent.click(screen.getByRole('button', { name: 'Move round 1 question 1 down' }))
    expect(saved().rounds[0].questionIds).toEqual([...originalQuestionOrder].reverse())
    expect(saved().questions.map((question) => question.id)).toEqual(originalQuestionOrder)
    const id = saved().rounds[0].id
    change('Round 1 name', 'Renamed')
    fireEvent.click(screen.getByRole('button', { name: 'Add round' }))
    const checkbox = screen.getByRole('checkbox', { name: /^Round 2 include question 1:/ })
    fireEvent.click(checkbox)
    const qid = saved().questions[0].id
    fireEvent.click(screen.getByRole('button', { name: 'Move round 1 down' }))
    expect(saved().rounds[1]).toMatchObject({ id, name: 'Renamed', questionIds: [second.id, qid] })
    expect(saved().rounds[0].questionIds).toEqual([qid])
    fireEvent.click(screen.getByRole('checkbox', { name: /^Round 1 include question 1:/ }))
    expect(saved().rounds[0].questionIds).toEqual([])
    expect(saved().rounds[1].questionIds).toEqual([second.id, qid])
  })

  it('authors poll policies and timer and exposes an actionable minimum-option error', () => {
    render(<Harness Component={ResponsesAuthoring} gameType="poll" />)
    const before = saved()
    toggle('Show results')
    toggle('Allow vote change')
    change('Timer duration in seconds', '120')
    expect(saved()).toMatchObject({
      showResults: !before.showResults,
      allowVoteChange: !before.allowVoteChange,
      timerDuration: 120,
    })
    while (saved().options.length > 1)
      fireEvent.click(screen.getByRole('button', { name: 'Delete poll option 1' }))
    expect(screen.getByRole('alert').textContent).toMatch(/at least two options/)
    fireEvent.click(screen.getByRole('button', { name: 'Add poll option' }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(saved().options[1].id).not.toBe(saved().options[0].id)
  })
})

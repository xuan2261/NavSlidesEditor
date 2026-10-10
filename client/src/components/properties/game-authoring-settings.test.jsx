import React, { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import TeamRoundsAuthoring from './game-authoring-team-rounds'
import ResponsesAuthoring from './game-authoring-responses'
import GameDisplayFields from './game-display-fields'
import { createDefaultGameConfig } from 'revealjs-shared'
import { GamePropertiesQuestionEditor } from './game-properties-question-editor'

afterEach(cleanup)
function Harness({ Component, gameType, initial }) {
  const [config, setConfig] = useState(() => initial || createDefaultGameConfig(gameType))
  const [element, setElement] = useState({
    backgroundColor: '#123456',
    accentColor: '#abcdef',
    fontFamily: 'sans-serif',
    showSoundEffects: true,
  })
  const [editing, setEditing] = useState(null)
  return (
    <>
      <Component
        gameType={gameType}
        config={config}
        element={element}
        onChange={(patch) => setConfig((current) => ({ ...current, ...patch }))}
        onUpdateElement={(patch) => setElement((current) => ({ ...current, ...patch }))}
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
      <output data-testid="state">{JSON.stringify({ config, element })}</output>
    </>
  )
}
const state = () => JSON.parse(screen.getByTestId('state').textContent)
const change = (label, value) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
const click = (label) => fireEvent.click(screen.getByRole('checkbox', { name: label }))

describe('complete authored game settings', () => {
  it('edits hot potato question order and every authored policy without runtime state', () => {
    render(<Harness Component={TeamRoundsAuthoring} gameType="hot-potato" />)
    const before = state().config
    click('Shuffle questions')
    click('Allow late join')
    click('Show leaderboard')
    const policies = state().config
    expect(policies.shuffleQuestions).toBe(!before.shuffleQuestions)
    expect(policies.allowLateJoin).toBe(!before.allowLateJoin)
    expect(policies.showLeaderboard).toBe(!before.showLeaderboard)
    fireEvent.click(screen.getByRole('button', { name: 'Edit question 1' }))
    change('Question text', 'Edited prompt')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(state().config.questions[0].prompt).toBe('Edited prompt')
    expect(state().config).not.toHaveProperty('currentQuestion')
  })

  it('shows actionable corner count errors while preserving the original correct corner identity', () => {
    render(<Harness Component={TeamRoundsAuthoring} gameType="four-corners" />)
    const key = state().config.questions[0].answerKey
    const beforeTimer = state().config.showTimer
    change('Corner count', '2')
    expect(state().config.questions[0].answerKey).toEqual(key)
    expect(screen.getByRole('alert').textContent).toMatch(/corner|options/i)
    change('Elimination mode', 'none')
    change('Timer duration in seconds', '45')
    click('Show timer')
    expect(state().config).toMatchObject({
      cornerCount: 2,
      eliminateMode: 'none',
      timerDuration: 45,
      showTimer: !beforeTimer,
    })
  })

  it('edits relay team identities and policies without persisting team scores', () => {
    render(<Harness Component={TeamRoundsAuthoring} gameType="relay-race" />)
    const id = state().config.teams[0].id
    const before = state().config
    change('Team 1 name', 'New name')
    change('Team 1 color', '#123456')
    change('Questions per round', '3')
    click('Shuffle teams')
    click('Pass on wrong answer')
    change('Timer duration in seconds', '60')
    expect(state().config.teams[0]).toEqual({ id, name: 'New name', color: '#123456' })
    expect(state().config).toMatchObject({
      questionsPerRound: 3,
      timerDuration: 60,
      shuffleTeams: !before.shuffleTeams,
      passOnWrong: !before.passOnWrong,
    })
    expect(state().config.teams[0]).not.toHaveProperty('score')
  })

  it('edits all trivia round policies and nested lightning and jackpot settings', () => {
    render(<Harness Component={TeamRoundsAuthoring} gameType="trivia-champ" />)
    const id = state().config.rounds[0].id
    const before = state().config
    change('Round 1 name', 'Final')
    change('Round 1 mode', 'buzzer')
    change('Round 1 time limit in seconds', '90')
    click('Enable lightning round')
    change('Lightning time per question in seconds', '7')
    click('Enable jackpot round')
    change('Jackpot multiplier', '3')
    expect(state().config.rounds[0]).toMatchObject({
      id,
      name: 'Final',
      mode: 'buzzer',
      timeLimit: 90,
    })
    expect(state().config).toMatchObject({
      lightningRound: { enabled: !before.lightningRound.enabled, timePerQ: 7 },
      jackpotRound: { enabled: !before.jackpotRound.enabled, multiplier: 3 },
    })
  })

  it('edits scatter categories, teams, timer, manual letter and scoring', () => {
    render(<Harness Component={TeamRoundsAuthoring} gameType="scattergories" />)
    const id = state().config.categories[0].id
    change('Category 1 label', 'Plants')
    change('Time per round in seconds', '75')
    change('Letter mode', 'manual')
    change('Manual letter', 'B')
    change('Scoring', 'all')
    expect(state().config.categories[0]).toEqual({ id, label: 'Plants' })
    expect(state().config).toMatchObject({
      timePerRound: 75,
      letterMode: 'manual',
      letter: 'B',
      scoring: 'all',
    })
  })

  it('edits every word cloud bound and rejects values outside the server bounds', () => {
    render(<Harness Component={ResponsesAuthoring} gameType="word-cloud" />)
    change('Prompt', 'Ideas')
    change('Maximum phrase length', '40')
    change('Maximum submissions per player', '5')
    change('Display limit', '50')
    change('Timer duration in seconds', '100')
    expect(state().config).toMatchObject({
      prompt: 'Ideas',
      maxPhraseLength: 40,
      maxSubmissionsPerPlayer: 5,
      displayLimit: 50,
      timerDuration: 100,
    })
    change('Maximum submissions per player', '6')
    expect(state().config.maxSubmissionsPerPlayer).toBe(5)
    expect(screen.getByRole('alert').textContent).toMatch(/1 to 5/)
  })

  it('persists safe matching media and alt text and rejects executable media entries', () => {
    render(<Harness Component={ResponsesAuthoring} gameType="matching" />)
    change('Pair 1 prompt image URL', '/uploads/cat.png')
    change('Pair 1 prompt image alt text', 'A cat')
    expect(state().config.pairs[0].promptMedia).toEqual({ src: '/uploads/cat.png', alt: 'A cat' })
    change('Pair 1 target image URL', 'javascript:alert(1)')
    expect(state().config.pairs[0].targetMedia).toBeUndefined()
    expect(screen.getByRole('alert').textContent).toMatch(/URL|unsafe|image/i)
  })

  it('edits display base fields separately from subtype timer and confetti', () => {
    render(<Harness Component={GameDisplayFields} gameType="name-picker" />)
    const beforeConfetti = state().config.showConfetti
    change('Game title', 'Classroom game')
    change('Game background color', '#010203')
    change('Game accent color', '#040506')
    change('Game font family', 'serif')
    click('Sound effects')
    click('Confetti animation')
    expect(state().element).toEqual({
      backgroundColor: '#010203',
      accentColor: '#040506',
      fontFamily: 'serif',
      showSoundEffects: false,
    })
    expect(state().config.showConfetti).toBe(!beforeConfetti)
    expect(state().config.title).toBe('Classroom game')
    expect(state().element).not.toHaveProperty('showConfetti')
  })
})

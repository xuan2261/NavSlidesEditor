import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createDefaultGameConfig,
  normalizePresentationGames,
  validateGameConfig,
} from 'revealjs-shared'
import GameProperties from './game-properties'
import { createGameElement } from '../../constants/game-element-types-constants'
import { usePresentationStore } from '../../stores/presentation-store'

function element() {
  return usePresentationStore.getState().presentation.slides[0].elements[0]
}
function Harness() {
  const current = usePresentationStore((state) => state.presentation.slides[0].elements[0])
  return (
    <GameProperties
      element={current}
      onDelete={() => {}}
      onUpdate={(patch) => {
        const presentation = usePresentationStore.getState().presentation
        usePresentationStore
          .getState()
          .setPresentation({
            ...presentation,
            slides: [{ ...presentation.slides[0], elements: [{ ...current, ...patch }] }],
          })
      }}
    />
  )
}
function mount(game) {
  usePresentationStore
    .getState()
    .setPresentation({ id: 'deck', slides: [{ id: 'slide', elements: [game] }] })
  return render(<Harness />)
}
beforeEach(() => usePresentationStore.getState().setPresentation(null))
afterEach(() => {
  cleanup()
  usePresentationStore.getState().setPresentation(null)
})

describe('GameProperties canonical store transitions', () => {
  it('retains distinct authored subtype configuration when switching away and back', () => {
    const poll = {
      ...createDefaultGameConfig('poll'),
      prompt: 'Which theorem?',
      options: [
        { id: 'pythagoras', text: 'Pythagoras' },
        { id: 'thales', text: 'Thales' },
      ],
    }
    mount(createGameElement('name-picker', { poll }))
    const pickerIds = element()['name-picker'].items.map((item) => item.id)
    fireEvent.change(screen.getByRole('combobox', { name: 'Game type' }), {
      target: { value: 'poll' },
    })
    expect(screen.getByRole('textbox', { name: 'Prompt' }).value).toBe('Which theorem?')
    fireEvent.change(screen.getByRole('textbox', { name: 'Poll option 2 text' }), {
      target: { value: 'Thales theorem' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'Game type' }), {
      target: { value: 'name-picker' },
    })
    expect(element()['name-picker'].items.map((item) => item.id)).toEqual(pickerIds)
    fireEvent.change(screen.getByRole('combobox', { name: 'Game type' }), {
      target: { value: 'poll' },
    })
    expect(screen.getByRole('textbox', { name: 'Poll option 2 text' }).value).toBe('Thales theorem')
    const saved = normalizePresentationGames(usePresentationStore.getState().presentation)
    expect(saved.slides[0].elements[0].poll.options).toEqual([
      { id: 'pythagoras', text: 'Pythagoras' },
      { id: 'thales', text: 'Thales theorem' },
    ])
  })

  it('keeps an invalid poll draft editable but rejects persistence until explicitly repaired', () => {
    mount(
      createGameElement('poll', {
        poll: {
          options: [
            { id: 'a', text: 'A' },
            { id: 'b', text: 'B' },
          ],
        },
      })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Delete poll option 1' }))
    expect(element().poll.options).toEqual([{ id: 'b', text: 'B' }])
    expect(validateGameConfig('poll', element().poll).isValid).toBe(false)
    expect(() => normalizePresentationGames(usePresentationStore.getState().presentation)).toThrow()
    fireEvent.click(screen.getByRole('button', { name: 'Add poll option' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Poll option 2 text' }), {
      target: { value: 'New candidate' },
    })
    expect(screen.getByRole('textbox', { name: 'Poll option 1 text' }).value).toBe('B')
    expect(element().poll.options[0].id).toBe('b')
    expect(element().poll.options[1].id).not.toBe('a')
    expect(validateGameConfig('poll', element().poll).isValid).toBe(true)
    const saved = normalizePresentationGames(usePresentationStore.getState().presentation)
    expect(saved.slides[0].elements[0].poll.options[1].text).toBe('New candidate')
  })

  it('saves canonical modal changes while retaining the stable question and correct option identities', () => {
    mount(createGameElement('hot-potato'))
    const original = structuredClone(element()['hot-potato'].questions[0])
    fireEvent.click(screen.getByRole('button', { name: 'Edit question 1' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Question text' }), {
      target: { value: 'Capital of France?' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Move option 1 down' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(element()['hot-potato'].questions[0]).toEqual({
      ...original,
      prompt: 'Capital of France?',
      options: [...original.options.slice(1, 2), original.options[0], ...original.options.slice(2)],
    })
    const saved = normalizePresentationGames(usePresentationStore.getState().presentation)
    expect(saved.slides[0].elements[0]['hot-potato'].questions[0].answerKey).toEqual(
      original.answerKey
    )
  })
})

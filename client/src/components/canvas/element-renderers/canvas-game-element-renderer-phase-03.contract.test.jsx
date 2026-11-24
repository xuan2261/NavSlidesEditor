import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GameElementRenderer } from './game-element-renderer'
import { createGameElement } from '../../../constants/game-element-types-constants'
import { createCanonicalQuestion } from 'revealjs-shared'

const media = { src: '/uploads/authored-question.png', alt: 'Authored triangular target' }

describe('retained inert game preview', () => {
  it('shows canonical authored question and image without exposing correctness or starting play', () => {
    const question = createCanonicalQuestion({
      id: 'question',
      prompt: 'Find the triangle',
      media,
      feedback: {
        correct: 'Private success',
        incorrect: 'Private retry',
        explanation: 'Private explanation',
      },
    })
    const element = createGameElement('hot-potato', { 'hot-potato': { questions: [question] } })
    const before = structuredClone(element)
    const { container } = render(<GameElementRenderer element={element} isPresenting={false} />)
    expect(screen.getByText('Find the triangle')).toBeTruthy()
    expect(screen.getByRole('img', { name: media.alt }).getAttribute('src')).toBe(media.src)
    expect(container.textContent).not.toContain('Private explanation')
    expect(container.textContent).not.toContain('Private success')
    expect(container.querySelector('button')).toBeNull()
    expect(element).toEqual(before)
  })

  it('migrates a saved legacy question and preserves the nested prompt over stale flat data', () => {
    const element = {
      id: 'game',
      type: 'game',
      gameType: 'hot-potato',
      questions: [
        { id: 'flat', question: 'Stale flat question', options: ['No', 'Yes'], correctIndex: 1 },
      ],
      'hot-potato': {
        questions: [
          {
            id: 'nested',
            question: 'Saved nested question',
            options: ['Yes', 'No'],
            correctIndex: 0,
            media,
          },
        ],
      },
    }
    const before = structuredClone(element)
    render(<GameElementRenderer element={element} isPresenting={false} />)
    expect(screen.getByText('Saved nested question')).toBeTruthy()
    expect(screen.queryByText('Stale flat question')).toBeNull()
    expect(screen.getByRole('img', { name: media.alt }).getAttribute('src')).toBe(media.src)
    expect(element).toEqual(before)
  })
})

import React from 'react'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createDefaultGameConfig } from '../../../shared/src/education/game-defaults.js'
import { createCanonicalQuestion } from '../../../shared/src/education/question-factory.js'

vi.mock('./dashboard/TemplateSlideThumbnail', () => ({
  default: ({ index }) => <div>Thumbnail {index + 1}</div>,
}))

vi.mock('../hooks/use-game-socket.js', () => ({
  useGameSocket: () => ({}),
}))

import TemplatePreview from './dashboard/TemplatePreview'
import { GameElementRenderer } from './canvas/element-renderers/game-element-renderer'

describe('semantic primary interactions', () => {
  it('toggles template slide selection with Enter and Space', async () => {
    const user = userEvent.setup()
    render(
      <TemplatePreview
        template={{ title: 'Demo', slides: [{ id: 'one' }, { id: 'two' }] }}
        onInsertSlides={vi.fn()}
        onClose={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Insert into Current' }))
    const slide = screen.getByRole('button', { name: 'Slide 1' })
    expect(slide.getAttribute('aria-pressed')).toBe('true')

    slide.focus()
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Slide 2' }))
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(slide)
    await user.keyboard('{Enter}')
    expect(slide.getAttribute('aria-pressed')).toBe('false')

    await user.keyboard(' ')
    expect(slide.getAttribute('aria-pressed')).toBe('true')
  })

  it('selects a team and opens a Jeopardy cell from the keyboard', async () => {
    const user = userEvent.setup()
    const categories = ['Math', 'Science', 'History', 'Art', 'Music'].map((name, index) => ({
      id: `category-${index + 1}`,
      title: name,
      questions: [
        createCanonicalQuestion({
          id: `cell-${index + 1}`,
          kind: 'fill-blank',
          points: 100,
          prompt: `Question ${index + 1}`,
          answerKey: { accepted: [`Answer ${index + 1}`], caseSensitive: false },
        }),
      ],
    }))
    render(
      <GameElementRenderer
        element={{
          id: 'jeopardy-test',
          type: 'game',
          gameType: 'jeopardy',
          gameStatus: 'running',
          jeopardy: {
            ...createDefaultGameConfig('jeopardy'),
            categories,
            teams: [{ id: 'alpha', name: 'Alpha', color: '#f59e0b' }],
            showTimer: false,
          },
        }}
        isPresenting
      />
    )

    const team = screen.getByRole('button', { name: 'Select Alpha, score 0' })
    team.focus()
    await user.tab()
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(team)
    await user.keyboard('{Enter}')
    expect(team.getAttribute('aria-pressed')).toBe('true')

    const cell = screen.getByRole('button', { name: 'Math, 100 points' })
    cell.focus()
    await user.keyboard(' ')
    expect(screen.getByText('Question 1')).toBeTruthy()
  })
})

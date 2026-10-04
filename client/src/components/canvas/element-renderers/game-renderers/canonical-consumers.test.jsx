import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { buildQuestionLookup, getDailyDoubleKeys } from './jeopardy-shared'
import { JeopardyBoard } from './jeopardy-board'
import { JeopardyQuestionModal } from './jeopardy-question-modal'
import { HotPotatoRenderer } from './hot-potato'
import { WheelRenderer } from './name-picker'
import { createCanonicalQuestion } from 'revealjs-shared'
const q = {
  id: 'cell-earth',
  kind: 'single-choice',
  prompt: 'Choose Earth',
  points: 100,
  timeLimit: 30,
  media: { src: '/uploads/earth.png', alt: 'Earth image' },
  options: [
    { id: 'earth', text: 'Earth' },
    { id: 'mars', text: 'Mars' },
  ],
  answerKey: { optionId: 'earth' },
  feedback: { correct: '', incorrect: '', explanation: '' },
}
describe('canonical retained renderer consumers', () => {
  it('keeps daily double and used cell identity when categories and questions move', () => {
    const element = {
      categories: [
        { id: 'science', title: 'Science', questions: [q] },
        { id: 'history', title: 'History', questions: [] },
      ],
      dailyDouble: [q.id],
    }
    element.categories.reverse()
    expect(buildQuestionLookup(element)[q.id]).toBe(q)
    const select = []
    render(
      <JeopardyBoard
        element={element}
        ddKeys={getDailyDoubleKeys(element)}
        usedCells={{}}
        onCellClick={(...args) => select.push(args)}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Science, 100 points, Daily Double' }))
    expect(select).toEqual([['science', 'cell-earth']])
  })
  it('shows canonical question image and reveals the stable answer after option reorder', () => {
    render(
      <JeopardyQuestionModal
        question={{
          ...q,
          options: [...q.options].reverse(),
          feedback: { ...q.feedback, explanation: 'Recall the planet lesson' },
        }}
        showAnswer={true}
        pts={100}
      />
    )
    expect(screen.getByTestId('game-question').textContent).toBe('Choose Earth')
    expect(screen.getByAltText('Earth image').getAttribute('src')).toBe('/uploads/earth.png')
    expect(screen.getByText('Earth')).toBeTruthy()
    expect(screen.getByText('Recall the planet lesson')).toBeTruthy()
  })
  it.each([
    ['multi-choice', 'Option A'],
    ['true-false', 'True'],
    [
      'fill-blank',
      'Hà Nội, Hanoi',
      { answerKey: { accepted: ['Hà Nội', 'Hanoi'], caseSensitive: false } },
    ],
    ['ordering', 'Option A → Option B'],
    ['matching', 'Left item → Right item'],
    ['image-hotspot', 'Target'],
  ])(
    'reveals canonical %s answer references without legacy placeholders',
    (kind, expected, overrides = {}) => {
      render(
        <JeopardyQuestionModal
          question={createCanonicalQuestion({ id: 'authored', kind, ...overrides })}
          showAnswer={true}
          pts={100}
        />
      )
      expect(screen.getByText(expected, { exact: true })).toBeTruthy()
    }
  )
  it('keeps hot potato preview inert while displaying authored prompt and media', () => {
    render(<HotPotatoRenderer element={{ questions: [q] }} />)
    expect(screen.getByText('Choose Earth')).toBeTruthy()
    expect(screen.getByAltText('Earth image')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
  it('displays canonical picker labels rather than object coercion', () => {
    render(
      <WheelRenderer
        element={{
          items: [
            { id: 'ada', label: 'Ada', weight: 1 },
            { id: 'lin', label: 'Lin', weight: 2 },
          ],
        }}
      />
    )
    expect(screen.getByText('2 items — Ada, Lin')).toBeTruthy()
    expect(screen.queryByText(/\[object Object\]/)).toBeNull()
  })
})

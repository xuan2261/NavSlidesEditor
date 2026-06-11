import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import FindReplaceBar from './FindReplaceBar'
import { replaceAllInSlides } from './find-replace-helpers'

// Deck: parent slide 0 has the term once; parent slide 1 has a vertical child
// (children[0]) that also contains the term. Find must surface BOTH; Replace All
// must rewrite BOTH; navigation must land on the right (parent vs child) slide.
function makeDeck() {
  return {
    id: 'p1',
    slides: [
      {
        id: 's0',
        elements: [{ id: 'e0', type: 'text', content: '<p>hello world</p>' }],
      },
      {
        id: 's1',
        elements: [{ id: 'e1', type: 'text', content: '<p>nothing here</p>' }],
        children: [
          {
            id: 's1c0',
            elements: [{ id: 'e2', type: 'text', content: '<p>hello again</p>' }],
          },
        ],
      },
    ],
  }
}

describe('Find & Replace — vertical child slides', () => {
  it('search finds matches inside slide.children[].elements', () => {
    render(
      <FindReplaceBar
        presentation={makeDeck()}
        onUpdatePresentation={() => {}}
        currentSlideIndex={0}
        onNavigateToSlide={() => {}}
        onClose={() => {}}
      />
    )
    fireEvent.change(screen.getByPlaceholderText('Find...'), { target: { value: 'hello' } })
    // 2 matches: parent slide 0 + child of slide 1
    expect(screen.getByText('2 matches found')).toBeTruthy()
  })

  it('navigation across parent + child matches reports the right slide index and child coord', () => {
    const onNavigateToSlide = vi.fn()
    render(
      <FindReplaceBar
        presentation={makeDeck()}
        onUpdatePresentation={() => {}}
        currentSlideIndex={0}
        onNavigateToSlide={onNavigateToSlide}
        onClose={() => {}}
      />
    )
    const input = screen.getByPlaceholderText('Find...')
    fireEvent.change(input, { target: { value: 'hello' } })
    // Next → match #2 (the child). Should navigate to parent index 1 with child 0.
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onNavigateToSlide).toHaveBeenLastCalledWith(1, 0)
    // counter shows 2/2
    expect(screen.getByText('2/2')).toBeTruthy()
    // Next again wraps to match #1 (parent slide 0, no child)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onNavigateToSlide).toHaveBeenLastCalledWith(0, undefined)
    expect(screen.getByText('1/2')).toBeTruthy()
  })

  it('Replace All rewrites text in both parent and child slides', () => {
    const onUpdatePresentation = vi.fn()
    render(
      <FindReplaceBar
        presentation={makeDeck()}
        onUpdatePresentation={onUpdatePresentation}
        currentSlideIndex={0}
        onNavigateToSlide={() => {}}
        onClose={() => {}}
      />
    )
    fireEvent.change(screen.getByPlaceholderText('Find...'), { target: { value: 'hello' } })
    // open replace row
    fireEvent.click(screen.getByTitle('Toggle replace'))
    fireEvent.change(screen.getByPlaceholderText('Replace...'), { target: { value: 'HI' } })
    fireEvent.click(screen.getByText('All'))

    expect(onUpdatePresentation).toHaveBeenCalledTimes(1)
    const { slides } = onUpdatePresentation.mock.calls[0][0]
    expect(slides[0].elements[0].content).toContain('HI world')
    expect(slides[1].children[0].elements[0].content).toContain('HI again')
  })
})

describe('replaceAllInSlides — child traversal (pure)', () => {
  it('replaces in children[].elements without dropping child structure', () => {
    const out = replaceAllInSlides(makeDeck().slides, 'hello', 'HI', false)
    expect(out[0].elements[0].content).toContain('HI world')
    expect(out[1].children[0].elements[0].content).toContain('HI again')
    // untouched sibling text preserved
    expect(out[1].elements[0].content).toContain('nothing here')
  })
})

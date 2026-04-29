/**
 * Unit tests for GamePropertiesQuestionEditor.
 *
 * Test strategy (matches AnimationPreviewModal.test.jsx pattern):
 * - Test buildDefaultForm pure function directly
 * - Test component rendering via renderToString + React.createElement
 * - Verify output contains expected markup, attributes, and labels
 */
import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, it, expect, vi } from 'vitest'
import { GamePropertiesQuestionEditor, buildDefaultForm } from './game-properties-question-editor'

// ── Pure function tests ────────────────────────────────────────────────────────
describe('buildDefaultForm', () => {
  it('creates empty form with 4 blank options for new question', () => {
    const form = buildDefaultForm(null)
    expect(form.question).toBe('')
    expect(form.options).toEqual(['', '', '', ''])
    expect(form.correctIndex).toBe(0)
    expect(form.timeLimit).toBe(30)
    expect(form.points).toBe(10)
    expect(form.id).toMatch(/^q-\d+$/)
  })

  it('preserves id and all fields when editing existing question', () => {
    const existing = { id: 'q-123', question: 'What?', options: ['A', 'B', 'C', 'D'], correctIndex: 2, timeLimit: 45, points: 20 }
    const form = buildDefaultForm(existing)
    expect(form.id).toBe('q-123')
    expect(form.question).toBe('What?')
    expect(form.options).toEqual(['A', 'B', 'C', 'D'])
    expect(form.correctIndex).toBe(2)
    expect(form.timeLimit).toBe(45)
    expect(form.points).toBe(20)
  })

  it('applies defaults for missing fields in partial question', () => {
    const partial = { id: 'q-99', question: 'Partial' }
    const form = buildDefaultForm(partial)
    expect(form.options).toEqual(['', '', '', ''])
    expect(form.correctIndex).toBe(0)
    expect(form.timeLimit).toBe(30)
    expect(form.points).toBe(10)
  })
})

// ── Render tests ──────────────────────────────────────────────────────────────
function render(props) {
  return renderToString(
    React.createElement(GamePropertiesQuestionEditor, props)
  )
}

describe('GamePropertiesQuestionEditor renders', () => {
  it('returns empty when isOpen is false', () => {
    const html = render({ isOpen: false, onSave: vi.fn(), onCancel: vi.fn(), question: null })
    expect(html).toBe('')
  })

  it('shows Add Question title for new question', () => {
    const html = render({ isOpen: true, onSave: vi.fn(), onCancel: vi.fn(), question: null })
    expect(html).toContain('Add Question')
    expect(html).not.toContain('Edit Question')
  })

  it('shows Edit Question title when editing existing question', () => {
    const existing = { id: 'q-1', question: 'Test?', options: ['A','B','C','D'], correctIndex: 0, timeLimit: 30, points: 10 }
    const html = render({ isOpen: true, onSave: vi.fn(), onCancel: vi.fn(), question: existing })
    expect(html).toContain('Edit Question')
  })

  it('renders 4 option placeholders (A/B/C/D)', () => {
    const html = render({ isOpen: true, onSave: vi.fn(), onCancel: vi.fn(), question: null })
    expect(html.match(/Option A/g)).toHaveLength(1)
    expect(html.match(/Option B/g)).toHaveLength(1)
    expect(html.match(/Option C/g)).toHaveLength(1)
    expect(html.match(/Option D/g)).toHaveLength(1)
  })

  it('renders question textarea placeholder', () => {
    const html = render({ isOpen: true, onSave: vi.fn(), onCancel: vi.fn(), question: null })
    expect(html).toContain('Enter your question')
  })

  it('renders time limit with default 30s', () => {
    const html = render({ isOpen: true, onSave: vi.fn(), onCancel: vi.fn(), question: null })
    expect(html).toContain('value="30"')
  })

  it('renders points with default 10', () => {
    const html = render({ isOpen: true, onSave: vi.fn(), onCancel: vi.fn(), question: null })
    expect(html).toContain('value="10"')
  })

  it('renders Save and Cancel buttons', () => {
    const html = render({ isOpen: true, onSave: vi.fn(), onCancel: vi.fn(), question: null })
    expect(html).toMatch(/Save<\/button>/)
    expect(html).toMatch(/Cancel<\/button>/)
  })

  it('renders X close button with aria-label', () => {
    const html = render({ isOpen: true, onSave: vi.fn(), onCancel: vi.fn(), question: null })
    expect(html).toContain('aria-label="Close"')
  })

  it('pre-fills question text when editing', () => {
    const existing = { id: 'q-1', question: 'What is 2+2?', options: ['3','4','5','6'], correctIndex: 1, timeLimit: 30, points: 10 }
    const html = render({ isOpen: true, onSave: vi.fn(), onCancel: vi.fn(), question: existing })
    expect(html).toContain('What is 2+2?')
  })

  it('pre-fills all 4 options when editing', () => {
    const existing = { id: 'q-1', question: 'Q?', options: ['X','Y','Z','W'], correctIndex: 0, timeLimit: 30, points: 10 }
    const html = render({ isOpen: true, onSave: vi.fn(), onCancel: vi.fn(), question: existing })
    expect(html).toContain('value="X"')
    expect(html).toContain('value="Y"')
    expect(html).toContain('value="Z"')
    expect(html).toContain('value="W"')
  })

  it('renders correctIndex 2 with green highlight on C', () => {
    const existing = { id: 'q-1', question: 'Q?', options: ['A','B','C','D'], correctIndex: 2, timeLimit: 30, points: 10 }
    const html = render({ isOpen: true, onSave: vi.fn(), onCancel: vi.fn(), question: existing })
    expect(html).toContain('bg-green-500')
  })

  it('renders dialog with accessibility attributes', () => {
    const html = render({ isOpen: true, onSave: vi.fn(), onCancel: vi.fn(), question: null })
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('aria-labelledby="qeditor-title"')
  })

  it('renders Time Limit and Points labels', () => {
    const html = render({ isOpen: true, onSave: vi.fn(), onCancel: vi.fn(), question: null })
    expect(html).toContain('Time Limit')
    expect(html).toContain('Points')
  })

  it('renders overlay backdrop', () => {
    const html = render({ isOpen: true, onSave: vi.fn(), onCancel: vi.fn(), question: null })
    expect(html).toContain('fixed inset-0 z-[100]')
    expect(html).toContain('bg-black/60')
  })

  it('renders required field indicator for question', () => {
    const html = render({ isOpen: true, onSave: vi.fn(), onCancel: vi.fn(), question: null })
    expect(html).toContain('Question')
    expect(html).toContain('*')
  })

  it('renders options section with required indicator', () => {
    const html = render({ isOpen: true, onSave: vi.fn(), onCancel: vi.fn(), question: null })
    expect(html).toContain('Options')
    expect(html).toContain('*')
  })
})

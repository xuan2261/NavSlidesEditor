import { describe, expect, it } from 'vitest'
import { normalizeElementAction, serializeElementAction } from '../src/element-actions.js'

describe('element action policy', () => {
  it('normalizes every supported action kind without mutating source metadata', () => {
    const actions = [
      { kind: 'url', url: 'https://example.test' }, { kind: 'slide', slideId: 'child-id' },
      { kind: 'next' }, { kind: 'previous' }, { kind: 'first' }, { kind: 'last' },
      { kind: 'email', url: 'mailto:author@example.test' }, { kind: 'download', url: '/files/slides.pdf', target: 'new' },
    ]
    actions.forEach((source) => {
      const before = JSON.stringify(source)
      expect(normalizeElementAction(source).action).toMatchObject({ kind: source.kind })
      expect(JSON.stringify(source)).toBe(before)
    })
  })

  it('rejects kind-incompatible, unsafe, malformed, and unknown actions', () => {
    expect(normalizeElementAction({ kind: 'slide' }).error).toContain('destination')
    expect(normalizeElementAction({ kind: 'email', url: 'https://example.test' }).action).toBeNull()
    expect(normalizeElementAction({ kind: 'url', url: 'javascript:alert(1)' }).action).toBeNull()
    expect(normalizeElementAction({ kind: 'url', url: 'https://example.test/\nnext' }).action).toBeNull()
    expect(normalizeElementAction({ kind: 'script', url: 'https://example.test' }).action).toBeNull()
  })

  it('serializes normalized action data without executable HTML delimiters', () => {
    expect(serializeElementAction({ kind: 'url', url: 'https://example.test/<script>' })).toBe('')
    expect(serializeElementAction({ kind: 'next', label: 'Go <now>' })).not.toContain('<')
  })
})

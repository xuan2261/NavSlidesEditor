import { describe, expect, it } from 'vitest'
import { reconcileSelectionAfterHistory } from '../utils/history-selection-reconciler'

const slide = (...ids) => ({ id: 's1', elements: ids.map((id) => ({ id })) })

describe('reconcileSelectionAfterHistory', () => {
  it('drops selected ids whose elements no longer exist on the restored slide', () => {
    const result = reconcileSelectionAfterHistory(slide('a', 'b'), ['a', 'b', 'ghost'], null)
    expect(result.selectedIds).toEqual(['a', 'b'])
  })

  it('keeps editing intact when the edited element survived the restore', () => {
    const result = reconcileSelectionAfterHistory(slide('a', 'b'), ['a'], 'a')
    expect(result.editingId).toBe('a')
    expect(result.editingCleared).toBe(false)
  })

  it('clears editing when the edited element vanished from the restored slide', () => {
    const result = reconcileSelectionAfterHistory(slide('a'), ['a'], 'removed')
    expect(result.editingId).toBeNull()
    expect(result.editingCleared).toBe(true)
  })

  it('clears editing when the restored slide has no elements at all', () => {
    const result = reconcileSelectionAfterHistory(slide(), ['gone'], 'gone')
    expect(result.selectedIds).toEqual([])
    expect(result.editingId).toBeNull()
    expect(result.editingCleared).toBe(true)
  })

  it('reconciles against the active vertical child slide when one is supplied', () => {
    const childSlide = { id: 'c1', elements: [{ id: 'child-a' }] }
    const result = reconcileSelectionAfterHistory(childSlide, ['child-a', 'child-stale'], 'child-stale')
    expect(result.selectedIds).toEqual(['child-a'])
    expect(result.editingCleared).toBe(true)
  })

  it('treats a missing restored slide as everything gone', () => {
    const result = reconcileSelectionAfterHistory(undefined, ['a'], 'a')
    expect(result.selectedIds).toEqual([])
    expect(result.editingId).toBeNull()
    expect(result.editingCleared).toBe(true)
  })
})

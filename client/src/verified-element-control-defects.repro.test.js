/**
 * Regression harness for ck-debug-verified element/control interaction defects
 * (plan 260709-0917). Asserts the corrected behaviors from phases 1–3.
 */
import { describe, expect, it } from 'vitest'
import { createCutOperation, createDuplicateOperation } from './hooks/use-clipboard'
import { normalizeTableShape } from './components/properties/table-properties-utils'
import { replaceAllInSlides } from './components/find-replace-helpers'
import { ELEMENT_DEFAULTS } from './data/element-defaults'
import { MIN_SIZE } from './components/canvas/use-canvas-resize-rotate'
import { getBlockedActionNotice } from './utils/blocked-action-notice'

describe('V1 cut lock policy matches duplicate', () => {
  const els = [
    { id: 'a', type: 'shape', locked: false, x: 0, y: 0 },
    { id: 'b', type: 'shape', locked: true, x: 10, y: 10 },
  ]

  it('createCutOperation and createDuplicateOperation both skip locked members', () => {
    const cut = createCutOperation({ slideElements: els, selectedElementIds: ['a', 'b'] })
    const dup = createDuplicateOperation({ slideElements: els, selectedElementIds: ['a', 'b'] })
    expect(cut.idsToDelete).toEqual(['a'])
    expect(dup.toAdd).toHaveLength(1)
    expect(dup.toAdd[0].locked).toBeFalsy()
  })
})

describe('V2 table merge preserve on append', () => {
  it('normalizeTableShape preserves a 2x2 merge across append row', () => {
    const next = normalizeTableShape(
      {
        data: [
          ['A', 'B'],
          ['C', 'D'],
          ['', ''],
        ],
      },
      {
        data: [
          ['A', 'B'],
          ['C', 'D'],
        ],
        mergedCells: [{ row: 0, col: 0, rowSpan: 2, colSpan: 2 }],
      }
    )
    expect(next.mergedCells).toEqual([{ row: 0, col: 0, rowSpan: 2, colSpan: 2 }])
  })
})

describe('V3 find-replace table coverage', () => {
  it('replaceAllInSlides updates table.data', () => {
    const slides = [
      {
        id: 's1',
        elements: [{ id: 't1', type: 'table', data: [['hello', 'x']] }],
      },
    ]
    const next = replaceAllInSlides(slides, 'hello', 'world', false)
    expect(next[0].elements[0].data[0][0]).toBe('world')
  })
})

describe('V5 callout vs MIN_SIZE', () => {
  it('callout defaults are not below canvas MIN_SIZE', () => {
    expect(ELEMENT_DEFAULTS.callout.width).toBeGreaterThanOrEqual(MIN_SIZE)
    expect(ELEMENT_DEFAULTS.callout.height).toBeGreaterThanOrEqual(MIN_SIZE)
  })
})

describe('V4 blocked notice copy', () => {
  it('exposes a group-locked message', () => {
    expect(getBlockedActionNotice('group-locked')).toMatch(/locked/i)
  })
})

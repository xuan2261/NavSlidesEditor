/**
 * Unit tests for useClipboard pure functions.
 *
 * Test strategy:
 * - Test pure functions (createCopyOperation, createPasteOperation,
 *   createDuplicateOperation, createCutOperation) directly — no React context needed
 * - Mock crypto.randomUUID for deterministic IDs
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createCopyOperation,
  createPasteOperation,
  createDuplicateOperation,
  createCutOperation,
} from './use-clipboard'

// Mock crypto.randomUUID for deterministic IDs
const mockUUIDs = ['uuid-0', 'uuid-1', 'uuid-2', 'uuid-3']
let uuidIndex = 0
vi.stubGlobal('crypto', {
  randomUUID: () => mockUUIDs[uuidIndex++] || `uuid-${uuidIndex}`,
})

describe('createCopyOperation', () => {
  const makeEl = (id, overrides = {}) => ({
    id,
    type: 'shape',
    x: 100,
    y: 100,
    width: 200,
    height: 100,
    locked: false,
    ...overrides,
  })

  beforeEach(() => { uuidIndex = 0 })

  it('returns null when no elements selected', () => {
    const result = createCopyOperation({
      slideElements: [makeEl('el-1')],
      selectedElementIds: [],
    })
    expect(result).toBeNull()
  })

  it('returns null when slideElements is empty/null', () => {
    expect(createCopyOperation({ slideElements: null, selectedElementIds: ['el-1'] })).toBeNull()
    expect(createCopyOperation({ slideElements: [], selectedElementIds: ['el-1'] })).toBeNull()
  })

  it('[cap:flow.clipboard tier:deep] stores correct elements with IDs stripped', () => {
    const result = createCopyOperation({
      slideElements: [
        makeEl('el-1', { type: 'text', content: 'Hello' }),
        makeEl('el-2', { type: 'shape', shapeType: 'rect' }),
        makeEl('el-3', { type: 'image', src: 'http://example.com/img.png' }),
      ],
      selectedElementIds: ['el-1', 'el-3'],
    })
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ type: 'text', content: 'Hello' })
    expect(result[0].id).toBeUndefined()
    expect(result[1]).toMatchObject({ type: 'image' })
    expect(result[1].id).toBeUndefined()
  })

  it('returns null when no selected elements exist on slide', () => {
    const result = createCopyOperation({
      slideElements: [makeEl('el-1')],
      selectedElementIds: ['el-missing'],
    })
    expect(result).toBeNull()
  })
})

describe('createPasteOperation', () => {
  const makeEl = (id, overrides = {}) => ({
    id,
    type: 'shape',
    x: 50,
    y: 75,
    width: 200,
    height: 100,
    ...overrides,
  })

  beforeEach(() => { uuidIndex = 0 })

  it('returns empty when clipboard is null/empty', () => {
    expect(createPasteOperation({ clipboardElements: null })).toEqual({ elements: [], allIds: [], lastId: null })
    expect(createPasteOperation({ clipboardElements: [] })).toEqual({ elements: [], allIds: [], lastId: null })
  })

  it('creates elements with fresh UUIDs and +20/+20 offset', () => {
    const result = createPasteOperation({
      clipboardElements: [{ ...makeEl('el-copy', { x: 50, y: 75 }), id: undefined }],
    })
    expect(result.elements).toHaveLength(1)
    expect(result.elements[0].id).toBe('uuid-0')
    expect(result.elements[0].x).toBe(70) // 50 + 20
    expect(result.elements[0].y).toBe(95) // 75 + 20
    expect(result.lastId).toBe('uuid-0')
    expect(result.allIds).toEqual(['uuid-0'])
  })

  it('selects last element (lastId) when pasting multiple', () => {
    const result = createPasteOperation({
      clipboardElements: [
        { ...makeEl('el-a', { x: 10, y: 10 }), id: undefined },
        { ...makeEl('el-b', { x: 20, y: 20 }), id: undefined },
        { ...makeEl('el-c', { x: 30, y: 30 }), id: undefined },
      ],
    })
    expect(result.elements).toHaveLength(3)
    expect(result.elements[0].id).toBe('uuid-0')
    expect(result.elements[1].id).toBe('uuid-1')
    expect(result.elements[2].id).toBe('uuid-2')
    expect(result.lastId).toBe('uuid-2')
    expect(result.allIds).toEqual(['uuid-0', 'uuid-1', 'uuid-2'])
  })

  it('handles missing x/y with default 0 offset', () => {
    const result = createPasteOperation({
      clipboardElements: [{ type: 'shape', id: undefined, x: null, y: undefined }],
    })
    expect(result.elements[0].x).toBe(20)
    expect(result.elements[0].y).toBe(20)
  })
})

describe('createCutOperation', () => {
  const makeEl = (id, overrides = {}) => ({
    id,
    type: 'shape',
    x: 100,
    y: 100,
    locked: false,
    ...overrides,
  })

  beforeEach(() => { uuidIndex = 0 })

  it('returns empty when nothing selected', () => {
    const result = createCutOperation({
      slideElements: [makeEl('el-1')],
      selectedElementIds: [],
    })
    expect(result).toEqual({ clipboardData: null, idsToDelete: [] })
  })

  it('returns clipboard data with IDs stripped and idsToDelete', () => {
    const result = createCutOperation({
      slideElements: [
        makeEl('el-1', { type: 'text', content: 'Hello' }),
        makeEl('el-2', { type: 'shape' }),
        makeEl('el-3', { type: 'image' }),
      ],
      selectedElementIds: ['el-1', 'el-3'],
    })
    expect(result.idsToDelete).toEqual(['el-1', 'el-3'])
    expect(result.clipboardData).toHaveLength(2)
    expect(result.clipboardData[0]).toMatchObject({ type: 'text' })
    expect(result.clipboardData[0].id).toBeUndefined()
    expect(result.clipboardData[1]).toMatchObject({ type: 'image' })
    expect(result.clipboardData[1].id).toBeUndefined()
  })
})

describe('createDuplicateOperation', () => {
  const makeEl = (id, overrides = {}) => ({
    id,
    type: 'shape',
    x: 100,
    y: 100,
    width: 200,
    height: 100,
    locked: false,
    ...overrides,
  })

  beforeEach(() => { uuidIndex = 0 })

  it('returns empty when nothing selected', () => {
    const result = createDuplicateOperation({
      slideElements: [makeEl('el-1')],
      selectedElementIds: [],
    })
    expect(result).toEqual({ toAdd: [], clipboardData: null, lastId: null })
  })

  it('SYNC — returns elements immediately (no setTimeout)', () => {
    const result = createDuplicateOperation({
      slideElements: [makeEl('el-1', { x: 100, y: 100 })],
      selectedElementIds: ['el-1'],
    })
    expect(result.toAdd).toHaveLength(1)
    expect(result.toAdd[0].id).toBe('uuid-0')
    expect(result.toAdd[0].x).toBe(120) // 100 + 20
    expect(result.toAdd[0].y).toBe(120) // 100 + 20
    expect(result.lastId).toBe('uuid-0')
  })

  it('uses crypto.randomUUID for fresh IDs (not original IDs)', () => {
    const result = createDuplicateOperation({
      slideElements: [
        makeEl('el-1', { x: 10, y: 10 }),
        makeEl('el-2', { x: 20, y: 20 }),
      ],
      selectedElementIds: ['el-1', 'el-2'],
    })
    expect(result.toAdd).toHaveLength(2)
    expect(result.toAdd[0].id).toBe('uuid-0')
    expect(result.toAdd[1].id).toBe('uuid-1')
    expect(result.toAdd[0].id).not.toBe('el-1')
    expect(result.toAdd[1].id).not.toBe('el-2')
  })

  it('+20/+20 offset preserved', () => {
    const result = createDuplicateOperation({
      slideElements: [makeEl('el-1', { x: 500, y: 300, width: 150, height: 75 })],
      selectedElementIds: ['el-1'],
    })
    const dup = result.toAdd[0]
    expect(dup.x).toBe(520)
    expect(dup.y).toBe(320)
    expect(dup.width).toBe(150)
    expect(dup.height).toBe(75)
  })

  it('LOCKED guard — returns empty if any selected element is locked', () => {
    const result = createDuplicateOperation({
      slideElements: [
        makeEl('el-1', { locked: false }),
        makeEl('el-2', { locked: true }), // locked blocks entire operation
        makeEl('el-3', { locked: false }),
      ],
      selectedElementIds: ['el-1', 'el-2', 'el-3'],
    })
    expect(result.toAdd).toHaveLength(0)
    expect(result.clipboardData).toBeNull()
    expect(result.lastId).toBeNull()
  })

  it('sets clipboard with original elements (IDs stripped)', () => {
    const result = createDuplicateOperation({
      slideElements: [makeEl('el-1', { type: 'text', content: 'Hello' })],
      selectedElementIds: ['el-1'],
    })
    expect(result.clipboardData).toHaveLength(1)
    expect(result.clipboardData[0]).toMatchObject({ type: 'text', content: 'Hello' })
    expect(result.clipboardData[0].id).toBeUndefined()
  })

  it('returns null clipboardData when no matching elements found', () => {
    const result = createDuplicateOperation({
      slideElements: [makeEl('el-1')],
      selectedElementIds: ['el-missing'],
    })
    expect(result).toEqual({ toAdd: [], clipboardData: null, lastId: null })
  })
})

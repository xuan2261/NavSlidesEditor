import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAnnotationSync } from './use-annotation-sync.js'

function createMockSocket() {
  const handlers = {}
  return {
    on: vi.fn((event, _handler) => { handlers[event] = _handler }),
    off: vi.fn((event, _handler) => { delete handlers[event] }),
    _trigger: (event, payload) => handlers[event]?.(payload),
    _handlers: handlers,
  }
}

describe('useAnnotationSync', () => {
  let mockSocket

  beforeEach(() => {
    mockSocket = createMockSocket()
  })

  it('registers socket listeners on mount and removes on unmount', () => {
    const { unmount } = renderHook(() =>
      useAnnotationSync({
        socket: mockSocket,
        slideIndex: 0,
        onAnnotationAdd: vi.fn(),
        onAnnotationRemove: vi.fn(),
        onAnnotationsClear: vi.fn(),
      })
    )

    expect(mockSocket.on).toHaveBeenCalledTimes(4)
    expect(mockSocket.on).toHaveBeenCalledWith('annotation:add', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('annotation:removed', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('annotation:cleared', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('annotations:sync', expect.any(Function))

    unmount()
    expect(mockSocket.off).toHaveBeenCalledTimes(4)
  })

  it('calls onAnnotationAdd when annotation:add matches current slide', () => {
    const onAdd = vi.fn()
    renderHook(() =>
      useAnnotationSync({
        socket: mockSocket,
        slideIndex: 0,
        onAnnotationAdd: onAdd,
        onAnnotationRemove: vi.fn(),
        onAnnotationsClear: vi.fn(),
      })
    )

    const annotation = { id: 'a1', d: 'M0 0 L10 10', color: '#FF0000', strokeWidth: 3 }
    mockSocket._trigger('annotation:add', { slideIndex: 0, annotation })

    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onAdd).toHaveBeenCalledWith(annotation)
  })

  it('ignores annotation:add for a different slide', () => {
    const onAdd = vi.fn()
    renderHook(() =>
      useAnnotationSync({
        socket: mockSocket,
        slideIndex: 0,
        onAnnotationAdd: onAdd,
        onAnnotationRemove: vi.fn(),
        onAnnotationsClear: vi.fn(),
      })
    )

    mockSocket._trigger('annotation:add', { slideIndex: 2, annotation: { id: 'a1' } })
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('calls onAnnotationRemove when annotation:removed matches current slide', () => {
    const onRemove = vi.fn()
    renderHook(() =>
      useAnnotationSync({
        socket: mockSocket,
        slideIndex: 0,
        onAnnotationAdd: vi.fn(),
        onAnnotationRemove: onRemove,
        onAnnotationsClear: vi.fn(),
      })
    )

    mockSocket._trigger('annotation:removed', { slideIndex: 0, annotationId: 'a1' })
    expect(onRemove).toHaveBeenCalledTimes(1)
    expect(onRemove).toHaveBeenCalledWith('a1')
  })

  it('ignores annotation:removed for a different slide', () => {
    const onRemove = vi.fn()
    renderHook(() =>
      useAnnotationSync({
        socket: mockSocket,
        slideIndex: 0,
        onAnnotationAdd: vi.fn(),
        onAnnotationRemove: onRemove,
        onAnnotationsClear: vi.fn(),
      })
    )

    mockSocket._trigger('annotation:removed', { slideIndex: 5, annotationId: 'a1' })
    expect(onRemove).not.toHaveBeenCalled()
  })

  it('calls onAnnotationsClear when annotation:cleared matches current slide', () => {
    const onClear = vi.fn()
    renderHook(() =>
      useAnnotationSync({
        socket: mockSocket,
        slideIndex: 0,
        onAnnotationAdd: vi.fn(),
        onAnnotationRemove: vi.fn(),
        onAnnotationsClear: onClear,
      })
    )

    mockSocket._trigger('annotation:cleared', { slideIndex: 0 })
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('ignores annotation:cleared for a different slide', () => {
    const onClear = vi.fn()
    renderHook(() =>
      useAnnotationSync({
        socket: mockSocket,
        slideIndex: 0,
        onAnnotationAdd: vi.fn(),
        onAnnotationRemove: vi.fn(),
        onAnnotationsClear: onClear,
      })
    )

    mockSocket._trigger('annotation:cleared', { slideIndex: 3 })
    expect(onClear).not.toHaveBeenCalled()
  })

  it('loads annotations from annotations:sync for current slide only', () => {
    const onAdd = vi.fn()
    renderHook(() =>
      useAnnotationSync({
        socket: mockSocket,
        slideIndex: 0,
        onAnnotationAdd: onAdd,
        onAnnotationRemove: vi.fn(),
        onAnnotationsClear: vi.fn(),
      })
    )

    mockSocket._trigger('annotations:sync', {
      slideAnnotations: {
        '0': [
          { id: 'a1', d: 'M0 0', color: '#FF0000' },
          { id: 'a2', d: 'M1 1 L2 2', color: '#00FF00' },
        ],
        '1': [{ id: 'a3', d: 'M3 3', color: '#0000FF' }],
        '2': [{ id: 'a4', d: 'M4 4', color: '#FFFF00' }],
      },
    })

    // Only slide 0's annotations should be added (2 calls)
    expect(onAdd).toHaveBeenCalledTimes(2)
    expect(onAdd).toHaveBeenNthCalledWith(1, { id: 'a1', d: 'M0 0', color: '#FF0000' })
    expect(onAdd).toHaveBeenNthCalledWith(2, { id: 'a2', d: 'M1 1 L2 2', color: '#00FF00' })
  })

  it('does nothing when socket is null', () => {
    const { result: _result } = renderHook(() =>
      useAnnotationSync({
        socket: null,
        slideIndex: 0,
        onAnnotationAdd: vi.fn(),
        onAnnotationRemove: vi.fn(),
        onAnnotationsClear: vi.fn(),
      })
    )
    expect(mockSocket.on).not.toHaveBeenCalled()
  })

  it('deduplicates: annotation from event is not re-added by annotations:sync', () => {
    const onAdd = vi.fn()
    renderHook(() =>
      useAnnotationSync({
        socket: mockSocket,
        slideIndex: 0,
        onAnnotationAdd: onAdd,
        onAnnotationRemove: vi.fn(),
        onAnnotationsClear: vi.fn(),
      })
    )

    const annotation = { id: 'a1', d: 'M0 0', color: '#FF0000' }
    // First: annotation arrives via event
    mockSocket._trigger('annotation:add', { slideIndex: 0, annotation })
    // Second: annotations:sync arrives later with the same annotation
    mockSocket._trigger('annotations:sync', {
      slideAnnotations: { '0': [annotation] },
    })

    // Should only be added once
    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onAdd).toHaveBeenCalledWith(annotation)
  })

  it('clears seen IDs on annotation:cleared so re-adds are allowed', () => {
    const onAdd = vi.fn()
    const onClear = vi.fn()
    renderHook(() =>
      useAnnotationSync({
        socket: mockSocket,
        slideIndex: 0,
        onAnnotationAdd: onAdd,
        onAnnotationRemove: vi.fn(),
        onAnnotationsClear: onClear,
      })
    )

    const ann = { id: 'a1', d: 'M0 0' }
    mockSocket._trigger('annotation:add', { slideIndex: 0, annotation: ann })
    expect(onAdd).toHaveBeenCalledTimes(1)

    // Clear removes the ID from seen set
    mockSocket._trigger('annotation:cleared', { slideIndex: 0 })
    expect(onClear).toHaveBeenCalledTimes(1)

    // Re-adding same annotation should succeed (ID was cleared)
    mockSocket._trigger('annotation:add', { slideIndex: 0, annotation: ann })
    expect(onAdd).toHaveBeenCalledTimes(2)
  })

  it('clears seen IDs on annotation:remove so re-adds are allowed', () => {
    const onAdd = vi.fn()
    renderHook(() =>
      useAnnotationSync({
        socket: mockSocket,
        slideIndex: 0,
        onAnnotationAdd: onAdd,
        onAnnotationRemove: vi.fn(),
        onAnnotationsClear: vi.fn(),
      })
    )

    const ann = { id: 'a1', d: 'M0 0' }
    mockSocket._trigger('annotation:add', { slideIndex: 0, annotation: ann })
    expect(onAdd).toHaveBeenCalledTimes(1)

    // Remove removes the ID from seen set
    mockSocket._trigger('annotation:removed', { slideIndex: 0, annotationId: 'a1' })

    // Re-adding same annotation should succeed
    mockSocket._trigger('annotation:add', { slideIndex: 0, annotation: ann })
    expect(onAdd).toHaveBeenCalledTimes(2)
  })

  it('clears seen IDs on unmount', () => {
    const onAdd = vi.fn()
    const { unmount } = renderHook(() =>
      useAnnotationSync({
        socket: mockSocket,
        slideIndex: 0,
        onAnnotationAdd: onAdd,
        onAnnotationRemove: vi.fn(),
        onAnnotationsClear: vi.fn(),
      })
    )

    mockSocket._trigger('annotation:add', { slideIndex: 0, annotation: { id: 'a1' } })
    expect(onAdd).toHaveBeenCalledTimes(1)

    unmount()
    expect(mockSocket.off).toHaveBeenCalledTimes(4)
  })
})

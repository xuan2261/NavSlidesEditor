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

    expect(mockSocket.on).toHaveBeenCalledTimes(6)
    expect(mockSocket.on).toHaveBeenCalledWith('annotation:add', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('annotation:removed', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('annotation:cleared', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('annotations:sync', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('navigate', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('sync-state', expect.any(Function))

    unmount()
    expect(mockSocket.off).toHaveBeenCalledTimes(6)
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
    expect(onAdd).toHaveBeenCalledWith(annotation, 0)
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

  it('keeps annotations on vertical child slides separate', () => {
    const onAdd = vi.fn()
    renderHook(() =>
      useAnnotationSync({
        socket: mockSocket,
        slideIndex: 0,
        verticalIndex: 1,
        onAnnotationAdd: onAdd,
        onAnnotationRemove: vi.fn(),
        onAnnotationsClear: vi.fn(),
      })
    )

    const rootAnnotation = { id: 'root-stroke' }
    const childAnnotation = { id: 'child-stroke' }
    mockSocket._trigger('annotation:add', { slideIndex: 0, verticalIndex: 0, annotation: rootAnnotation })
    mockSocket._trigger('annotation:add', { slideIndex: 0, verticalIndex: 1, annotation: childAnnotation })

    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onAdd).toHaveBeenCalledWith(childAnnotation, 0, 1)
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
    expect(onRemove).toHaveBeenCalledWith('a1', 0)
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

  it('clears the active annotation bucket for a global clear event', () => {
    const onClear = vi.fn()
    renderHook(() =>
      useAnnotationSync({
        socket: mockSocket,
        slideIndex: 2,
        verticalIndex: 1,
        includeVerticalIndex: true,
        onAnnotationAdd: vi.fn(),
        onAnnotationRemove: vi.fn(),
        onAnnotationsClear: onClear,
      })
    )

    mockSocket._trigger('annotation:cleared', { global: true })

    expect(onClear).toHaveBeenCalledWith(2, 1)
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
    expect(onAdd).toHaveBeenNthCalledWith(1, { id: 'a1', d: 'M0 0', color: '#FF0000' }, 0)
    expect(onAdd).toHaveBeenNthCalledWith(2, { id: 'a2', d: 'M1 1 L2 2', color: '#00FF00' }, 0)
  })

  it('replaces an optimistic stroke when a rejoin snapshot is empty', () => {
    const onAdd = vi.fn()
    const onClear = vi.fn()
    const { result } = renderHook(() =>
      useAnnotationSync({
        socket: mockSocket,
        slideIndex: 0,
        onAnnotationAdd: onAdd,
        onAnnotationRemove: vi.fn(),
        onAnnotationsClear: onClear,
      })
    )

    // Register a local optimistic stroke before the server echo/snapshot.
    result.current.registerAnnotationId('optimistic')
    mockSocket._trigger('annotations:sync', { slideAnnotations: { '0': [] } })

    expect(onClear).toHaveBeenCalledWith(0)
  })

  it('replaces stale local strokes when a rejoin snapshot differs', () => {
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

    mockSocket._trigger('annotation:add', {
      slideIndex: 0,
      annotation: { id: 'stale', d: 'M0 0' },
    })
    mockSocket._trigger('annotations:sync', {
      slideAnnotations: {
        '0': [{ id: 'current', d: 'M1 1' }],
      },
    })

    expect(onClear).toHaveBeenCalledWith(0)
    expect(onAdd).toHaveBeenLastCalledWith({ id: 'current', d: 'M1 1' }, 0)
  })

  it('replaces strokes from a slide-scoped annotations:sync on navigate (I-R4.1)', () => {
    const onAdd = vi.fn()
    const onClear = vi.fn()
    renderHook(() =>
      useAnnotationSync({
        socket: mockSocket,
        slideIndex: 1,
        onAnnotationAdd: onAdd,
        onAnnotationRemove: vi.fn(),
        onAnnotationsClear: onClear,
      })
    )

    // Scoped sync for the slide we navigated to → clears, then adds slide-1 strokes
    mockSocket._trigger('annotations:sync', {
      slideIndex: 1,
      annotations: [{ id: 'b1', d: 'M1 1', color: '#00FF00' }],
    })

    expect(onClear).toHaveBeenCalledTimes(1)
    expect(onClear).toHaveBeenCalledWith(1)
    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onAdd).toHaveBeenCalledWith({ id: 'b1', d: 'M1 1', color: '#00FF00' }, 1)
  })

  it('ignores a slide-scoped annotations:sync for a different slide', () => {
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

    mockSocket._trigger('annotations:sync', {
      slideIndex: 2,
      annotations: [{ id: 'c1', d: 'M2 2' }],
    })

    expect(onClear).not.toHaveBeenCalled()
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('uses the synchronously current slide when navigate and sync arrive back-to-back', () => {
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

    mockSocket._trigger('navigate', { slideIndex: 1 })
    mockSocket._trigger('annotations:sync', {
      slideIndex: 1,
      annotations: [{ id: 'target-slide', d: 'M1 1' }],
    })

    expect(onClear).toHaveBeenCalledTimes(1)
    expect(onClear).toHaveBeenCalledWith(1)
    expect(onAdd).toHaveBeenCalledWith({ id: 'target-slide', d: 'M1 1' }, 1)
  })

  it('passes an explicit root vertical index across a child-to-root navigation race', () => {
    const onAdd = vi.fn()
    renderHook(() =>
      useAnnotationSync({
        socket: mockSocket,
        slideIndex: 0,
        verticalIndex: 1,
        includeVerticalIndex: true,
        onAnnotationAdd: onAdd,
        onAnnotationRemove: vi.fn(),
        onAnnotationsClear: vi.fn(),
      })
    )

    mockSocket._trigger('navigate', { slideIndex: 0, verticalIndex: 0 })
    mockSocket._trigger('annotations:sync', {
      slideIndex: 0,
      verticalIndex: 0,
      annotations: [{ id: 'root-after-child', d: 'M0 0' }],
    })

    expect(onAdd).toHaveBeenCalledWith({ id: 'root-after-child', d: 'M0 0' }, 0, 0)
  })

  it('does not display a scoped sync for a slide that is no longer current', () => {
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

    mockSocket._trigger('sync-state', { slideIndex: 2 })
    mockSocket._trigger('annotations:sync', {
      slideIndex: 1,
      annotations: [{ id: 'stale-slide', d: 'M1 1' }],
    })

    expect(onClear).not.toHaveBeenCalled()
    expect(onAdd).not.toHaveBeenCalled()
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
    expect(onAdd).toHaveBeenCalledWith(annotation, 0)
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
    expect(mockSocket.off).toHaveBeenCalledTimes(6)
  })
})

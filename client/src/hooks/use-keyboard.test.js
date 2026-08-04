import { describe, expect, it, vi } from 'vitest'
import { render, renderHook } from '@testing-library/react'
import { createElement, useLayoutEffect } from 'react'
import { createKeyboardHandler, useKeyboard } from './use-keyboard'
import { getShortcuts } from '../utils/default-keyboard-shortcut-definitions-registry'

function createEvent(key, extra = {}) {
  return {
    key,
    preventDefault: vi.fn(),
    ...extra,
  }
}

function KeyboardHarness({ disabled, onSave }) {
  useKeyboard({ disabled, onSave })
  useLayoutEffect(() => {
    if (!disabled) return
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true })
    )
  }, [disabled])
  return null
}

describe('createKeyboardHandler', () => {
  it('ignores events that another keyboard owner already handled', () => {
    const shortcuts = getShortcuts({})
    const onPaste = vi.fn()
    const event = createEvent('v', { ctrlKey: true, defaultPrevented: true })

    createKeyboardHandler({
      shortcuts,
      onPaste,
      getActiveElement: () => null,
    })(event)

    expect(onPaste).not.toHaveBeenCalled()
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('[cap:shortcut.copy][cap:shortcut.cut][cap:shortcut.paste][cap:shortcut.duplicate][cap:shortcut.undo][cap:shortcut.redo][cap:shortcut.delete][cap:shortcut.selectAll][cap:shortcut.toggleFindReplace][cap:shortcut.escape] maps editor shortcuts to callbacks and prevents browser defaults', () => {
    const callbacks = {
      onCopy: vi.fn(),
      onCut: vi.fn(),
      onPaste: vi.fn(),
      onDuplicate: vi.fn(),
      onUndo: vi.fn(),
      onRedo: vi.fn(),
      onDelete: vi.fn(),
      onSelectAll: vi.fn(),
      onToggleFindReplace: vi.fn(),
      onEscape: vi.fn(),
      getActiveElement: () => null,
    }
    const shortcuts = getShortcuts({})
    const handler = createKeyboardHandler({ ...callbacks, shortcuts })

    const copy = createEvent('c', { ctrlKey: true })
    const cut = createEvent('x', { ctrlKey: true })
    const paste = createEvent('v', { ctrlKey: true })
    const duplicate = createEvent('d', { ctrlKey: true })
    const undo = createEvent('z', { ctrlKey: true })
    const redo = createEvent('y', { ctrlKey: true })
    const deleteKey = createEvent('Delete')
    const selectAll = createEvent('a', { ctrlKey: true })
    const find = createEvent('f', { ctrlKey: true })
    const escape = createEvent('Escape')

    ;[copy, cut, paste, duplicate, undo, redo, deleteKey, selectAll, find, escape].forEach(handler)

    expect(callbacks.onCopy).toHaveBeenCalledTimes(1)
    expect(callbacks.onCut).toHaveBeenCalledTimes(1)
    expect(callbacks.onPaste).toHaveBeenCalledTimes(1)
    expect(callbacks.onDuplicate).toHaveBeenCalledTimes(1)
    expect(callbacks.onUndo).toHaveBeenCalledTimes(1)
    expect(callbacks.onRedo).toHaveBeenCalledTimes(1)
    expect(callbacks.onDelete).toHaveBeenCalledTimes(1)
    expect(callbacks.onSelectAll).toHaveBeenCalledTimes(1)
    expect(callbacks.onToggleFindReplace).toHaveBeenCalledTimes(1)
    expect(callbacks.onEscape).toHaveBeenCalledTimes(1)
    expect(copy.preventDefault).toHaveBeenCalledTimes(1)
    expect(redo.preventDefault).toHaveBeenCalledTimes(1)
  })

  it('ignores shortcuts while editing or when form controls are focused', () => {
    const shortcuts = getShortcuts({})
    const onCopy = vi.fn()
    createKeyboardHandler({
      onCopy,
      shortcuts,
      isEditing: true,
      getActiveElement: () => null,
    })(createEvent('c', { ctrlKey: true }))
    expect(onCopy).not.toHaveBeenCalled()

    createKeyboardHandler({
      onCopy,
      shortcuts,
      getActiveElement: () => ({ tagName: 'TEXTAREA' }),
    })(createEvent('c', { ctrlKey: true }))
    expect(onCopy).not.toHaveBeenCalled()
  })

  it('stands down while the editor route is loading', () => {
    const shortcuts = getShortcuts({})
    const onSave = vi.fn()
    const event = createEvent('s', { ctrlKey: true })

    createKeyboardHandler({
      disabled: true,
      onSave,
      shortcuts,
      getActiveElement: () => null,
    })(event)

    expect(onSave).not.toHaveBeenCalled()
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
  })

  it('[cap:shortcut.save] saves from editable controls and prevents the browser Save Page action', () => {
    const shortcuts = getShortcuts({})
    const onSave = vi.fn()
    const event = createEvent('s', { ctrlKey: true })

    createKeyboardHandler({
      onSave,
      shortcuts,
      isEditing: true,
      getActiveElement: () => ({ tagName: 'INPUT' }),
    })(event)

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
  })

  it('[cap:shortcut.zoomIn] [cap:shortcut.zoomOut] [cap:shortcut.resetZoom] routes zoom chords to their callbacks and prevents browser defaults', () => {
    const shortcuts = getShortcuts({})
    const callbacks = {
      onZoomIn: vi.fn(),
      onZoomOut: vi.fn(),
      onResetZoom: vi.fn(),
      getActiveElement: () => null,
    }
    const handler = createKeyboardHandler({ ...callbacks, shortcuts })
    const zoomIn = createEvent('=', { ctrlKey: true })
    const zoomOut = createEvent('-', { ctrlKey: true })
    const resetZoom = createEvent('0', { ctrlKey: true })

    handler(zoomIn)
    handler(zoomOut)
    handler(resetZoom)

    expect(callbacks.onZoomIn).toHaveBeenCalledTimes(1)
    expect(callbacks.onZoomOut).toHaveBeenCalledTimes(1)
    expect(callbacks.onResetZoom).toHaveBeenCalledTimes(1)
    expect(zoomIn.preventDefault).toHaveBeenCalledTimes(1)
    expect(zoomOut.preventDefault).toHaveBeenCalledTimes(1)
    expect(resetZoom.preventDefault).toHaveBeenCalledTimes(1)
  })

  it('honors a customized Save shortcut from the registry in editable controls', () => {
    const shortcuts = getShortcuts({}).map((shortcut) =>
      shortcut.id === 'save' ? { ...shortcut, activeKey: 'Ctrl+Shift+S' } : shortcut
    )
    const onSave = vi.fn()
    const handler = createKeyboardHandler({
      onSave,
      shortcuts,
      isEditing: true,
      getActiveElement: () => ({ tagName: 'INPUT' }),
    })
    const defaultSave = createEvent('s', { ctrlKey: true })
    const overriddenSave = createEvent('s', { ctrlKey: true, shiftKey: true })

    handler(defaultSave)
    handler(overriddenSave)

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(defaultSave.preventDefault).not.toHaveBeenCalled()
    expect(overriddenSave.preventDefault).toHaveBeenCalledTimes(1)
  })

  it('stands down when the caret is inside a contenteditable region even if the editing flag is unset', () => {
    const shortcuts = getShortcuts({})
    const onCopy = vi.fn()
    const onDelete = vi.fn()

    // A TipTap root / table cell reports tagName DIV but isContentEditable true,
    // and the editing flag may not have propagated yet. Canvas shortcuts must
    // not steal the keystroke and clobber the text element.
    const handler = createKeyboardHandler({
      onCopy,
      onDelete,
      shortcuts,
      isEditing: false,
      getActiveElement: () => ({ tagName: 'DIV', isContentEditable: true }),
    })
    handler(createEvent('c', { ctrlKey: true }))
    handler(createEvent('Delete'))

    expect(onCopy).not.toHaveBeenCalled()
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('leaves removed ribbon toggle shortcut unhandled', () => {
    const shortcuts = getShortcuts({})
    const onToggleRibbon = vi.fn()
    const event = createEvent('r', { ctrlKey: true, altKey: true })

    createKeyboardHandler({
      shortcuts,
      onToggleRibbon,
      getActiveElement: () => null,
    })(event)

    expect(onToggleRibbon).not.toHaveBeenCalled()
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('[cap:shortcut.commandPalette][cap:command.commandPalette] invokes onCommandPalette when Ctrl+K is pressed in editor scope (I-003)', () => {
    const shortcuts = getShortcuts({})
    const onCommandPalette = vi.fn()
    const event = createEvent('k', { ctrlKey: true })

    createKeyboardHandler({
      shortcuts,
      onCommandPalette,
      getActiveElement: () => null,
    })(event)

    expect(onCommandPalette).toHaveBeenCalledTimes(1)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
  })

  it('[cap:shortcut.insertSlide] invokes onInsertSlide when Ctrl+M is pressed in editor scope', () => {
    const shortcuts = getShortcuts({})
    const onInsertSlide = vi.fn()
    const event = createEvent('m', { ctrlKey: true })

    createKeyboardHandler({
      shortcuts,
      onInsertSlide,
      getActiveElement: () => null,
    })(event)

    expect(onInsertSlide).toHaveBeenCalledTimes(1)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
  })
})

describe('useKeyboard hook integration', () => {
  it('publishes disabled state before an immediate route-loading shortcut', () => {
    const onSave = vi.fn()
    const { rerender } = render(createElement(KeyboardHarness, { disabled: false, onSave }))

    rerender(createElement(KeyboardHarness, { disabled: true, onSave }))

    expect(onSave).not.toHaveBeenCalled()
  })

  it('forwards onCommandPalette through hook → handler (regression I-003)', () => {
    // Pre-fix bug: useKeyboard did not destructure or forward onCommandPalette,
    // so Ctrl+K matched the editor-scoped shortcut but the callback was never
    // invoked. This integration test would FAIL against the pre-fix hook.
    const onCommandPalette = vi.fn()
    renderHook(() => useKeyboard({ onCommandPalette }))

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    document.dispatchEvent(event)

    expect(onCommandPalette).toHaveBeenCalledTimes(1)
  })
})

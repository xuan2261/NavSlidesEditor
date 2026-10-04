import { describe, expect, it, vi } from 'vitest'
import { createKeyboardHandler } from './use-keyboard'
import { getShortcuts } from '../utils/default-keyboard-shortcut-definitions-registry'

const event = (key, extra = {}) => ({ key, ctrlKey: true, preventDefault: vi.fn(), ...extra })
const prose = () => {
  const node = document.createElement('div')
  node.className = 'ProseMirror'
  node.setAttribute('contenteditable', 'true')
  return node
}

describe('command palette during rich-text editing', () => {
  it('honors remapping and opens once without hijacking other text chords', () => {
    const active = prose(),
      onCommandPalette = vi.fn(),
      onCopy = vi.fn()
    const handler = createKeyboardHandler({
      shortcuts: getShortcuts({ commandPalette: 'Ctrl+Shift+K' }),
      isEditing: true,
      getActiveElement: () => active,
      onCommandPalette,
      onCopy,
    })
    const old = event('k'),
      first = event('K', { shiftKey: true }),
      repeat = event('K', { shiftKey: true, repeat: true }),
      copy = event('c')
    ;[old, first, repeat, copy].forEach(handler)
    expect(onCommandPalette).toHaveBeenCalledTimes(1)
    expect(first.preventDefault).toHaveBeenCalledOnce()
    expect(repeat.preventDefault).toHaveBeenCalledOnce()
    expect(old.preventDefault).not.toHaveBeenCalled()
    expect(copy.preventDefault).not.toHaveBeenCalled()
    expect(onCopy).not.toHaveBeenCalled()
  })

  it.each(['disabled', 'defaultPrevented', 'form', 'dialog', 'presenting'])(
    'retains %s keyboard ownership',
    (mode) => {
      const active = mode === 'form' ? document.createElement('input') : prose()
      if (mode === 'dialog') {
        const dialog = document.createElement('div')
        dialog.setAttribute('role', 'dialog')
        dialog.append(active)
      }
      const onCommandPalette = vi.fn()
      const key = event('k', { defaultPrevented: mode === 'defaultPrevented' })
      createKeyboardHandler({
        shortcuts: getShortcuts({}),
        isEditing: true,
        disabled: mode === 'disabled',
        isPresenting: mode === 'presenting',
        getActiveElement: () => active,
        onCommandPalette,
      })(key)
      expect(onCommandPalette).not.toHaveBeenCalled()
      expect(key.preventDefault).not.toHaveBeenCalled()
    }
  )
})

import { describe, expect, it } from 'vitest'
import { isInteractiveKeyboardTarget } from './interactive-keyboard-target'

function appendTarget(target) {
  document.body.appendChild(target)
  return target
}

describe('isInteractiveKeyboardTarget', () => {
  it.each(['input', 'textarea', 'select', 'button', 'audio', 'video', 'summary'])(
    'treats <%s> as keyboard-owned',
    (tag) => {
      const target = appendTarget(document.createElement(tag))
      expect(isInteractiveKeyboardTarget(target)).toBe(true)
      target.remove()
    }
  )

  it('treats contenteditable, linked, ARIA-interactive, popover, and nested targets as keyboard-owned', () => {
    const owners = [
      Object.assign(document.createElement('div'), { contentEditable: 'true' }),
      Object.assign(document.createElement('a'), { href: '/docs' }),
      Object.assign(document.createElement('div'), { innerHTML: '<span>child</span>' }),
      document.createElement('div'),
    ]
    owners[2].setAttribute('role', 'dialog')
    owners[3].setAttribute('popover', 'manual')

    for (const owner of owners) {
      appendTarget(owner)
      expect(isInteractiveKeyboardTarget(owner.querySelector('span') || owner)).toBe(true)
      owner.remove()
    }
  })

  it('leaves plain canvas surfaces available to editor shortcuts', () => {
    const target = appendTarget(document.createElement('div'))
    expect(isInteractiveKeyboardTarget(target)).toBe(false)
    target.remove()
  })
})

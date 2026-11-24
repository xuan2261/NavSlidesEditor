// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRuntimeSession } from '../../../../shared/src/education/runtime-session.js'
import { createOrderingControls } from '../../../../shared/src/education/browser/assignment-controls.js'

const sessions = []
afterEach(() => {
  sessions.splice(0).forEach((session) => session.destroy())
  document.body.replaceChildren()
})
const setup = () => {
  const session = createRuntimeSession(
    () => ({}),
    (state) => state
  )
  sessions.push(session)
  const onChange = vi.fn()
  const controls = createOrderingControls({
    document,
    items: [
      { id: 'a', label: 'Same' },
      { id: 'b', label: 'Same' },
    ],
    session,
    onChange,
  })
  document.body.append(controls.element)
  return { controls, session, onChange }
}

describe('ordering canonical answer hydration', () => {
  it('restores a complete stable-ID permutation without dispatching a learner action or replacing focused controls', () => {
    const { controls, onChange } = setup()
    const handle = controls.element.querySelector('[data-ns-source="a"]')
    handle.focus()
    controls.setAnswer({ itemIds: ['b', 'a'] })
    expect(controls.getAnswer()).toEqual({ itemIds: ['b', 'a'] })
    expect(
      [...controls.element.querySelectorAll('[data-ns-order-item]')].map((row) =>
        row.getAttribute('data-ns-order-item')
      )
    ).toEqual(['b', 'a'])
    expect(document.activeElement).toBe(handle)
    expect(onChange).not.toHaveBeenCalled()
  })
  it.each([
    { itemIds: ['a'] },
    { itemIds: ['a', 'a'] },
    { itemIds: ['a', 'missing'] },
    { itemIds: ['b', 'a'], other: true },
  ])('rejects invalid canonical permutation %j without changing the prior answer', (answer) => {
    const { controls } = setup()
    expect(() => controls.setAnswer(answer)).toThrow()
    expect(controls.getAnswer()).toEqual({ itemIds: ['a', 'b'] })
  })
  it('does not hydrate a destroyed old-generation control after reset', () => {
    const { controls, session } = setup()
    session.reset()
    controls.setAnswer({ itemIds: ['b', 'a'] })
    expect(controls.getAnswer()).toEqual({ itemIds: ['a', 'b'] })
  })
})

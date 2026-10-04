// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createAssignmentControls,
  createOrderingControls,
} from '../../../../shared/src/education/browser/assignment-controls.js'
import { createRuntimeSession } from '../../../../shared/src/education/runtime-session.js'
import { createSortingConfig } from '../../../../shared/src/education/sorting-config.js'
import {
  createSortingState,
  reduceSorting,
} from '../../../../shared/src/education/games/sorting.js'
import { presentSorting } from '../../../../shared/src/education/browser/sorting-presenter.js'

const sessions = []
const sources = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
]
const targets = [
  { id: 'x', label: 'Left' },
  { id: 'y', label: 'Right' },
]
const setup = (bijection = true) => {
  const session = createRuntimeSession(
    () => ({}),
    (state) => state
  )
  sessions.push(session)
  const onChange = vi.fn()
  const controls = createAssignmentControls({
    document,
    sources,
    targets,
    session,
    bijection,
    onChange,
  })
  document.body.append(controls.element)
  const source = (id) => controls.element.querySelector(`[data-ns-source="${id}"]`)
  const target = (id) => controls.element.querySelector(`[data-ns-target="${id}"]`)
  source('a').setPointerCapture = vi.fn()
  source('a').releasePointerCapture = vi.fn()
  target('x').getBoundingClientRect = () => ({
    left: 100,
    right: 180,
    top: 20,
    bottom: 100,
    width: 80,
    height: 80,
  })
  target('y').getBoundingClientRect = () => ({
    left: 200,
    right: 280,
    top: 20,
    bottom: 100,
    width: 80,
    height: 80,
  })
  return { controls, session, onChange, source, target }
}
const pointer = (element, type, x, y, extra = {}) => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, {
    pointerId: 7,
    pointerType: 'touch',
    button: 0,
    clientX: x,
    clientY: y,
    ...extra,
  })
  element.dispatchEvent(event)
}
const drag = (fixture, x = 130, y = 50) => {
  pointer(fixture.source('a'), 'pointerdown', 10, 10)
  pointer(fixture.source('a'), 'pointermove', x, y)
  pointer(fixture.source('a'), 'pointerup', x, y)
}
afterEach(() => {
  sessions.splice(0).forEach((session) => session.destroy())
  document.body.replaceChildren()
})

describe('native assignment paths', () => {
  it('completes matching by native button activation and rejects occupied targets without losing focus', () => {
    const f = setup()
    f.source('a').click()
    f.target('x').click()
    f.source('b').click()
    f.target('x').focus()
    f.target('x').click()
    expect(f.controls.getAnswer()).toEqual([{ sourceId: 'a', targetId: 'x' }])
    expect(f.controls.element.querySelector('[role="status"]').textContent).toMatch(/occupied/i)
    expect(document.activeElement).toBe(f.target('x'))
    f.target('y').click()
    expect(f.controls.getAnswer()).toEqual([
      { sourceId: 'a', targetId: 'x' },
      { sourceId: 'b', targetId: 'y' },
    ])
  })
  it('allows many sources in a sorting bucket and uses Escape to cancel selection and return source focus', () => {
    const f = setup(false)
    f.source('a').click()
    f.target('x').click()
    f.source('b').click()
    f.target('x').click()
    expect(f.controls.getAnswer()).toEqual([
      { sourceId: 'a', targetId: 'x' },
      { sourceId: 'b', targetId: 'x' },
    ])
    f.source('b').click()
    f.target('y').focus()
    f.target('y').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(f.controls.getState().selectedId).toBeNull()
    expect(document.activeElement).toBe(f.source('b'))
  })
  it('moves focus with arrows but leaves Tab and navigation outside the game untouched', () => {
    const f = setup()
    f.source('a').focus()
    f.source('a').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
    )
    expect(document.activeElement).toBe(f.source('b'))
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    f.source('b').dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(false)
    expect(f.controls.element.style.touchAction).not.toBe('none')
    expect(f.source('a').style.touchAction).toBe('none')
  })
})

describe('pointer assignment lifecycle', () => {
  it('hit-tests bounds while capture reports the source as pointerup target and commits exactly once', () => {
    const f = setup()
    drag(f)
    expect(f.controls.getAnswer()).toEqual([{ sourceId: 'a', targetId: 'x' }])
    expect(f.onChange.mock.calls.filter(([, command]) => command.type === 'assign')).toHaveLength(1)
    const click = new MouseEvent('click', { bubbles: true, detail: 1, cancelable: true })
    Object.defineProperty(click, 'pointerId', { value: 7 })
    f.source('a').dispatchEvent(click)
    expect(f.controls.getState().selectedId).toBeNull()
    f.source('b').click()
    expect(f.controls.getState().selectedId).toBe('b')
    expect(document.querySelector('[data-ns-drag-ghost]')).toBeNull()
  })
  it.each([
    'pointercancel',
    'lostpointercapture',
    'escape',
    'leave',
    'reset',
    'destroy',
    'outside',
  ])('cancels %s without committing a stale drop', (reason) => {
    const f = setup()
    pointer(f.source('a'), 'pointerdown', 10, 10)
    pointer(f.source('a'), 'pointermove', 130, 50)
    if (reason === 'escape')
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    else if (reason === 'leave') f.controls.cancel()
    else if (reason === 'reset') f.session.reset()
    else if (reason === 'destroy') f.controls.destroy()
    else if (reason !== 'outside') pointer(f.source('a'), reason, 130, 50)
    pointer(f.source('a'), 'pointerup', reason === 'outside' ? 500 : 130, 50)
    expect(f.controls.getAnswer()).toEqual([])
    expect(f.onChange.mock.calls.filter(([, command]) => command.type === 'assign')).toEqual([])
    expect(document.querySelector('[data-ns-drag-ghost]')).toBeNull()
  })
})

describe('ordering native adapter', () => {
  it('reorders stable IDs through Move up/down without submitting or grading', () => {
    const session = createRuntimeSession(
      () => ({}),
      (state) => state
    )
    sessions.push(session)
    const controls = createOrderingControls({ document, items: sources, session })
    document.body.append(controls.element)
    controls.element.querySelector('[aria-label="Move Beta up"]').click()
    expect(controls.getAnswer()).toEqual({ itemIds: ['b', 'a'] })
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Move Beta up')
    expect(controls.element.querySelector('form')).toBeNull()
  })
})

describe('sorting form terminal feedback', () => {
  it('reports incomplete submission, allows correction, awards once, and resets the session', () => {
    const config = createSortingConfig({ attemptLimit: 2, points: 7 })
    const root = document.createElement('div')
    root.innerHTML = '<div data-ns-game-ui></div>'
    document.body.append(root)
    let presenter
    const session = createRuntimeSession(
      () => createSortingState(config),
      (state, command) => reduceSorting(config, state, command),
      { onState: (state) => presenter?.render(state) }
    )
    sessions.push(session)
    const mount = () => {
      presenter = presentSorting({
        root,
        config,
        session,
        reset: () => {
          session.reset()
          mount()
        },
      })
    }
    mount()
    const submit = () =>
      root
        .querySelector('form')
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    submit()
    expect(root.textContent).toContain('Assign every item before submitting.')
    expect(session.getState().attempts).toBe(0)
    for (const row of config.answerKey.assignments) {
      root.querySelector(`[data-ns-source="${row.itemId}"]`).click()
      root.querySelector(`[data-ns-target="${row.bucketId}"]`).click()
    }
    submit()
    submit()
    expect(session.getState()).toMatchObject({ score: 7, attempts: 1, phase: 'complete' })
    expect(root.textContent).toContain('Correct! All items are sorted.')
    root.querySelector('[data-ns-command="sorting-reset"]').click()
    expect(session.getState()).toMatchObject({ score: 0, attempts: 0, generation: 1 })
    expect(root.querySelector('[data-ns-source]').getAttribute('aria-pressed')).toBe('false')
  })
})

describe('ordering pointer authority', () => {
  it('places by target bounds, retains alt text, and cancels a drag when its fieldset becomes disabled', () => {
    const session = createRuntimeSession(
      () => ({}),
      (state) => state
    )
    sessions.push(session)
    const controls = createOrderingControls({
      document,
      items: [{ ...sources[0], media: { src: '/uploads/item.png', alt: 'A diagram' } }, sources[1]],
      session,
    })
    const fieldset = document.createElement('fieldset')
    fieldset.append(controls.element)
    document.body.append(fieldset)
    const handle = controls.element.querySelector('[data-ns-source="a"]')
    handle.setPointerCapture = vi.fn()
    controls.element.querySelector('[data-ns-order-item="b"]').getBoundingClientRect = () => ({
      left: 100,
      right: 180,
      top: 20,
      bottom: 100,
      width: 80,
      height: 80,
    })
    expect(handle.querySelector('img').alt).toBe('A diagram')
    pointer(handle, 'pointerdown', 10, 10)
    pointer(handle, 'pointermove', 130, 50)
    pointer(handle, 'pointerup', 130, 50)
    expect(controls.getAnswer()).toEqual({ itemIds: ['b', 'a'] })
    pointer(handle, 'pointerdown', 10, 10)
    pointer(handle, 'pointermove', 130, 50)
    fieldset.disabled = true
    pointer(handle, 'pointerup', 130, 50)
    expect(controls.getAnswer()).toEqual({ itemIds: ['b', 'a'] })
    expect(document.querySelector('[data-ns-drag-ghost]')).toBeNull()
  })
})

describe('generation replacement and safe assignment content', () => {
  it('keeps the replacement controls untouched by pointerup and click from a reset gesture', () => {
    const f = setup()
    pointer(f.source('a'), 'pointerdown', 10, 10)
    pointer(f.source('a'), 'pointermove', 130, 50)
    f.session.reset()
    const replacement = createAssignmentControls({ document, sources, targets, session: f.session })
    f.controls.element.replaceWith(replacement.element)
    pointer(f.source('a'), 'pointerup', 130, 50)
    f.source('a').click()
    expect(replacement.getAnswer()).toEqual([])
    expect(replacement.getState().selectedId).toBeNull()
    expect(document.querySelector('[data-ns-drag-ghost]')).toBeNull()
  })
  it('uses canonical safe image validation and never treats author text as HTML', () => {
    const session = createRuntimeSession(
      () => ({}),
      (state) => state
    )
    sessions.push(session)
    expect(() =>
      createAssignmentControls({
        document,
        sources: [
          { id: 'a', label: 'Image', media: { src: 'javascript:alert(1)', alt: 'Unsafe' } },
        ],
        targets,
        session,
      })
    ).toThrow()
    const controls = createOrderingControls({
      document,
      items: [
        { id: 'a', label: '<img onerror=alert(1)>', media: { src: '/uploads/item.png', alt: '' } },
      ],
      session,
    })
    document.body.append(controls.element)
    expect(controls.element.querySelector('[data-ns-source]').textContent).toBe(
      '<img onerror=alert(1)>'
    )
    expect(controls.element.querySelectorAll('img')).toHaveLength(1)
    expect(controls.element.querySelector('img').alt).toBe('')
  })
})

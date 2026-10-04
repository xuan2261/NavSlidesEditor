// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createCanonicalQuestion } from '../../src/education/question-schema.js'
import { createQuizSession, reduceQuizSession } from '../../src/education/quiz-session.js'
import { presentQuiz } from '../../src/education/browser/quiz-presenter.js'
import { createQuizHotspotControls } from '../../src/education/browser/quiz-hotspot-controls.js'

function mount(question, config = {}) {
  const root = document.createElement('div')
  root.innerHTML = '<div data-ns-game-ui></div>'
  document.body.append(root)
  let now = 0,
    presenter
  const cleanups = [],
    scheduled = []
  let state = createQuizSession({ questions: [question], ...config })
  const clock = { now: () => now }
  const session = {
    getState: () => state,
    own: (fn) => cleanups.push(fn),
    schedule: (fn, delay) => {
      const task = { fn, delay }
      scheduled.push(task)
      return () => scheduled.splice(scheduled.indexOf(task), 1)
    },
    dispatch: (command) => {
      state = reduceQuizSession(state, { generation: state.generation, now, ...command })
      presenter.render(state)
      return state
    },
  }
  presenter = presentQuiz({
    root,
    config: state.config,
    session,
    clock,
    reset: () => session.dispatch({ type: 'reset' }),
  })
  presenter.render(state)
  return {
    root,
    session,
    scheduled,
    tick: (time) => {
      now = time
      const tasks = scheduled.splice(0)
      tasks.forEach((task) => task.fn())
    },
    close: () => {
      cleanups.reverse().forEach((fn) => fn())
      root.remove()
    },
  }
}
const submit = (root) =>
  root.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

describe('quiz presenter controls', () => {
  it.each(['single-choice', 'multi-choice', 'image-hotspot'])(
    'submits a correct %s answer using native input controls',
    (kind) => {
      const mounted = mount(createCanonicalQuestion({ id: 'q', kind }))
      if (kind === 'image-hotspot') {
        const select = mounted.root.querySelector('select')
        select.value = 'q/option-1'
        select.dispatchEvent(new Event('change'))
      } else mounted.root.querySelector('input').click()
      expect(mounted.session.getState().attempts).toEqual([])
      submit(mounted.root)
      expect(mounted.session.getState().score).toBe(10)
      expect(mounted.session.getState().status).toBe('terminal')
      mounted.close()
    }
  )

  it('extends time without losing a focused text draft', () => {
    const mounted = mount(createCanonicalQuestion({ id: 'q', kind: 'fill-blank', timeLimit: 5 }))
    const input = mounted.root.querySelector('input')
    input.value = 'Answer'
    mounted.root.querySelector('[data-ns-command=quiz-extend-time]').click()
    mounted.tick(6000)
    expect(mounted.session.getState().status).toBe('active')
    expect(input.value).toBe('Answer')
    submit(mounted.root)
    expect(mounted.session.getState().score).toBe(10)
    mounted.close()
  })

  it('keeps draft and focus during ticks, then grades a submitted text answer', () => {
    const mounted = mount(createCanonicalQuestion({ id: 'q', kind: 'fill-blank', timeLimit: 5 }))
    const input = mounted.root.querySelector('input[type=text]')
    input.value = 'Answer'
    input.focus()
    mounted.tick(1000)
    expect(mounted.root.querySelector('input[type=text]')).toBe(input)
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('Answer')
    submit(mounted.root)
    expect(mounted.session.getState().score).toBe(10)
    expect(mounted.root.querySelector('[role=status]').textContent).toContain('Correct')
    mounted.close()
  })

  it('selection does not submit; retry and deadline are honored', () => {
    const mounted = mount(createCanonicalQuestion({ id: 'q', kind: 'true-false', timeLimit: 5 }), {
      attemptLimit: 2,
    })
    const radios = mounted.root.querySelectorAll('input[type=radio]')
    radios[1].click()
    expect(mounted.session.getState().attempts).toEqual([])
    submit(mounted.root)
    expect(mounted.session.getState().status).toBe('active')
    expect(radios[1].hasAttribute('aria-invalid')).toBe(false)
    radios[0].click()
    submit(mounted.root)
    expect(mounted.session.getState().score).toBe(10)
    mounted.close()
    const expired = mount(createCanonicalQuestion({ id: 'q', timeLimit: 5 }))
    expired.tick(5000)
    expect(expired.session.getState().status).toBe('terminal')
    expect(expired.root.querySelector('button[type=submit]').disabled).toBe(true)
    expired.close()
  })

  it('orders items with buttons and matches using native source/target buttons', () => {
    const ordering = createCanonicalQuestion({ id: 'o', kind: 'ordering' })
    ordering.options.reverse()
    const mounted = mount(ordering)
    Array.from(mounted.root.querySelectorAll('button'))
      .find((button) => button.textContent === 'Move down')
      .click()
    submit(mounted.root)
    expect(mounted.session.getState().score).toBe(10)
    mounted.close()
    const matching = mount(createCanonicalQuestion({ id: 'm', kind: 'matching' }))
    matching.root.querySelector('[data-ns-source]').click()
    matching.root.querySelector('[data-ns-target]').click()
    submit(matching.root)
    expect(matching.session.getState().score).toBe(10)
    matching.close()
  })

  it('maps hotspot points to the contained image, rejecting letterbox clicks', () => {
    const q = createCanonicalQuestion({ id: 'h', kind: 'image-hotspot' })
    const owned = []
    const session = { getState: () => ({ generation: 0 }), own: (fn) => owned.push(fn) }
    const controls = createQuizHotspotControls({ document, question: q, session })
    document.body.append(controls.element)
    const image = controls.element.querySelector('img')
    Object.defineProperties(image, { naturalWidth: { value: 200 }, naturalHeight: { value: 100 } })
    image.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200 })
    image.dispatchEvent(new MouseEvent('pointerdown', { clientX: 100, clientY: 20, bubbles: true }))
    expect(controls.getAnswer().mode).toBe('region')
    image.dispatchEvent(
      new MouseEvent('pointerdown', { clientX: 100, clientY: 100, bubbles: true })
    )
    expect(controls.getAnswer()).toEqual({ mode: 'point', x: 0.5, y: 0.5 })
    const select = controls.element.querySelector('select')
    select.value = 'h/option-1'
    select.dispatchEvent(new Event('change'))
    expect(controls.getAnswer()).toEqual({ mode: 'region', regionId: 'h/option-1' })
    owned.forEach((fn) => fn())
    controls.element.remove()
  })
})

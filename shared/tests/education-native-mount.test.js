import { afterEach, describe, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'
import { mount } from '../src/education/browser/mount.js'
import { serializeEducationConfig } from '../src/education/config-serialization.js'
import { createDefaultGameConfig } from '../src/education/game-defaults.js'
import { projectPublicGameConfig } from '../src/education/game-public-projection.js'

const documents = []
function fixture({ type = 'name-picker', mode = 'wheel', view = 'local', config: supplied } = {}) {
  const config = supplied || {
    ...createDefaultGameConfig(type),
    pickerMode: mode,
    animationDuration: 0,
    items: [
      { id: 'a', label: 'An', weight: 1 },
      { id: 'b', label: 'Bình', weight: 3 },
    ],
    weighted: true,
  }
  const encoded = serializeEducationConfig(
    view === 'audience' ? projectPublicGameConfig(type, config) : config
  )
  const dom = new JSDOM(
    `<section data-ns-effective-slide-id="lesson"><div data-ns-game="true" data-ns-element-id="picker" data-ns-game-type="${type}" data-ns-education-view="${view}"><script type="application/json" data-ns-game-config>${encoded}</script><div data-ns-game-ui></div></div></section>`,
    { runScripts: 'dangerously' }
  )
  documents.push(dom)
  return { root: dom.window.document.querySelector('[data-ns-game]'), window: dom.window, config }
}
afterEach(() => {
  for (const dom of documents.splice(0)) dom.window.close()
})
const click = (root, command) => root.querySelector(`[data-ns-command="${command}"]`).click()

describe('same native DOM mount used by Try and generated documents', () => {
  it.each(['wheel', 'dice', 'button'])(
    'plays and resets authored %s mode without modifying configuration',
    (mode) => {
      const { root, config } = fixture({ mode })
      const serialized = root.querySelector('[data-ns-game-config]').textContent
      const api = mount(root, { random: () => 0.3 })
      expect(mount(root)).toBe(api)
      click(root, 'pick')
      expect(api.getState()).toMatchObject({
        picks: 1,
        lastWinner: { id: 'b', label: 'Bình' },
        excludedIds: ['b'],
      })
      expect(root.querySelector('[data-ns-winner]').textContent).toContain('Bình')
      if (mode === 'dice')
        expect(api.getState().diceValues).toEqual(Array(config.diceCount).fill(2))
      click(root, 'pick')
      expect(api.getState()).toMatchObject({ phase: 'exhausted', picks: 2 })
      expect(root.querySelector('[data-ns-command="pick"]').disabled).toBe(true)
      click(root, 'reset')
      expect(api.getState()).toMatchObject({
        phase: 'ready',
        picks: 0,
        excludedIds: [],
        generation: 1,
      })
      expect(root.querySelector('[data-ns-game-config]').textContent).toBe(serialized)
      api.destroy()
      expect(root.querySelector('[data-ns-command]')).toBeNull()
    }
  )
  it('scopes reset and destroy to the actual root, not element IDs or a module singleton', () => {
    const first = fixture(),
      second = fixture()
    const a = mount(first.root, { random: () => 0.3 }),
      b = mount(second.root, { random: () => 0 })
    click(first.root, 'pick')
    click(second.root, 'pick')
    a.reset()
    a.destroy()
    expect(b.getState()).toMatchObject({ picks: 1, lastWinner: { id: 'a' }, excludedIds: ['a'] })
    expect(second.root.querySelector('[data-ns-winner]').textContent).toContain('An')
    const replay = mount(first.root, { random: () => 0 })
    click(first.root, 'pick')
    expect(replay.getState().picks).toBe(1)
    replay.destroy()
    b.destroy()
  })
  it('round-trips parser-sensitive text without creating active authored content', () => {
    const sensitive =
      'Tiếng Việt & "quote" \\ </ScRiPt><script>window.attack=1</script> </SCRIPT > </style> \u2028\u2029'
    const config = {
      ...createDefaultGameConfig('name-picker'),
      animationDuration: 0,
      items: [{ id: 'a', label: sensitive, weight: 1 }],
    }
    const { root, window } = fixture({ config })
    const api = mount(root, { random: () => 0 })
    click(root, 'pick')
    expect(api.getState().lastWinner.label).toBe(sensitive)
    expect(root.querySelector('[data-ns-winner]').textContent).toContain(sensitive)
    expect(window.attack).toBeUndefined()
    expect(root.querySelectorAll('script')).toHaveLength(1)
    api.destroy()
  })
  it('keeps audience roots read-only even when local mode is requested or live transport disconnects', () => {
    const cfg = createDefaultGameConfig('quiz')
    const { root } = fixture({ type: 'quiz', view: 'audience', config: cfg })
    let notify,
      disposed = 0
    const transport = {
      subscribe: (_tuple, listener) => {
        notify = listener
        return () => disposed++
      },
    }
    const api = mount(root, { mode: 'local', transport })
    expect(root.querySelector('button, input, select')).toBeNull()
    notify({
      connection: 'connected',
      state: { question: projectPublicGameConfig('quiz', cfg).questions[0] },
    })
    expect(root.textContent).toContain('What is the capital of France?')
    notify({ connection: 'disconnected' })
    expect(api.getState()).toMatchObject({ runtimeMode: 'live', connection: 'disconnected' })
    expect(root.querySelector('button, input, select')).toBeNull()
    expect(root.textContent).not.toContain('answerKey')
    api.destroy()
    expect(disposed).toBe(1)
  })
  it('keeps name-picker broadcast audiences read-only instead of enabling a local classroom picker', () => {
    const { root } = fixture({ view: 'audience', config: createDefaultGameConfig('name-picker') })
    let notify
    const transport = {
      subscribe: (_tuple, listener) => {
        notify = listener
        return () => {}
      },
    }
    const api = mount(root, { mode: 'local', transport })
    try {
      expect(root.querySelectorAll('button, input, select').length).toBe(0)
      expect(api.getState()).toMatchObject({ runtimeMode: 'live', connection: 'waiting' })
      notify({ connection: 'disconnected' })
      expect(api.getState()).toMatchObject({ runtimeMode: 'live', connection: 'disconnected' })
      expect(root.querySelectorAll('button, input, select').length).toBe(0)
    } finally {
      api.destroy()
    }
  })
})

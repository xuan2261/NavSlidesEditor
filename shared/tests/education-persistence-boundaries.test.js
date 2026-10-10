import { describe, expect, it } from 'vitest'
import { createDefaultGameConfig } from '../src/education/game-defaults.js'
import { validateGameConfig } from '../src/education/game-schema.js'
import { normalizeGameElement } from '../src/education/normalize-game-config.js'
import { normalizePresentationGames } from '../src/education/presentation-game-normalization.js'
import { fixedId, resolveEffectiveElements } from '../src/slide-layouts.js'

const game = (type = 'hot-potato') => ({
  id: 'master-game',
  type: 'game',
  gameType: type,
  rotation: 30,
  x: 20,
  y: 40,
  width: 500,
  height: 300,
  [type]: createDefaultGameConfig(type),
})
const deck = (patch, { child = false, key = 'master-game', type = 'hot-potato' } = {}) => {
  const slide = {
    id: 'slide',
    layoutId: 'lesson',
    elements: [],
    ...(patch ? { layoutOverrides: { elementPatches: { [key]: patch } } } : {}),
  }
  return {
    layoutMasters: [
      { id: 'lesson', name: 'Lesson', placeholders: [], fixedElements: [game(type)] },
    ],
    slides: child ? [{ id: 'parent', elements: [], children: [slide] }] : [slide],
  }
}
const leaf = (value, child = false) => (child ? value.slides[0].children[0] : value.slides[0])
const patchAt = (value, key = 'master-game', child = false) =>
  leaf(value, child).layoutOverrides.elementPatches[key]

describe('education persistence boundaries', () => {
  it.each(['name-picker', 'poll'])(
    'round-trips %s canvas rotation without retaining nested picker runtime rotation',
    (type) => {
      const element = {
        ...game(type),
        'name-picker': { ...createDefaultGameConfig('name-picker'), rotation: 720, spinning: true },
      }
      const saved = normalizePresentationGames({ slides: [{ elements: [element] }] })
      const restored = normalizePresentationGames(JSON.parse(JSON.stringify(saved))).slides[0]
        .elements[0]
      expect(restored.rotation).toBe(30)
      expect(restored['name-picker'].rotation).toBeUndefined()
      expect(restored['name-picker'].spinning).toBeUndefined()
      expect(element['name-picker'].rotation).toBe(720)
    }
  )

  it.each([0, 0.5, 1000.5, 1001])(
    'rejects HotPotato points %s with an actionable question path',
    (points) => {
      const config = createDefaultGameConfig('hot-potato')
      config.questions[0].points = points
      const validation = validateGameConfig('hot-potato', config)
      expect(validation).toMatchObject({
        isValid: false,
        errors: expect.arrayContaining([
          { path: ['questions', 0, 'points'], message: expect.stringMatching(/integer.*1.*1000/i) },
        ]),
      })
      expect(() => normalizeGameElement({ ...game(), 'hot-potato': config })).toThrow(
        /questions\.0\.points/
      )
    }
  )

  it.each([1, 1000])('admits HotPotato integer points %s', (points) => {
    const config = createDefaultGameConfig('hot-potato')
    config.questions[0].points = points
    expect(validateGameConfig('hot-potato', config)).toEqual({ isValid: true, errors: [] })
  })

  it.each([0, 0.5, 1001])('preserves quiz scoring policy for points %s', (points) => {
    const config = createDefaultGameConfig('quiz')
    config.questions[0].points = points
    expect(validateGameConfig('quiz', config)).toEqual({ isValid: true, errors: [] })
    expect(normalizeGameElement({ ...game('quiz'), quiz: config }).quiz.questions[0].points).toBe(
      points
    )
  })

  it('retains the canonical nullable and finite 5–300 second timing policy', () => {
    const config = createDefaultGameConfig('hot-potato')
    for (const timeLimit of [null, 5, 5.5, 300]) {
      config.questions[0].timeLimit = timeLimit
      expect(validateGameConfig('hot-potato', config)).toEqual({ isValid: true, errors: [] })
    }
    for (const timeLimit of [4, 301]) {
      config.questions[0].timeLimit = timeLimit
      expect(validateGameConfig('hot-potato', config).errors).toContainEqual({
        path: ['questions', 0, 'timeLimit'],
        message: expect.stringMatching(/5.*300/),
      })
    }
  })

  it.each([false, true])('rejects an effective invalid game override on child=%s', (child) => {
    const config = createDefaultGameConfig('hot-potato')
    config.questions[0].points = 0
    const value = deck({ 'hot-potato': config }, { child })
    expect(() => normalizePresentationGames(value)).toThrow(/questions\.0\.points/)
  })

  it.each(['master-game', fixedId('lesson', 'master-game')])(
    'sanitizes runtime override state addressed by %s without copying inherited fields',
    (key) => {
      const value = deck(
        {
          id: 'spoofed',
          type: 'text',
          rotation: 45,
          gameStatus: 'running',
          'hot-potato': { title: 'Override title', currentQuestion: 2, remainingTime: 9 },
        },
        { key }
      )
      const saved = normalizePresentationGames(value)
      expect(patchAt(saved, key)).toEqual({
        rotation: 45,
        'hot-potato': { ...createDefaultGameConfig('hot-potato'), title: 'Override title' },
      })
      saved.layoutMasters[0].fixedElements[0].x = 180
      const effective = resolveEffectiveElements(saved.slides[0], saved.layoutMasters).elements[0]
      expect(effective).toMatchObject({
        id: fixedId('lesson', 'master-game'),
        type: 'game',
        x: 180,
        rotation: 45,
      })
      expect(value.slides[0].layoutOverrides.elementPatches[key].gameStatus).toBe('running')
    }
  )

  it('keeps unoverridden master inheritance and non-game patches unchanged', () => {
    const value = deck()
    const text = {
      id: 'label',
      type: 'text',
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      content: 'Master label',
    }
    value.layoutMasters[0].fixedElements.push(text)
    value.slides[0].layoutOverrides = {
      elementPatches: { label: { content: 'Override label', rotation: 10 } },
    }
    const saved = normalizePresentationGames(value)
    expect(saved.slides[0].layoutOverrides).toEqual(value.slides[0].layoutOverrides)
    saved.layoutMasters[0].fixedElements[0]['hot-potato'].showLeaderboard = false
    saved.layoutMasters[0].fixedElements[0].rotation = 60
    const effective = resolveEffectiveElements(saved.slides[0], saved.layoutMasters).elements[0]
    expect(effective.rotation).toBe(60)
    expect(effective['hot-potato'].showLeaderboard).toBe(false)
  })

  it('preserves subtype switches and inactive authored configuration without materializing other master fields', () => {
    const value = deck({
      gameType: 'name-picker',
      'name-picker': {
        pickerMode: 'button',
        items: [{ id: 'learner', label: 'Learner', weight: 1 }],
        rotation: 500,
      },
    })
    const saved = normalizePresentationGames(value)
    expect(patchAt(saved)).toEqual({
      gameType: 'name-picker',
      'name-picker': {
        ...createDefaultGameConfig('name-picker'),
        pickerMode: 'button',
        items: [{ id: 'learner', label: 'Learner', weight: 1 }],
      },
    })
    const effective = normalizeGameElement(
      resolveEffectiveElements(saved.slides[0], saved.layoutMasters).elements[0]
    )
    expect(effective.gameType).toBe('name-picker')
    expect(effective['name-picker'].pickerMode).toBe('button')
    expect(effective['hot-potato']).toEqual(saved.layoutMasters[0].fixedElements[0]['hot-potato'])
  })

  it('persists migrated legacy question overrides as self-contained canonical blocks', () => {
    const saved = normalizePresentationGames(
      deck({
        'hot-potato': {
          questions: [
            {
              id: 'authored-question',
              question: 'Choose B',
              options: ['A', 'B'],
              correctIndex: 1,
            },
          ],
        },
      })
    )
    const config = patchAt(saved)['hot-potato']
    expect(config.questions[0]).toMatchObject({
      id: 'authored-question',
      kind: 'single-choice',
      prompt: 'Choose B',
      answerKey: { optionId: 'authored-question/option-2' },
      options: [
        { id: 'authored-question/option-1', text: 'A' },
        { id: 'authored-question/option-2', text: 'B' },
      ],
    })
    expect(validateGameConfig('hot-potato', config)).toEqual({ isValid: true, errors: [] })
    expect(patchAt(normalizePresentationGames(saved))).toEqual(patchAt(saved))
  })

  it('recovers incomplete canonical slide and override drafts without weakening default strict admission', () => {
    const config = createDefaultGameConfig('hot-potato')
    config.questions[0].points = 0
    config.questions[0].progress = 4
    const value = deck({ 'hot-potato': { ...config, currentQuestion: 2 } }, { child: true })
    const quiz = createDefaultGameConfig('quiz')
    quiz.questions[0].prompt = ''
    leaf(value, true).elements = [{ ...game('quiz'), quiz }]
    const recovered = normalizePresentationGames(value, { validate: false })
    expect(leaf(recovered, true).elements[0].quiz.questions[0].prompt).toBe('')
    expect(patchAt(recovered, 'master-game', true)['hot-potato'].questions[0].points).toBe(0)
    expect(
      patchAt(recovered, 'master-game', true)['hot-potato'].questions[0].progress
    ).toBeUndefined()
    expect(patchAt(recovered, 'master-game', true)['hot-potato'].currentQuestion).toBeUndefined()
    expect(() => normalizePresentationGames(recovered)).toThrow(/prompt|points/)
  })

  it('still rejects malformed legacy data in nonvalidating draft recovery', () => {
    const value = deck({ 'hot-potato': { questions: null } })
    expect(() => normalizePresentationGames(value, { validate: false })).toThrow(/questions/)
  })

  it('keeps geometry-only overrides attached to later master content changes', () => {
    const saved = normalizePresentationGames(deck({ rotation: 45, x: 190 }))
    expect(patchAt(saved)).toEqual({ rotation: 45, x: 190 })
    saved.layoutMasters[0].fixedElements[0]['hot-potato'].title = 'Updated master title'
    saved.layoutMasters[0].fixedElements[0]['hot-potato'].showLeaderboard = false
    const effective = resolveEffectiveElements(saved.slides[0], saved.layoutMasters).elements[0]
    expect(effective).toMatchObject({
      rotation: 45,
      x: 190,
      'hot-potato': {
        title: 'Updated master title',
        showLeaderboard: false,
      },
    })
  })
})

import { describe, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'
import {
  buildStaticGameSnapshot,
  renderStaticGameSnapshot,
} from '../src/education/static-snapshot.js'
import { createDefaultGameConfig } from '../src/education/game-defaults.js'
import { CANONICAL_GAME_TYPES } from '../src/education/game-registry.js'
import { createCanonicalQuestion } from '../src/education/question-factory.js'
import { QUESTION_KINDS } from '../src/education/question-shape.js'
import { staticGameContent } from '../src/education/static-game-content.js'
import { projectPublicGameConfig } from '../src/education/game-public-projection.js'

const element = (gameType, config = createDefaultGameConfig(gameType)) => ({
  type: 'game',
  id: 'activity',
  gameType,
  [gameType]: config,
  width: 640,
  height: 480,
})
const doc = (game, options) => new JSDOM(renderStaticGameSnapshot(game, options)).window.document

describe('static authored education snapshots', () => {
  it.each(CANONICAL_GAME_TYPES)(
    'keeps %s live audience preview public without reconstructing missing secrets',
    (type) => {
      const publicConfig = projectPublicGameConfig(type, createDefaultGameConfig(type))
      expect(JSON.stringify(staticGameContent(type, publicConfig))).not.toMatch(
        /answerKey|PRIVATE_|France → Paris/
      )
    }
  )

  it('discloses static interaction limits within each snapshot and identifies explicit teacher view only after opt-in', () => {
    const game = element('quiz')
    const publicNotice = doc(game).querySelector('[role="note"]').textContent
    expect(publicNotice).toMatch(/not interactive/i)
    expect(publicNotice).not.toMatch(/teacher/i)
    expect(doc(game, { teacherReveal: true }).querySelector('[role="note"]').textContent).toMatch(
      /teacher/i
    )
  })

  it('lists sorting items and buckets publicly without their assignments', () => {
    const game = element('sorting')
    const publicDocument = doc(game)
    expect(publicDocument.body.textContent).toContain('Apple')
    expect(publicDocument.body.textContent).toContain('Fruit')
    expect(publicDocument.body.textContent).not.toContain('Apple → Fruit')
    expect(JSON.stringify(buildStaticGameSnapshot(game))).not.toMatch(/assignments|bucketId|itemId/)
    expect(
      doc(game, { teacherReveal: true }).querySelector('[data-static-solution]').textContent
    ).toContain('Apple → Fruit')
  })

  it.each(CANONICAL_GAME_TYPES)(
    'renders the actual %s authored title and inert content',
    (type) => {
      const config = createDefaultGameConfig(type)
      config.title = `Authored ${type}`
      const authored = `Visible authored ${type}`
      if (config.questions) config.questions[0].prompt = authored
      else if (type === 'jeopardy') config.categories[0].questions[0].prompt = authored
      else if (['name-picker', 'lucky-wheel'].includes(type)) config.items[0].label = authored
      else if (type === 'scattergories') config.categories[0].label = authored
      else if (['poll', 'word-cloud', 'matching'].includes(type)) config.prompt = authored
      else if (type === 'countdown') config.expiryMessage = authored
      else if (type === 'scoreboard') config.teams[0].name = authored
      else if (type === 'flashcards') config.cards[0].front.text = authored
      else if (type === 'sorting') config.items[0].text = authored
      else if (type === 'crossword') config.entries[0].clue = authored
      const document = doc(element(type, config))
      expect(document.querySelector('h2').textContent).toBe(config.title)
      if (type === 'memory')
        expect(document.querySelectorAll('[data-static-card]')).toHaveLength(
          config.pairs.length * 2
        )
      else if (type === 'word-search')
        expect(document.body.textContent).toContain(config.words[0].text)
      else expect(document.body.textContent).toContain(authored)
      expect(document.querySelector('script, button, input, iframe')).toBeNull()
      expect(document.querySelector('[data-static-game]').getAttribute('data-static-game')).toBe(
        type
      )
    }
  )

  it('renders authored Jeopardy categories and point cells as a real board', () => {
    const config = createDefaultGameConfig('jeopardy')
    config.categories[0].title = 'Authored Geography'
    const document = doc(element('jeopardy', config))
    const rows = document.querySelectorAll('table tr')
    expect(rows[0].textContent).toContain('Authored Geography')
    expect(rows[1].textContent).toContain('100')
    expect(rows[1].textContent).toContain(config.categories[0].questions[0].prompt)
  })

  it('reveals media-only matching answers without losing their authored images', () => {
    const question = createCanonicalQuestion({ kind: 'matching' })
    question.options.left[0] = {
      ...question.options.left[0],
      text: '',
      media: { src: '/uploads/france.png', alt: 'France map' },
    }
    question.options.right[0] = {
      ...question.options.right[0],
      text: '',
      media: { src: '/uploads/paris.png', alt: 'Paris landmark' },
    }
    const document = doc(
      element('quiz', { ...createDefaultGameConfig('quiz'), questions: [question] }),
      { teacherReveal: true }
    )
    expect(
      [...document.querySelectorAll('[data-static-solution] img')].map((image) =>
        image.getAttribute('alt')
      )
    ).toEqual(['France map', 'Paris landmark'])
  })

  it('separates matching lists without preserving pair order or encoding pair IDs', () => {
    const config = createDefaultGameConfig('matching')
    config.pairs = [
      { promptId: 'SECRET_PAIR_A', prompt: 'France', targetId: 'SECRET_TARGET_A', target: 'Paris' },
      { promptId: 'SECRET_PAIR_B', prompt: 'Italy', targetId: 'SECRET_TARGET_B', target: 'Rome' },
    ]
    const game = element('matching', config)
    const publicDocument = doc(game)
    expect(
      [...publicDocument.querySelectorAll('[data-static-section="Prompts"] li')].map(
        (node) => node.textContent
      )
    ).toEqual(['France', 'Italy'])
    expect(
      [...publicDocument.querySelectorAll('[data-static-section="Targets"] li')].map(
        (node) => node.textContent
      )
    ).toEqual(['Paris', 'Rome'])
    expect(publicDocument.body.textContent).not.toContain('France → Paris')
    expect(JSON.stringify(buildStaticGameSnapshot(game))).not.toMatch(/SECRET_|pairs|answerKey/)
    expect(doc(game, { teacherReveal: true }).body.textContent).toContain('France → Paris')
    expect(doc(game, { teacherReveal: 'true' }).body.textContent).not.toContain('France → Paris')
    const remapped = structuredClone(game)
    ;[remapped.matching.pairs[0].target, remapped.matching.pairs[1].target] = [
      remapped.matching.pairs[1].target,
      remapped.matching.pairs[0].target,
    ]
    expect(buildStaticGameSnapshot(remapped)).toEqual(buildStaticGameSnapshot(game))
  })

  it.each(QUESTION_KINDS)(
    'keeps %s prompt/media/candidates public and reveals the key only explicitly',
    (kind) => {
      const question = createCanonicalQuestion({
        id: 'private-question',
        kind,
        prompt: `Authored ${kind}`,
        feedback: { correct: 'PRIVATE_FEEDBACK', explanation: 'PRIVATE_EXPLANATION' },
      })
      if (kind === 'fill-blank') question.answerKey.accepted = ['PRIVATE_FILL_ANSWER']
      const game = element('quiz', {
        ...createDefaultGameConfig('quiz'),
        questions: [question],
        revealAnswers: true,
      })
      const snapshot = buildStaticGameSnapshot(game)
      const document = doc(game)
      expect(document.body.textContent).toContain(question.prompt)
      expect(JSON.stringify(snapshot)).not.toMatch(/answerKey|PRIVATE_|private-question/)
      expect(document.querySelector('[data-static-solution]')).toBeNull()
      if (question.media)
        expect(document.querySelector('img').getAttribute('src')).toBe(question.media.src)
      expect(
        doc(game, { teacherReveal: true }).querySelector('[data-static-solution]')
      ).not.toBeNull()
      const solutions = [
        ...doc(game, { teacherReveal: true }).querySelectorAll('[data-static-solution]'),
      ]
        .map((node) => node.textContent)
        .join(' ')
      const expectedAnswer = {
        'single-choice': 'Option A',
        'multi-choice': 'Option A',
        'true-false': 'True',
        'fill-blank': 'PRIVATE_FILL_ANSWER',
        ordering: '1. Option A',
        matching: 'Left item → Right item',
        'image-hotspot': 'Target',
      }[kind]
      expect(solutions).toContain(expectedAnswer)
      expect(doc(game, { teacherReveal: true }).body.textContent).not.toContain('PRIVATE_FEEDBACK')
    }
  )

  it('shows covered memory geometry, flashcard fronts and unsolved crossword cells', () => {
    const memory = doc(element('memory'))
    expect(memory.querySelectorAll('[data-static-card]').length).toBe(4)
    expect(memory.body.textContent).not.toMatch(/France|Paris|Italy|Rome/)
    expect(doc(element('memory'), { teacherReveal: true }).body.textContent).toContain(
      'France → Paris'
    )
    expect(doc(element('flashcards')).body.textContent).toContain('Capital of France?')
    expect(doc(element('flashcards')).body.textContent).not.toContain('→ Paris')
    const crossword = doc(element('crossword'))
    expect(crossword.querySelectorAll('td').length).toBe(25)
    expect(crossword.body.textContent).toContain('A small feline')
    expect(
      [...crossword.querySelectorAll('[data-static-cell-letter]')]
        .map((node) => node.textContent)
        .join('')
    ).toBe('')
    expect(
      [
        ...doc(element('crossword'), { teacherReveal: true }).querySelectorAll(
          '[data-static-cell-letter]'
        ),
      ]
        .map((node) => node.textContent)
        .join('')
    ).toContain('CAT')
  })

  it('keeps the word-search board identical while only teacher view highlights its solution', () => {
    const game = element('word-search')
    const publicView = doc(game),
      teacherView = doc(game, { teacherReveal: true })
    expect([...publicView.querySelectorAll('td')].map((node) => node.textContent)).toEqual(
      [...teacherView.querySelectorAll('td')].map((node) => node.textContent)
    )
    expect(publicView.querySelector('[data-static-solution]')).toBeNull()
    expect(teacherView.querySelector('td[data-static-solution]')).not.toBeNull()
    expect(JSON.stringify(buildStaticGameSnapshot(game))).not.toMatch(/placements|path|seed/)
  })

  it('preserves authored images and theme, escapes markup and rejects invalid puzzle layouts', () => {
    const config = createDefaultGameConfig('flashcards')
    config.cards[0].front = { type: 'image', src: '/uploads/map.png', alt: 'Authored map' }
    const document = doc({
      ...element('flashcards', config),
      backgroundColor: '#123456',
      accentColor: '#fedcba',
      fontFamily: 'Georgia',
    })
    expect(document.querySelector('img').getAttribute('alt')).toBe('Authored map')
    expect(document.querySelector('[data-static-game]').style.backgroundColor).toBe(
      'rgb(18, 52, 86)'
    )
    config.cards[1].front.text = '<script>attack()</script>'
    expect(doc(element('flashcards', config)).querySelector('script')).toBeNull()
    const puzzle = createDefaultGameConfig('crossword')
    puzzle.entries[0].column = 4
    expect(() => buildStaticGameSnapshot(element('crossword', puzzle))).toThrow(/outside/)
  })
})

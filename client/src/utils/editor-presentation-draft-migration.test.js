import { describe, expect, it } from 'vitest'
import {
  createDefaultGameConfig,
  normalizeGameElement,
  normalizePresentationGames,
} from 'revealjs-shared'
import { migratePresentation } from './editor-presentation-migration'

const draftOptions = { draft: true }
const game = (type, config) => ({
  id: `game-${type}`,
  type: 'game',
  gameType: type,
  x: 10,
  y: 20,
  width: 640,
  height: 480,
  rotation: 25,
  [type]: config,
})

describe('draft-only presentation migration', () => {
  it('preserves incomplete canonical content and IDs while stripping runtime state on every authoring surface', () => {
    const config = createDefaultGameConfig('poll')
    config.options = [{ id: 'authored-option', text: 'Keep this choice', votes: 4 }]
    const poll = game('poll', config)
    poll.gameStatus = 'active'
    const picker = game('name-picker', { ...createDefaultGameConfig('name-picker'), rotation: 360 })
    const source = {
      id: 'deck',
      slides: [
        {
          id: 'parent',
          elements: [poll, picker],
          layoutId: 'master',
          layoutOverrides: {
            elementPatches: {
              'game-poll': {
                poll: { prompt: 'Draft override', options: config.options },
                gameStatus: 'active',
              },
            },
          },
          children: [
            {
              id: 'child',
              elements: [poll, { id: 'text', type: 'text', content: '<p>Keep me</p>' }],
            },
          ],
        },
      ],
      layoutMasters: [
        { id: 'master', name: 'Authored master', fixedElements: [poll], placeholders: [] },
      ],
    }
    const before = structuredClone(source)
    const recovered = migratePresentation(source, draftOptions)
    for (const recoveredPoll of [
      recovered.slides[0].elements[0],
      recovered.slides[0].children[0].elements[0],
      recovered.layoutMasters[0].fixedElements[0],
    ]) {
      expect(recoveredPoll.id).toBe('game-poll')
      expect(recoveredPoll.rotation).toBe(25)
      expect(recoveredPoll.poll.options).toEqual([
        { id: 'authored-option', text: 'Keep this choice' },
      ])
      expect(recoveredPoll.gameStatus).toBeUndefined()
    }
    expect(recovered.slides[0].elements[1].rotation).toBe(25)
    expect(recovered.slides[0].elements[1]['name-picker'].rotation).toBeUndefined()
    expect(recovered.slides[0].children[0].elements[1].content).toBe('<p>Keep me</p>')
    expect(recovered.slides[0].layoutOverrides.elementPatches['game-poll']).toEqual({
      poll: {
        prompt: 'Draft override',
        options: [{ id: 'authored-option', text: 'Keep this choice' }],
      },
    })
    expect(source).toEqual(before)
    expect(() => migratePresentation(source)).toThrow(/options/)
    expect(() => normalizePresentationGames(recovered)).toThrow(/options/)
  })

  it('preserves unresolved canonical dailyDouble references until the author repairs them', () => {
    const config = { ...createDefaultGameConfig('jeopardy'), dailyDouble: ['deleted-cell'] }
    const source = { slides: [{ elements: [game('jeopardy', config)] }] }
    const recovered = migratePresentation(source, draftOptions)
    expect(recovered.slides[0].elements[0].jeopardy.dailyDouble).toEqual(['deleted-cell'])
    expect(() => migratePresentation(source)).toThrow(/dailyDouble/)
    expect(() => normalizeGameElement(recovered.slides[0].elements[0])).toThrow(/dailyDouble/)
  })

  it('does not turn malformed legacy data or unknown subtypes into empty draft config', () => {
    for (const element of [
      game('poll', { options: null }),
      game('unrecognized', {}),
      game('jeopardy', { questions: { '0-100': { question: 'Ambiguous board' } } }),
    ]) {
      expect(() =>
        migratePresentation({ slides: [{ elements: [element] }] }, draftOptions)
      ).toThrow()
    }
  })
})

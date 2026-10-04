import { describe, expect, it } from 'vitest'
import { normalizePresentationGames } from '../src/education/presentation-game-normalization.js'
import { getProjectImportContentErrors } from '../src/project-import-content-validation.js'

const variable = (id = 'score') => ({ id, name: 'Score', initialValue: 0, min: -10, max: 10 })
const deck = () => ({
  interactionVariables: [variable()],
  slides: [
    {
      id: 'slide',
      elements: [
        {
          id: 'source',
          type: 'shape',
          action: { kind: 'score-add', variableId: 'score', amount: 1 },
        },
      ],
    },
  ],
})

describe('persisted interaction admission', () => {
  it.each([
    ['overflow', Array.from({ length: 33 }, (_, i) => variable(`v${i}`))],
    ['duplicate', [variable(), variable()]],
    ['NaN', [{ ...variable(), initialValue: NaN }]],
    ['Infinity', [{ ...variable(), max: Infinity }]],
    ['reversed', [{ ...variable(), min: 5 }]],
    ['runtime field', [{ ...variable(), value: 5 }]],
  ])(
    'rejects %s at normalized save and project import boundaries',
    (_label, interactionVariables) => {
      const value = { ...deck(), interactionVariables }
      expect(() => normalizePresentationGames(value)).toThrow(/variable|finite/i)
      expect(getProjectImportContentErrors(value)).toContainEqual(
        expect.stringMatching(/interactionVariables/)
      )
    }
  )

  it('round-trips all 32 bounded declarations without runtime values', () => {
    const value = deck()
    value.interactionVariables = Array.from({ length: 32 }, (_, i) =>
      variable(i === 0 ? 'score' : `v${i}`)
    )
    value.interactionValues = { score: 9 }
    const saved = normalizePresentationGames(value)
    const restored = normalizePresentationGames(JSON.parse(JSON.stringify(saved)))
    expect(restored.interactionVariables).toEqual(value.interactionVariables)
    expect(restored.interactionValues).toBeUndefined()
    expect(value.interactionValues.score).toBe(9)
  })

  it('rejects undeclared score actions and inherited child scoreboard bindings in the complete deck', () => {
    const value = deck()
    value.slides[0].elements[0].action.variableId = 'missing'
    expect(() => normalizePresentationGames(value)).toThrow(/declared.*variable/i)
    const bound = {
      id: 'board',
      type: 'game',
      gameType: 'scoreboard',
      scoreboard: {
        teams: [{ id: 'team', name: 'Team', color: '#123456', variableId: 'missing' }],
      },
    }
    value.slides = [
      { id: 'parent', elements: [], children: [{ id: 'child', layoutId: 'layout', elements: [] }] },
    ]
    value.layoutMasters = [
      { id: 'layout', name: 'Layout', placeholders: [], fixedElements: [bound] },
    ]
    expect(() => normalizePresentationGames(value)).toThrow(/declared.*variable/i)
  })

  it('rejects malformed initial visibility and action payloads, including master patches', () => {
    for (const fields of [
      { initialVisibility: 'collapsed' },
      { action: { kind: 'show', targetElementId: 'target', selector: '.answer' } },
    ]) {
      const value = deck()
      value.slides[0].elements[0] = { id: 'source', type: 'shape', ...fields }
      expect(() => normalizePresentationGames(value)).toThrow(/visibility|action/i)
      value.layoutMasters = [
        {
          id: 'layout',
          name: 'Layout',
          placeholders: [],
          fixedElements: [{ id: 'fixed', type: 'text' }],
        },
      ]
      value.slides = [
        {
          id: 'slide',
          layoutId: 'layout',
          elements: [],
          layoutOverrides: { elementPatches: { fixed: fields } },
        },
      ]
      expect(() => normalizePresentationGames(value)).toThrow(/visibility|action/i)
    }
  })
})

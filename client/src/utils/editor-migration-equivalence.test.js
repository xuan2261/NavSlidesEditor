import { describe, expect, it } from 'vitest'
import { migrateChild, migratePresentation, migrateSlide } from './editor-presentation-migration'

// Hand-reviewed legacy contract, not a generated snapshot or a second pipeline.
const config = {
  title: 'Live Poll',
  prompt: 'Nested',
  timerDuration: 30,
  options: [
    { id: 'option-a', text: 'Option A' },
    { id: 'option-b', text: 'Option B' },
  ],
  allowVoteChange: true,
  showResults: true,
}
const poll = () => ({
  id: 'poll',
  type: 'game',
  gameType: 'poll',
  prompt: 'Legacy',
  poll: { prompt: 'Nested' },
  gameStatus: 'active',
})
const canonical = { id: 'poll', type: 'game', gameType: 'poll', poll: config }
const geometry = { x: 10, y: 20, width: 300, height: 200 }

function fixture() {
  return {
    interactionValues: { score: 9 },
    layoutMasters: [
      {
        id: 'master',
        name: ' Master ',
        extra: true,
        placeholders: [],
        fixedElements: [{ ...poll(), ...geometry }],
      },
    ],
    slides: [
      {
        id: 'parent',
        elements: [
          poll(),
          { id: 'action', type: 'shape', action: { kind: ' next ', label: ' Next ' } },
        ],
        children: [
          {
            id: 'child',
            elements: [],
            layoutId: 'master',
            layoutOverrides: {
              hiddenElementIds: ['label', 'label'],
              elementPatches: {
                poll: {
                  id: 'spoof',
                  type: 'text',
                  poll: { prompt: 'Override' },
                  gameStatus: 'active',
                },
              },
            },
            children: [{ id: 'deep', elements: [poll()], notes: 'Deep notes' }],
          },
        ],
      },
    ],
  }
}

describe('migration legacy/canonical equivalence', () => {
  it('retains nested precedence, recursive education, master inheritance and sparse overrides', () => {
    const source = fixture()
    const before = structuredClone(source)
    const result = migratePresentation(source)
    expect(result).toEqual({
      layoutMasters: [
        {
          id: 'master',
          name: 'Master',
          placeholders: [],
          fixedElements: [{ ...canonical, ...geometry }],
        },
      ],
      slides: [
        {
          id: 'parent',
          notes: '',
          elements: [
            canonical,
            { id: 'action', type: 'shape', action: { kind: 'next', label: 'Next' } },
          ],
          children: [
            {
              id: 'child',
              notes: '',
              elements: [],
              layoutId: 'master',
              layoutOverrides: {
                hiddenElementIds: ['label'],
                elementPatches: { poll: { poll: { ...config, prompt: 'Override' } } },
              },
              children: [{ id: 'deep', elements: [canonical], notes: 'Deep notes' }],
            },
          ],
        },
      ],
    })
    expect(migratePresentation(result)).toEqual(result)
    expect(source).toEqual(before)
  })

  it.each([migrateSlide, migrateChild])(
    'retains standalone semantics and options for %s',
    (migrate) => {
      expect(migrate({ elements: [poll()] }).elements[0]).toEqual(canonical)
      const incomplete = { ...poll(), poll: { options: [{ id: 'only', text: 'One' }] } }
      expect(() => migrate({ elements: [incomplete] })).toThrow(/options/)
      expect(
        migrate({ elements: [incomplete] }, { validate: false }).elements[0].poll.options
      ).toEqual([{ id: 'only', text: 'One' }])
      const unsafe = { id: 'unsafe', type: 'shape', action: { kind: 'url', url: 'javascript:bad' } }
      expect(migrate({ elements: [unsafe] }).elements[0]).toEqual(unsafe)
    }
  )

  it('retains strict action and declaration validation in drafts, with deferred reference validation', () => {
    for (const draft of [false, true]) {
      const source = fixture()
      source.slides[0].elements = [
        { id: 'bad', type: 'shape', action: { kind: 'url', url: 'javascript:bad' } },
      ]
      expect(() => migratePresentation(source, { draft })).toThrow(/action/i)
      source.interactionVariables = [{ id: 'score', name: 'Score', initialValue: Infinity }]
      source.slides[0].elements = []
      expect(() => migratePresentation(source, { draft })).toThrow(/variable|finite/i)
    }
    const source = fixture()
    source.slides[0].elements = [
      {
        id: 'score',
        type: 'shape',
        action: { kind: 'score-add', variableId: 'missing', amount: 1 },
      },
    ]
    expect(() => migratePresentation(source)).toThrow(/declared.*variable/i)
    expect(
      migratePresentation(source, { draft: true }).slides[0].elements[0].action.variableId
    ).toBe('missing')
  })
})

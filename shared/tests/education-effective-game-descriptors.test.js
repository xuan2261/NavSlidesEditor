import { describe, expect, it } from 'vitest'
import { collectEffectiveGameDescriptors } from '../src/education/effective-game-descriptors.js'
import { createDefaultGameConfig } from '../src/education/game-defaults.js'
import { fixedId } from '../src/slide-layouts.js'

const game = (id, type = 'poll') => ({
  id,
  type: 'game',
  gameType: type,
  x: 0,
  y: 0,
  width: 500,
  height: 300,
  [type]: createDefaultGameConfig(type),
})
const inherited = () => ({
  id: 'deck',
  layoutMasters: [
    { id: 'lesson', name: 'Lesson', placeholders: [], fixedElements: [game('master')] },
  ],
  slides: [
    {
      id: 'a',
      layoutId: 'lesson',
      elements: [],
      children: [{ id: 'child', layoutId: 'lesson', elements: [] }],
    },
    { id: 'b', layoutId: 'lesson', elements: [] },
  ],
})

describe('effective generated game identities', () => {
  it('retains every inherited parent and vertical instance without changing saved IDs', () => {
    const source = inherited(),
      before = structuredClone(source)
    const descriptors = collectEffectiveGameDescriptors(source)
    expect(
      descriptors.map(({ effectiveSlideId, elementId }) => [effectiveSlideId, elementId])
    ).toEqual([
      ['a', fixedId('lesson', 'master')],
      ['child', fixedId('lesson', 'master')],
      ['b', fixedId('lesson', 'master')],
    ])
    expect(descriptors[0].config.prompt).toBe('What do you think?')
    expect(source).toEqual(before)
  })
  it.each(['master', fixedId('lesson', 'master')])(
    'applies resolver-hidden roots addressed by %s',
    (id) => {
      const source = inherited()
      source.slides[0].layoutOverrides = { hiddenElementIds: [id] }
      source.slides[0].children[0].layoutOverrides = {
        elementPatches: { master: { hidden: true } },
      }
      expect(collectEffectiveGameDescriptors(source).map((item) => item.effectiveSlideId)).toEqual([
        'b',
      ])
    }
  )
  it('uses effective nested override configuration and includes local-only subtypes', () => {
    const source = inherited()
    source.slides[0].layoutOverrides = {
      elementPatches: { master: { poll: { prompt: 'Override prompt' } } },
    }
    source.slides[1].elements.push(game('picker', 'name-picker'))
    const descriptors = collectEffectiveGameDescriptors(source)
    expect(descriptors.find((item) => item.effectiveSlideId === 'a').config.prompt).toBe(
      'Override prompt'
    )
    expect(descriptors.find((item) => item.elementId === 'picker').gameType).toBe('name-picker')
  })
  it('does not collapse identical owned element IDs on distinct effective slides', () => {
    const source = {
      slides: [
        { id: 'one', elements: [game('same')] },
        { id: 'two', elements: [game('same')] },
      ],
    }
    expect(
      collectEffectiveGameDescriptors(source).map((item) => [item.effectiveSlideId, item.elementId])
    ).toEqual([
      ['one', 'same'],
      ['two', 'same'],
    ])
  })
})

import { describe, expect, it } from 'vitest'
import { buildConnectorUpdateBatch, buildSelectionUpdates } from './element-update-fanout'
import { createElement } from './element-factory'

describe('buildSelectionUpdates', () => {
  it('excludes locked elements from property updates', () => {
    const elements = [
      { id: 'a', type: 'shape', x: 10, y: 20, width: 100, height: 80, locked: true },
      { id: 'b', type: 'shape', x: 30, y: 40, width: 120, height: 90 },
    ]

    expect(buildSelectionUpdates(elements, ['a', 'b'], 'b', { x: 50, rotation: 45 })).toEqual([
      { id: 'b', x: 50, rotation: 45 },
    ])
  })

  it('allows a locked element to receive only a pure unlock update', () => {
    const elements = [
      { id: 'a', type: 'shape', x: 10, y: 20, width: 100, height: 80, locked: true },
    ]

    expect(buildSelectionUpdates(elements, ['a'], 'a', { locked: false })).toEqual([
      { id: 'a', locked: false },
    ])
    expect(buildSelectionUpdates(elements, ['a'], 'a', { locked: false, x: 999 })).toEqual([])
  })

  it('blocks group mutation when any group member is locked or hidden', () => {
    const elements = [
      { id: 'a', type: 'shape', groupId: 'g1', x: 10, y: 20, width: 100, height: 80 },
      { id: 'b', type: 'shape', groupId: 'g1', x: 30, y: 40, width: 120, height: 90, locked: true },
      { id: 'c', type: 'shape', groupId: 'g2', x: 50, y: 60, width: 100, height: 80 },
      { id: 'd', type: 'shape', groupId: 'g2', x: 70, y: 80, width: 100, height: 80, hidden: true },
    ]

    expect(buildSelectionUpdates(elements, ['a'], 'a', { x: 40 })).toEqual([])
    expect(buildSelectionUpdates(elements, ['c'], 'c', { x: 80 })).toEqual([])
  })

  it('fans common element controls even when the field is absent from the element', () => {
    const elements = [
      { id: 'a', type: 'shape', x: 10, y: 20, width: 100, height: 80 },
      { id: 'b', type: 'image', x: 30, y: 40, width: 120, height: 90 },
    ]

    expect(
      buildSelectionUpdates(elements, ['a', 'b'], 'a', {
        locked: true,
        shadowX: 6,
        shadowY: 8,
        shadowBlur: 12,
        shadowColor: '#112233',
      })
    ).toEqual([
      { id: 'a', locked: true, shadowX: 6, shadowY: 8, shadowBlur: 12, shadowColor: '#112233' },
      { id: 'b', locked: true, shadowX: 6, shadowY: 8, shadowBlur: 12, shadowColor: '#112233' },
    ])
  })

  it('does not fan shadow controls to element types whose single-select panel hides shadow', () => {
    const elements = [
      { id: 'shape-1', type: 'shape', x: 10, y: 20, width: 100, height: 80 },
      { id: 'html-1', type: 'html', x: 30, y: 40, width: 120, height: 90 },
      { id: 'code-1', type: 'code', x: 50, y: 60, width: 140, height: 100 },
    ]

    expect(
      buildSelectionUpdates(elements, ['shape-1', 'html-1', 'code-1'], 'shape-1', {
        locked: true,
        shadowX: 6,
        shadowY: 8,
        shadowBlur: 12,
        shadowColor: '#112233',
      })
    ).toEqual([
      {
        id: 'shape-1',
        locked: true,
        shadowX: 6,
        shadowY: 8,
        shadowBlur: 12,
        shadowColor: '#112233',
      },
      { id: 'html-1', locked: true },
      { id: 'code-1', locked: true },
    ])
  })

  it.each([
    [
      'image',
      {
        filterBrightness: 125,
        filterContrast: 90,
        filterSaturate: 80,
        filterGrayscale: 10,
        filterSepia: 20,
        filterBlur: 2,
        borderRadius: 12,
        citationText: 'Source',
        citationLink: 'https://example.com',
        citationColor: '#123456',
        citationAlign: 'right',
      },
    ],
    ['code', { borderRadius: 16 }],
    ['markdown', { fontSize: 24 }],
    [
      'chart',
      {
        areaFill: true,
        stacked: true,
        legendPosition: 'bottom',
        axisTitles: { category: 'Month', value: 'Revenue' },
      },
    ],
  ])('fans every authored optional %s property to legacy elements', (type, updates) => {
    const elements = [{ id: `${type}-1`, type, x: 10, y: 20, width: 120, height: 90 }]

    expect(buildSelectionUpdates(elements, [`${type}-1`], `${type}-1`, updates)).toEqual([
      { id: `${type}-1`, ...updates },
    ])
  })

  it('ignores stale wrong-type properties on legacy elements', () => {
    const elements = [
      { id: 'image-1', type: 'image', x: 10, y: 20, width: 120, height: 90, fontSize: 99 },
    ]

    expect(buildSelectionUpdates(elements, ['image-1'], 'image-1', { fontSize: 24 })).toEqual([])
  })

  it.each([
    [
      'image',
      {
        filterBrightness: 100,
        filterContrast: 100,
        filterSaturate: 100,
        filterGrayscale: 0,
        filterSepia: 0,
        filterBlur: 0,
        borderRadius: 0,
        citationText: '',
        citationLink: '',
        citationColor: '#808080',
        citationAlign: 'left',
      },
    ],
    ['code', { borderRadius: 0 }],
    ['markdown', { fontSize: 18 }],
    [
      'chart',
      {
        areaFill: false,
        stacked: false,
        legendPosition: 'right',
        axisTitles: { category: '', value: '' },
      },
    ],
  ])('creates %s elements with every authored optional property', (type, expected) => {
    expect(createElement(type)).toMatchObject(expected)
  })
})

describe('connector update fanout', () => {
  it('merges target and dependent endpoint patches into one batch', () => {
    const batch = buildConnectorUpdateBatch(
      [
        { id: 'target', type: 'shape', x: 10, y: 20, width: 100, height: 40 },
        {
          id: 'line', type: 'line', x: 0, y: 0, width: 300, height: 100,
          x1: 0, y1: 50, x2: 300, y2: 50,
          connections: { start: { targetId: 'target', anchor: 'e' } },
        },
      ],
      [{ id: 'target', x: 40 }]
    )

    expect(batch).toEqual([{ id: 'target', x: 40 }, { id: 'line', x1: 140, y1: 40 }])
  })
})

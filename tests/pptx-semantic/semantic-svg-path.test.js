import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { parseSvgPathData } = require('../../server/services/pptx-import/ooxml-semantic-svg')

describe('bounded SVG path parser', () => {
  it('expands implicit coordinate tuples and converts relative M/L/C/Q commands', () => {
    expect(parseSvgPathData('M 1 2 4 6 l 3 -1 q 2 4 5 6 c 1 2 3 4 5 6 z')).toEqual([
      { kind: 'moveTo', points: [{ x: 1, y: 2 }] },
      { kind: 'lnTo', points: [{ x: 4, y: 6 }] },
      { kind: 'lnTo', points: [{ x: 7, y: 5 }] },
      { kind: 'quadBezTo', points: [{ x: 9, y: 9 }, { x: 12, y: 11 }] },
      { kind: 'cubicBezTo', points: [{ x: 13, y: 13 }, { x: 15, y: 15 }, { x: 17, y: 17 }] },
      { kind: 'close' },
    ])
  })

  it('parses signed fractional and exponent numbers without partial token matches', () => {
    expect(parseSvgPathData('M-1.25e1,+2E+1 L.5,-.25')).toEqual([
      { kind: 'moveTo', points: [{ x: -12.5, y: 20 }] },
      { kind: 'lnTo', points: [{ x: 0.5, y: -0.25 }] },
    ])
    expect(() => parseSvgPathData('M0 0 L1.2.3 4')).toThrow(/SVG path/i)
  })

  it('resets relative coordinates to each subpath start after closepath', () => {
    expect(parseSvgPathData('M10 20l5 6z l2 3 m8 7l1 1z q2 3 4 5')).toEqual([
      { kind: 'moveTo', points: [{ x: 10, y: 20 }] },
      { kind: 'lnTo', points: [{ x: 15, y: 26 }] },
      { kind: 'close' },
      { kind: 'lnTo', points: [{ x: 12, y: 23 }] },
      { kind: 'moveTo', points: [{ x: 20, y: 30 }] },
      { kind: 'lnTo', points: [{ x: 21, y: 31 }] },
      { kind: 'close' },
      { kind: 'quadBezTo', points: [{ x: 22, y: 33 }, { x: 24, y: 35 }] },
    ])
    expect(parseSvgPathData('M0 0L10 0z a5 5 0 0 1 10 0')[3]).toMatchObject({
      kind: 'arcTo', wR: 5, hR: 5, stAng: 10_800_000, swAng: 10_800_000,
    })
  })

  it('converts circular endpoint arcs to exact canonical arcTo angles', () => {
    const commands = parseSvgPathData('M0 0 A5 5 0 0 1 10 0')
    expect(commands[1]).toMatchObject({
      kind: 'arcTo', wR: 5, hR: 5, stAng: 10_800_000, swAng: 10_800_000,
    })
    expect(parseSvgPathData('M0 0 A0 5 0 0 1 10 0')[1]).toEqual({
      kind: 'lnTo', points: [{ x: 10, y: 0 }],
    })
  })

  it.each([
    ['unsupported command', 'M0 0 H10'],
    ['incomplete tuple', 'M0 0 C1 2 3 4'],
    ['non-finite coordinate', 'M0 0 L1e999 2'],
    ['coordinate outside bounded range', 'M0 0 L1e13 2'],
    ['drawing before move', 'L0 0'],
    ['garbage suffix', 'M0 0 L2 3x'],
    ['elliptical arc', 'M0 0 A2 3 0 0 1 4 4'],
    ['rotated arc', 'M0 0 A2 2 30 0 1 4 4'],
    ['relative endpoint overflow', 'M1e12 0l1 0'],
    ['relative control overflow', 'M1e12 0q1 0 -1 0'],
    ['relative cubic control overflow', 'M1e12 0c0 0 1 0 -1 0'],
    ['relative arc overflow', 'M1e12 0a1 1 0 0 1 1 0'],
    ['invalid arc flags', 'M0 0 A2 2 0 2 1 4 4'],
    ['leading comma', 'M,0 0'],
    ['repeated comma', 'M0,,0'],
    ['comma before command', 'M0 0,L1 2'],
  ])('rejects %s deterministically', (_label, source) => {
    expect(() => parseSvgPathData(source)).toThrow(/SVG path/i)
  })

  it('rejects empty paths and command-count overflow before projection', () => {
    expect(() => parseSvgPathData('')).toThrow(/SVG path/i)
    expect(() => parseSvgPathData(`M0 0 ${'L1 1 '.repeat(16384)}`)).toThrow(/SVG path/i)
    expect(() => parseSvgPathData(`M0 0${'z'.repeat(16384)}`)).toThrow(/SVG path/i)
    expect(parseSvgPathData(`M0 0${'z'.repeat(16383)}`)).toHaveLength(16384)
  })
})

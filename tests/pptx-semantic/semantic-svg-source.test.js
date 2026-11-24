import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { parseSvgSource } = require('../../server/services/pptx-import/ooxml-semantic-svg')

const svg = (body) => Buffer.from(body, 'utf8')

describe('bounded SVG source profile', () => {
  it('projects ordered simple paths with explicit paint defaults and source ordinals', () => {
    expect(parseSvgSource(svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 3 20 10"><path d="M0 0L5 5"/><path d="M1 1L4 4" fill="#abc" stroke="#123456" stroke-width="2"/></svg>'))).toEqual({
      viewBox: { x: -2, y: 3, width: 20, height: 10 },
      paths: [
        {
          sourceOrdinal: 0,
          commands: [
            { kind: 'moveTo', points: [{ x: 0, y: 0 }] },
            { kind: 'lnTo', points: [{ x: 5, y: 5 }] },
          ],
          fill: '#000000',
          stroke: 'none',
          strokeWidth: 1,
        },
        {
          sourceOrdinal: 1,
          commands: [
            { kind: 'moveTo', points: [{ x: 1, y: 1 }] },
            { kind: 'lnTo', points: [{ x: 4, y: 4 }] },
          ],
          fill: '#aabbcc',
          stroke: '#123456',
          strokeWidth: 2,
        },
      ],
    })
  })

  it.each([
    ['script element', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><script/></svg>'],
    ['foreign namespace', '<svg xmlns="http://www.w3.org/2000/svg" xmlns:x="urn:evil" viewBox="0 0 1 1"><x:path d="M0 0"/></svg>'],
    ['external reference', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0" href="https://blocked.invalid/x"/></svg>'],
    ['CSS style', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0" style="fill:red"/></svg>'],
    ['image resource', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><image href="x.png"/></svg>'],
    ['doctype declaration', '<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0"/></svg>'],
    ['comment', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><!--ignored--><path d="M0 0"/></svg>'],
    ['duplicate attributes', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0" fill="red" fill="blue"/></svg>'],
    ['unsupported viewBox dimensions', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 0 1"><path d="M0 0"/></svg>'],
    ['repeated viewBox comma', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0,,0 1 1"><path d="M0 0"/></svg>'],
    ['leading viewBox comma', '<svg xmlns="http://www.w3.org/2000/svg" viewBox=",0 0 1 1"><path d="M0 0"/></svg>'],
    ['trailing viewBox comma', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1,"><path d="M0 0"/></svg>'],
  ])('rejects %s instead of dropping its semantics', (_label, source) => {
    expect(() => parseSvgSource(svg(source))).toThrow(/SVG source/i)
  })
  it('rejects XML declaration variants, invalid UTF-8, excessive nesting, and element counts', () => {
    const header = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">'
    const path = '<path d="M0 0"/>'
    expect(parseSvgSource(svg(`<?xml version="1.0" encoding="UTF-8"?>${header}${path}</svg>`)).paths).toHaveLength(1)
    expect(() => parseSvgSource(Buffer.from([0xc3, 0x28]))).toThrow(/SVG source/i)
    expect(() => parseSvgSource(svg(`${header}${'<g>'.repeat(33)}${'</g>'.repeat(33)}${path}</svg>`))).toThrow(/SVG source/i)
    expect(() => parseSvgSource(svg(`${header}${path.repeat(4097)}</svg>`))).toThrow(/SVG source/i)
  })
})

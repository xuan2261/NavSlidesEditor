import { describe, it, expect } from 'vitest'
import { createElement } from '../../../utils/element-factory'
import { ELEMENT_DEFAULTS } from '../../../data/element-defaults'

// Smoke floor for elements: the factory applies the right defaults, stamps a
// unique id + type + position, and the result survives a JSON round-trip with
// type and key dimensions intact. This is the cheap, broad floor — exact
// behavior for high-risk elements (table merge) is covered by deep tests.
// Tags are LITERAL per type because the tag extractor reads source text, so a
// templated `[cap:element.${type}]` would not resolve to a real id.
function assertElementSmoke(type) {
  const el = createElement(type)
  // 1. renders/produces a well-formed element
  expect(el.type).toBe(type)
  expect(typeof el.id).toBe('string')
  expect(el.id.length).toBeGreaterThan(0)
  expect(typeof el.x).toBe('number')
  expect(typeof el.y).toBe('number')
  // 2. defaults applied
  expect(el.width).toBe(ELEMENT_DEFAULTS[type].width)
  expect(el.height).toBe(ELEMENT_DEFAULTS[type].height)
  // 3. round-trips through persistence preserving type + key props
  const round = JSON.parse(JSON.stringify(el))
  expect(round.type).toBe(type)
  expect(round.width).toBe(el.width)
  expect(round.height).toBe(el.height)
  return el
}

describe('element factory smoke floor', () => {
  it('[cap:element.text] text element factory + round-trip', () => assertElementSmoke('text'))
  it('[cap:element.image] image element factory + round-trip', () => assertElementSmoke('image'))
  it('[cap:element.shape] shape element factory + round-trip', () => assertElementSmoke('shape'))
  it('[cap:element.code] code element factory + round-trip', () => assertElementSmoke('code'))
  it('[cap:element.latex] latex element factory + round-trip', () => assertElementSmoke('latex'))
  it('[cap:element.html] html element factory + round-trip', () => assertElementSmoke('html'))
  it('[cap:element.markdown] markdown element factory + round-trip', () => assertElementSmoke('markdown'))
  it('[cap:element.chart] chart element factory + round-trip', () => assertElementSmoke('chart'))
  it('[cap:element.video] video element factory + round-trip', () => assertElementSmoke('video'))
  it('[cap:element.audio] audio element factory + round-trip', () => assertElementSmoke('audio'))
  it('[cap:element.icon] icon element factory + round-trip', () => assertElementSmoke('icon'))
  it('[cap:element.callout] callout element factory + round-trip', () => assertElementSmoke('callout'))
  it('[cap:element.qrcode] qrcode element factory + round-trip', () => assertElementSmoke('qrcode'))
  it('[cap:element.drawing] drawing element factory + round-trip', () => assertElementSmoke('drawing'))
  it('[cap:element.line] line element factory + round-trip', () => assertElementSmoke('line'))
  it('[cap:element.svg] svg element factory + round-trip', () => assertElementSmoke('svg'))
  it('[cap:element.timeline] timeline element factory + round-trip', () => assertElementSmoke('timeline'))

  it('throws on an unknown element type', () => {
    expect(() => createElement('not-a-real-type')).toThrow(/Unknown element type/)
  })
})

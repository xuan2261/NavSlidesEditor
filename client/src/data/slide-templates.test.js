import { describe, expect, it } from 'vitest'
import { SLIDE_TEMPLATES } from './slide-templates'

const SLIDE_WIDTH = 960
const SLIDE_HEIGHT = 540

const KNOWN_SHAPES = new Set([
  'rect',
  'rounded-rect',
  'circle',
  'triangle',
  'diamond',
  'arrow-right',
  'star',
  'hexagon',
  'pentagon',
  'parallelogram',
  'line',
])

const entries = Object.entries(SLIDE_TEMPLATES)

describe('SLIDE_TEMPLATES schema', () => {
  it('exposes at least one template', () => {
    expect(entries.length).toBeGreaterThan(0)
  })

  it('gives every template a string label, icon, category, and elements array', () => {
    for (const [key, tmpl] of entries) {
      expect(typeof tmpl.label, `${key}.label`).toBe('string')
      expect(tmpl.label.length, `${key}.label non-empty`).toBeGreaterThan(0)
      expect(typeof tmpl.icon, `${key}.icon`).toBe('string')
      expect(tmpl.icon.length, `${key}.icon non-empty`).toBeGreaterThan(0)
      expect(typeof tmpl.category, `${key}.category`).toBe('string')
      expect(tmpl.category.length, `${key}.category non-empty`).toBeGreaterThan(0)
      expect(Array.isArray(tmpl.elements), `${key}.elements is array`).toBe(true)
    }
  })

  it('keeps template keys and labels unique', () => {
    const keys = entries.map(([key]) => key)
    expect(new Set(keys).size, 'unique keys').toBe(keys.length)

    const labels = entries.map(([, tmpl]) => tmpl.label)
    expect(new Set(labels).size, 'unique labels').toBe(labels.length)
  })
})

describe('SLIDE_TEMPLATES element fields', () => {
  for (const [key, tmpl] of entries) {
    it(`${key}: every element has positioning + zIndex`, () => {
      tmpl.elements.forEach((el, i) => {
        const where = `${key}.elements[${i}]`
        expect(typeof el.type, `${where}.type`).toBe('string')
        for (const dim of ['x', 'y', 'width', 'height', 'zIndex']) {
          expect(typeof el[dim], `${where}.${dim}`).toBe('number')
          expect(Number.isFinite(el[dim]), `${where}.${dim} finite`).toBe(true)
        }
      })
    })

    it(`${key}: text and shape elements have type-specific fields`, () => {
      tmpl.elements.forEach((el, i) => {
        const where = `${key}.elements[${i}]`
        if (el.type === 'text') {
          expect(typeof el.content, `${where}.content`).toBe('string')
          expect(el.content.length, `${where}.content non-empty`).toBeGreaterThan(0)
        } else if (el.type === 'shape') {
          expect(typeof el.shape, `${where}.shape`).toBe('string')
          expect(KNOWN_SHAPES.has(el.shape), `${where}.shape "${el.shape}" known`).toBe(true)
          expect(el.fill, `${where}.fill present`).toBeDefined()
          expect(el.stroke, `${where}.stroke present`).toBeDefined()
          expect(typeof el.strokeWidth, `${where}.strokeWidth`).toBe('number')
        }
      })
    })
  }
})

describe('SLIDE_TEMPLATES bounds (960x540 grid)', () => {
  for (const [key, tmpl] of entries) {
    it(`${key}: every element fits the slide`, () => {
      tmpl.elements.forEach((el, i) => {
        const where = `${key}.elements[${i}]`
        expect(el.x, `${where}.x >= 0`).toBeGreaterThanOrEqual(0)
        expect(el.y, `${where}.y >= 0`).toBeGreaterThanOrEqual(0)
        expect(el.width, `${where}.width > 0`).toBeGreaterThan(0)
        expect(el.height, `${where}.height > 0`).toBeGreaterThan(0)
        expect(el.x + el.width, `${where} right edge <= ${SLIDE_WIDTH}`).toBeLessThanOrEqual(
          SLIDE_WIDTH
        )
        expect(el.y + el.height, `${where} bottom edge <= ${SLIDE_HEIGHT}`).toBeLessThanOrEqual(
          SLIDE_HEIGHT
        )
      })
    })
  }
})

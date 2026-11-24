import { describe, expect, it } from 'vitest'
import { validateProjectFile } from './import-project'

const malformedElements = [
  ['table', { data: {} }, 'data'],
  ['table', { data: [['valid'], {}] }, 'data'],
  ['markdown', { content: {} }, 'content'],
  ['code', { language: 17 }, 'language'],
]

describe('project import renderer-critical field admission', () => {
  it.each(malformedElements)('rejects malformed %s fields on parent slides', (type, fields, field) => {
    const parsed = {
      presentation: { title: 'Deck', slides: [{ elements: [{ type, ...fields }] }] },
    }
    const result = validateProjectFile(parsed)
    expect(result.valid).toBe(false)
    expect(result.errors.some((error) => error.includes(`slides[0].elements[0].${field}`))).toBe(true)
    expect(parsed.presentation.slides[0].elements[0]).toEqual({ type, ...fields })
  })

  it.each(malformedElements)('rejects malformed %s fields on vertical child slides', (type, fields, field) => {
    const parsed = {
      presentation: {
        title: 'Deck',
        slides: [{ elements: [], children: [{ elements: [{ type, ...fields }] }] }],
      },
    }
    const result = validateProjectFile(parsed)
    expect(result.valid).toBe(false)
    expect(result.errors.some((error) => error.includes(`slides[0].children[0].elements[0].${field}`))).toBe(true)
  })

  it('admits renderable content without changing literals or unknown language names', () => {
    const elements = [
      { type: 'table', data: [['Heading', 'Value'], ['Count', 17]] },
      { type: 'markdown', content: '```js\nconst t = **literal**\n```' },
      { type: 'code', content: 'console.log(17)', language: 'unknown-language' },
      { type: 'table' },
      { type: 'markdown', content: '' },
      { type: 'code', language: '' },
    ]
    const parsed = {
      presentation: { title: 'Deck', slides: [{ elements, children: [{ elements }] }] },
    }
    const before = JSON.stringify(parsed)
    expect(validateProjectFile(parsed)).toMatchObject({ valid: true, errors: [] })
    expect(JSON.stringify(parsed)).toBe(before)
  })
})

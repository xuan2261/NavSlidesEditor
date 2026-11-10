import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { normalizeOmmlDocument } = require('../../shared/src/pptx-omml-document')
const M = 'http://schemas.openxmlformats.org/officeDocument/2006/math'
let serial = 0
const node = (type, children = [], attributes = [], text) => ({
  componentId: `math-${++serial}`, namespaceUri: M, type, attributes, children,
  ...(text === undefined ? {} : { text }),
})
const run = (text) => node('r', [node('t', [], [], text)])
const doc = (root) => ({ schemaVersion: 1, root })

describe('strict canonical native OMML document', () => {
  it('retains nested native fractions, scripts and exact run text through JSON reopen', () => {
    const input = doc(node('oMath', [node('f', [
      node('num', [node('sSubSup', [node('e', [run('x')]), node('sub', [run('i')]), node('sup', [run('2')])])]),
      node('den', [node('rad', [node('deg', []), node('e', [run(' y ')])])]),
    ])]))
    const result = normalizeOmmlDocument(input)
    expect(result).toEqual(input)
    expect(normalizeOmmlDocument(JSON.parse(JSON.stringify(result)))).toEqual(result)
    expect(Object.isFrozen(result.root.children[0].children)).toBe(true)
    expect(Object.isFrozen(input)).toBe(false)
  })

  it.each([
    () => node('f', [node('num', [run('x')])]),
    () => node('f', [node('den', []), node('num', [])]),
    () => node('sSup', [node('e', []), node('sup', []), node('sup', [])]),
    () => node('r', [node('t', [], [], 'a'), node('t', [], [], 'b')]),
    () => node('futureMath'),
    () => node('r', [node('t', [], [{ namespaceUri: '', name: 'unknown', value: '1' }], 'x')]),
    () => ({ ...run('x'), namespaceUri: 'urn:foreign' }),
    () => node('m', [node('mr', [node('e', [])]), node('mr', [node('e', []), node('e', [])])]),
  ])('rejects malformed structure without changing the input', (make) => {
    const input = doc(node('oMath', [make()]))
    const before = JSON.stringify(input)
    expect(() => normalizeOmmlDocument(input)).toThrow()
    expect(JSON.stringify(input)).toBe(before)
  })

  it('rejects duplicate identities, unknown envelope keys and unsafe JSON', () => {
    const repeated = run('a')
    expect(() => normalizeOmmlDocument(doc(node('oMath', [repeated, repeated])))).toThrow()
    expect(() => normalizeOmmlDocument({ ...doc(node('oMath')), preview: '<svg/>' })).toThrow()
    const input = doc(node('oMath'))
    Object.defineProperty(input.root, 'text', { enumerable: true, get() { throw Error('must not execute') } })
    expect(() => normalizeOmmlDocument(input)).toThrow(/descriptor/)
  })
})

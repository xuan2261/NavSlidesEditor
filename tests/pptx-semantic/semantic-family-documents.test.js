import { beforeAll, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { familyDocumentsFixture, fields } from './family-documents-fixture'
const require = createRequire(import.meta.url)
const {
  normalizePptxSemanticDocument: normalize,
} = require('../../shared/src/pptx-semantic-document')
const { assertSemanticBaseline } = require('../../server/services/pptx-import/semantic-baseline')
const copy = (v) => JSON.parse(JSON.stringify(v))
let fixtures
beforeAll(async () => {
  fixtures = await familyDocumentsFixture()
})
const definition = (doc) => Object.values(doc.definitions)[0]
const reject = (doc) =>
  expect(() => normalize(doc)).toThrow(
    expect.objectContaining({ code: 'INVALID_PPTX_SEMANTIC_DOCUMENT' })
  )

describe('reader-derived canonical family ownership', () => {
  it.each(Object.keys(fields))('accepts and freezes %s, including JSON reopen', (kind) => {
    const doc = fixtures[kind],
      result = normalize(doc)
    expect(result).toEqual(doc)
    expect(Object.isFrozen(definition(result).content[fields[kind]])).toBe(true)
    expect(normalize(copy(result))).toEqual(result)
    expect(() =>
      assertSemanticBaseline({ pptxSemantic: result }, { pptxSemantic: copy(result) })
    ).not.toThrow()
  })
  it.each(Object.keys(fields))('validates every %s component binding', (kind) => {
    for (const component of definition(fixtures[kind]).components) {
      for (const mutation of ['missing', 'kind', 'hash', 'path', 'part', 'duplicate']) {
        const doc = copy(fixtures[kind]),
          d = definition(doc),
          c = d.components.find((c) => c.id === component.id)
        if (mutation === 'missing') d.components = d.components.filter((entry) => entry !== c)
        if (mutation === 'kind') c.kind = 'media-segment'
        if (mutation === 'hash') c.locator.preconditionHash = 'f'.repeat(64)
        if (mutation === 'path') c.locator.path = [99]
        if (mutation === 'part') c.partUri = 'ppt/other.xml'
        if (mutation === 'duplicate') d.components.push(copy(c))
        reject(doc)
      }
    }
  })
  it.each(Object.keys(fields))(
    'rejects malformed, mismatched and project-owned %s documents',
    (kind) => {
      for (const mutation of ['schema', 'kind', 'project', 'extra-field']) {
        const doc = copy(fixtures[kind]),
          d = definition(doc)
        if (mutation === 'schema') d.content[fields[kind]].schemaVersion = 99
        if (mutation === 'kind') d.kind = 'shape'
        if (mutation === 'project') {
          d.origin = 'project'
          d.kind = 'group'
          d.source = null
          d.components = []
        }
        if (mutation === 'extra-field') d.content[fields[kind]].opaqueXml = '<unsafe/>'
        reject(doc)
      }
    }
  )
  it.each(Object.keys(fields))(
    'rejects %s overrides and preserves its immutable source baseline',
    (kind) => {
      const original = fixtures[kind],
        d = definition(original),
        field = fields[kind]
      for (const component of d.components) {
        const doc = copy(original)
        doc.instances.occurrence.overrides.components = {
          [component.id]: { value: 'unsupported edit' },
        }
        reject(doc)
      }
      for (const target of ['root', 'component']) {
        const doc = copy(original),
          override = { [field]: copy(d.content[field]) }
        doc.instances.occurrence.overrides =
          target === 'root' ? override : { components: { [d.components[0].id]: override } }
        reject(doc)
      }
      const changed = copy(original),
        content = definition(changed).content[field]
      if (kind === 'table') content.columns[0].widthEmu++
      if (kind === 'chart')
        content.plots[0].series[0].data.val.cache.points[0].value = Number(
          (content.plots[0].series[0].data.val.cache.points[0].lexicalValue = '8')
        )
      if (kind === 'diagram')
        content.points[0].properties.push({ name: 'presName', value: 'changed' })
      if (kind === 'equation')
        content.root.children[0].children[0].children[1].children[0].children[0].text = '9'
      expect(() => normalize(changed)).not.toThrow()
      expect(() =>
        assertSemanticBaseline({ pptxSemantic: original }, { pptxSemantic: changed })
      ).toThrow(/immutable/)
    }
  )
  it.each(['chart', 'diagram'])(
    'limits %s cross-part authority to declared exact source bindings',
    (kind) => {
      for (const mutation of ['hash', 'uri', 'path', 'extra']) {
        const doc = copy(fixtures[kind]),
          d = definition(doc),
          c = d.components[0]
        if (mutation === 'hash') c.locator.preconditionHash = d.source.preconditionHash
        if (mutation === 'uri') c.partUri = d.source.partUri
        if (mutation === 'path') c.locator.path = [...c.locator.path, 0]
        if (mutation === 'extra')
          d.components.push({
            id: 'rogue',
            kind: 'property',
            partUri: c.partUri,
            locator: copy(c.locator),
          })
        reject(doc)
      }
    }
  )
  it('rejects a chart attached to another owner and an unsafe workbook package target', () => {
    const doc = copy(fixtures.chart)
    definition(doc).content.chartDocument.source.ownerDefinitionId = 'another-owner'
    reject(doc)
    const workbook = copy(fixtures.chart)
    definition(workbook).content.chartDocument.workbook.target = '../escape.xlsx'
    reject(workbook)
  })
  it.each([
    'ppt//bad.xml',
    '/ppt/bad.xml',
    'ppt/%2e%2e/bad.xml',
    'ppt/bad.xml?x',
    'ppt/bad.xml#x',
    'ppt\\bad.xml',
  ])('rejects unsafe declared foreign URI %s', (uri) => {
    const doc = copy(fixtures.diagram),
      d = definition(doc),
      old = d.content.smartArtDocument.relationships[0].partUri
    const replace = JSON.stringify(doc).replaceAll(old, uri.replaceAll('\\', '\\\\'))
    reject(JSON.parse(replace))
  })
  it.each(Object.keys(fields))('keeps legacy %s definitions without typed fields', (kind) => {
    const doc = copy(fixtures[kind]),
      d = definition(doc)
    d.content = {}
    d.components = []
    expect(() => normalize(doc)).not.toThrow()
  })
  it('does not permit foreign bindings on legacy definitions', () => {
    const doc = copy(fixtures.table),
      d = definition(doc)
    d.content = {}
    d.components[0].partUri = 'ppt/foreign.xml'
    reject(doc)
  })
  it.each(['table', 'equation'])(
    'rejects wrong-owner %s roots and stale unreferenced descendants',
    (kind) => {
      const doc = copy(fixtures[kind]),
        d = definition(doc)
      d.source.componentLocator.path = [99]
      reject(doc)
      const stale = copy(fixtures[kind]),
        s = definition(stale)
      s.components.push({ id: 'stale', kind: 'property', locator: copy(s.components[0].locator) })
      reject(stale)
    }
  )
  it('requires a structural table owner, and does not grant same-part hash substitution', () => {
    const table = copy(fixtures.table)
    delete definition(table).source.componentLocator.path
    reject(table)
    const chart = copy(fixtures.chart),
      d = definition(chart),
      source = d.content.chartDocument.source
    const changed = JSON.parse(JSON.stringify(chart).replaceAll(source.partUri, d.source.partUri))
    reject(changed)
  })
  it.each(['chart', 'diagram'])(
    'baseline protects coherent %s cross-part hash replacement',
    (kind) => {
      const original = fixtures[kind],
        doc = copy(original),
        d = definition(doc)
      const hash = d.components[0].locator.preconditionHash
      const changed = JSON.parse(JSON.stringify(doc).replaceAll(hash, 'e'.repeat(64)))
      expect(() => normalize(changed)).not.toThrow()
      expect(() =>
        assertSemanticBaseline({ pptxSemantic: original }, { pptxSemantic: changed })
      ).toThrow(/immutable/)
    }
  )
})

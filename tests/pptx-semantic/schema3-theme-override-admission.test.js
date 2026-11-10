import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { geometryStyleFixture } from './geometry-style-fixture.js'

const require = createRequire(import.meta.url)
const {
  normalizePptxSemanticDocument,
  PptxSemanticValidationError,
} = require('../../shared/src/pptx-semantic-document.js')
const {
  validateInheritanceStyleRecords,
  validateThemeOverrideRecord,
} = require('../../shared/src/pptx-geometry-style-records.js')
const { compactSemanticGraph } = require('../../shared/src/pptx-semantic-source-graph.js')
const { materializeGeometry, resolveGeometryStyle } = require('../../shared/src/pptx-geometry-style-resolution.js')
const { materializeTextTheme } = require('../../shared/src/pptx-text-materialization.js')

function schema3Fixture() {
  const schema2 = geometryStyleFixture()
  const layout = 'ppt/slideLayouts/slideLayout1.xml'
  const textContextId = 'text-context:ppt/slides/slide1.xml@ppt/slides/slide1.xml>rLayout#definition'
  const resourcesId = 'text-context-resources:res1'
  schema2.definitions.definition.components.push({
    id: 'text',
    kind: 'property',
    locator: { path: [0, 0, 99], preconditionHash: 'a'.repeat(64) },
  })
  schema2.definitions.definition.content.textDocument = { schemaVersion: 1, componentId: 'text', paragraphs: [] }
  schema2.styles[resourcesId] = {
    kind: 'text-context-resources',
    origin: 'source',
    source: schema2.styles.provider.source,
    payload: {
      schemaVersion: 1,
      fontDescriptors: [],
      records: {
        'record-0': {
          kind: 'theme',
          value: {
            source: { part: 'ppt/theme/theme1.xml' },
            colors: { accent2: 'FF0000', dk1: '000000' },
            colorAlpha: {},
          },
        },
      },
    },
  }
  schema2.styles[textContextId] = {
    kind: 'text-context',
    origin: 'source',
    source: schema2.styles.provider.source,
    payload: {
      schemaVersion: 1,
      occurrenceId: 'ppt/slides/slide1.xml@ppt/slides/slide1.xml>rLayout#definition',
      definitionId: 'definition',
      hostSlidePartUri: 'ppt/slides/slide1.xml',
      bindings: { layoutDefinitionId: null, masterDefinitionId: null },
      relationships: [
        {
          ownerPartUri: 'ppt/presentation.xml',
          relationshipId: 'rSlide1',
          type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide',
          targetPartUri: 'ppt/slides/slide1.xml',
          source: { part: 'ppt/_rels/presentation.xml.rels', path: [0, 0] },
          preconditionHash: 'a'.repeat(64),
        },
        {
          ownerPartUri: 'ppt/slides/slide1.xml',
          relationshipId: 'rLayout',
          type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout',
          targetPartUri: layout,
          source: { part: 'ppt/slides/_rels/slide1.xml.rels', path: [0, 0] },
          preconditionHash: 'a'.repeat(64),
        },
        {
          ownerPartUri: layout,
          relationshipId: 'rMaster',
          type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster',
          targetPartUri: 'ppt/slideMasters/slideMaster1.xml',
          source: { part: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', path: [0, 0] },
          preconditionHash: 'a'.repeat(64),
        },
        {
          ownerPartUri: 'ppt/slideMasters/slideMaster1.xml',
          relationshipId: 'theme',
          type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme',
          targetPartUri: 'ppt/theme/theme1.xml',
          source: { part: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', path: [0, 0] },
          preconditionHash: 'a'.repeat(64),
        },
      ],
      provenance: [],
      theme: 'record-0',
      resourcesId,
      body: { target: {}, entries: [] },
      paragraphs: [],
      fontRequests: [],
    },
  }
  schema2.instances.i1.textSourceBinding = { contextId: textContextId }
  const schema3 = compactSemanticGraph(schema2)
  return structuredClone(schema3)
}

describe('schema-three theme-override admission and consumers', () => {
  it('admits a valid project theme-override, survives JSON reopen, and updates geometry and text consumers', () => {
    const doc = schema3Fixture()
    doc.styles.projectTheme = {
      kind: 'theme-override',
      origin: 'project',
      baseStyleId: 'theme',
      values: {
        colors: {
          accent2: { kind: 'srgb', value: '8899AA' },
        },
      },
    }

    const admitted = normalizePptxSemanticDocument(doc)
    expect(admitted.styles.projectTheme).toBeDefined()

    const reopened = normalizePptxSemanticDocument(JSON.parse(JSON.stringify(admitted)))
    expect(reopened.styles.projectTheme).toEqual(doc.styles.projectTheme)

    const geom = materializeGeometry(reopened, 'i1')
    expect(geom.style.fill.color.value).toBe('8899AA')
    expect(resolveGeometryStyle(reopened, 'i1').properties.fill.dependencyIds).toContain(
      'projectTheme:colors.accent2'
    )

    const resolvedTextTheme = materializeTextTheme(reopened, 'i1')
    expect(resolvedTextTheme.colors.accent2).toBe('8899AA')
    expect(resolvedTextTheme.colors.dk1).toBe('000000')
  })

  it('admits numeric baseStyleId index, survives reopen, and matches geometry and text consumer outputs', () => {
    const doc = schema3Fixture()
    const themeIndex = doc.sourceIdentities.findIndex(
      (id) => id === 'theme' || (Array.isArray(id) && id[2] === 'theme')
    )
    expect(themeIndex).toBeGreaterThanOrEqual(0)

    doc.styles.projectTheme = {
      kind: 'theme-override',
      origin: 'project',
      baseStyleId: themeIndex,
      values: {
        colors: {
          accent2: { kind: 'srgb', value: '8899AA' },
        },
      },
    }

    const admitted = normalizePptxSemanticDocument(doc)
    expect(admitted.styles.projectTheme).toBeDefined()

    const reopened = normalizePptxSemanticDocument(JSON.parse(JSON.stringify(admitted)))
    expect(reopened.styles.projectTheme).toEqual(doc.styles.projectTheme)

    const geom = materializeGeometry(reopened, 'i1')
    expect(geom.style.fill.color.value).toBe('8899AA')
    expect(resolveGeometryStyle(reopened, 'i1').properties.fill.dependencyIds).toContain(
      'projectTheme:colors.accent2'
    )

    const resolvedTextTheme = materializeTextTheme(reopened, 'i1')
    expect(resolvedTextTheme.colors.accent2).toBe('8899AA')
    expect(resolvedTextTheme.colors.dk1).toBe('000000')
  })
  it('rejects missing or non-object values atomically', () => {
    const doc = schema3Fixture()
    doc.styles.projectTheme = {
      kind: 'theme-override',
      origin: 'project',
      baseStyleId: 'theme',
    }
    expect(() => validateInheritanceStyleRecords(doc)).toThrow(
      /Invalid geometry style links: project theme override/
    )
    expect(() => normalizePptxSemanticDocument(doc)).toThrow(PptxSemanticValidationError)

    doc.styles.projectTheme.values = 'invalid'
    expect(() => validateInheritanceStyleRecords(doc)).toThrow(
      /Invalid geometry style links: project theme override/
    )
    expect(() => normalizePptxSemanticDocument(doc)).toThrow(PptxSemanticValidationError)
  })

  it('rejects extra unexpected fields in values atomically', () => {
    const doc = schema3Fixture()
    doc.styles.projectTheme = {
      kind: 'theme-override',
      origin: 'project',
      baseStyleId: 'theme',
      values: {
        colors: {},
        fillStyles: [],
      },
    }
    expect(() => validateInheritanceStyleRecords(doc)).toThrow(
      /Invalid geometry style links: project theme override/
    )
    expect(() => normalizePptxSemanticDocument(doc)).toThrow(PptxSemanticValidationError)
  })

  it('rejects invalid or non-themeSlot color keys atomically', () => {
    const doc = schema3Fixture()
    for (const badSlot of ['bg1', 'tx1', 'phClr', 'customSlot', '']) {
      doc.styles.projectTheme = {
        kind: 'theme-override',
        origin: 'project',
        baseStyleId: 'theme',
        values: {
          colors: {
            [badSlot]: { kind: 'srgb', value: '112233' },
          },
        },
      }
      expect(() => validateInheritanceStyleRecords(doc)).toThrow(
        /Invalid geometry style links: project theme override/
      )
      expect(() => normalizePptxSemanticDocument(doc)).toThrow(PptxSemanticValidationError)
    }
  })

  it('rejects scheme color references inside theme-override colors atomically', () => {
    const doc = schema3Fixture()
    doc.styles.projectTheme = {
      kind: 'theme-override',
      origin: 'project',
      baseStyleId: 'theme',
      values: {
        colors: {
          accent2: { kind: 'scheme', value: 'accent1' },
        },
      },
    }
    expect(() => validateInheritanceStyleRecords(doc)).toThrow(
      /Invalid geometry style links: project theme override/
    )
    expect(() => normalizePptxSemanticDocument(doc)).toThrow(PptxSemanticValidationError)
  })

  it('rejects malformed color values and hex codes atomically', () => {
    const doc = schema3Fixture()
    for (const badColor of [
      'not-an-object',
      null,
      { kind: 'srgb', value: 'invalid-hex' },
      { kind: 'srgb', value: '12345' },
      { kind: 'srgb', value: '1234567' },
      { kind: 'unknown', value: '112233' },
    ]) {
      doc.styles.projectTheme = {
        kind: 'theme-override',
        origin: 'project',
        baseStyleId: 'theme',
        values: {
          colors: {
            accent2: badColor,
          },
        },
      }
      expect(() => validateInheritanceStyleRecords(doc)).toThrow(
        /Invalid geometry style links: project theme override/
      )
      expect(() => normalizePptxSemanticDocument(doc)).toThrow(PptxSemanticValidationError)
    }
  })

  it('rejects missing or wrong target baseStyleId atomically', () => {
    const doc = schema3Fixture()

    doc.styles.projectTheme = {
      kind: 'theme-override',
      origin: 'project',
      baseStyleId: 'nonExistentTheme',
      values: { colors: {} },
    }
    expect(() => validateInheritanceStyleRecords(doc)).toThrow(
      /Invalid geometry style links: missing theme reference/
    )
    expect(() => normalizePptxSemanticDocument(doc)).toThrow(PptxSemanticValidationError)

    doc.styles.projectTheme.baseStyleId = 'provider'
    expect(() => validateInheritanceStyleRecords(doc)).toThrow(
      /Invalid geometry style links: missing theme reference/
    )
    expect(() => normalizePptxSemanticDocument(doc)).toThrow(PptxSemanticValidationError)

    doc.styles.otherProject = {
      kind: 'theme-override',
      origin: 'project',
      baseStyleId: 'theme',
      values: { colors: {} },
    }
    doc.styles.projectTheme.baseStyleId = 'otherProject'
    expect(() => validateInheritanceStyleRecords(doc)).toThrow(
      /Invalid geometry style links: missing theme reference/
    )
    expect(() => normalizePptxSemanticDocument(doc)).toThrow(PptxSemanticValidationError)
  })

  it('rejects duplicate theme overrides for the same baseStyleId atomically', () => {
    const doc = schema3Fixture()
    doc.styles.overrideOne = {
      kind: 'theme-override',
      origin: 'project',
      baseStyleId: 'theme',
      values: { colors: { accent1: { kind: 'srgb', value: '112233' } } },
    }
    doc.styles.overrideTwo = {
      kind: 'theme-override',
      origin: 'project',
      baseStyleId: 'theme',
      values: { colors: { accent2: { kind: 'srgb', value: '445566' } } },
    }
    expect(() => validateInheritanceStyleRecords(doc)).toThrow(
      /Invalid geometry style links: duplicate theme override/
    )
    expect(() => normalizePptxSemanticDocument(doc)).toThrow(PptxSemanticValidationError)
  })

  it('rejects duplicate theme overrides across numeric index and named identity aliases atomically', () => {
    const doc = schema3Fixture()
    const themeIndex = doc.sourceIdentities.findIndex(
      (id) => id === 'theme' || (Array.isArray(id) && id[2] === 'theme')
    )
    expect(themeIndex).toBeGreaterThanOrEqual(0)

    doc.styles.overrideNamed = {
      kind: 'theme-override',
      origin: 'project',
      baseStyleId: 'theme',
      values: { colors: { accent1: { kind: 'srgb', value: '112233' } } },
    }
    doc.styles.overrideNumeric = {
      kind: 'theme-override',
      origin: 'project',
      baseStyleId: themeIndex,
      values: { colors: { accent2: { kind: 'srgb', value: '445566' } } },
    }
    expect(() => validateInheritanceStyleRecords(doc)).toThrow(
      /Invalid geometry style links: duplicate theme override/
    )
    expect(() => normalizePptxSemanticDocument(doc)).toThrow(PptxSemanticValidationError)
  })

  it('rejects duplicate theme overrides when numeric alias precedes named alias atomically', () => {
    const doc = schema3Fixture()
    const themeIndex = doc.sourceIdentities.findIndex(
      (id) => id === 'theme' || (Array.isArray(id) && id[2] === 'theme')
    )
    expect(themeIndex).toBeGreaterThanOrEqual(0)

    doc.styles.overrideNumeric = {
      kind: 'theme-override',
      origin: 'project',
      baseStyleId: themeIndex,
      values: { colors: { accent1: { kind: 'srgb', value: '112233' } } },
    }
    doc.styles.overrideNamed = {
      kind: 'theme-override',
      origin: 'project',
      baseStyleId: 'theme',
      values: { colors: { accent2: { kind: 'srgb', value: '445566' } } },
    }
    expect(() => validateInheritanceStyleRecords(doc)).toThrow(
      /Invalid geometry style links: duplicate theme override/
    )
    expect(() => normalizePptxSemanticDocument(doc)).toThrow(PptxSemanticValidationError)
  })

  it('rejects unsupported numeric string representation or invalid numeric baseStyleId atomically', () => {
    const doc = schema3Fixture()
    doc.styles.projectTheme = {
      kind: 'theme-override',
      origin: 'project',
      baseStyleId: '0',
      values: { colors: {} },
    }
    expect(() => validateInheritanceStyleRecords(doc)).toThrow(
      /Invalid geometry style links: (?:missing theme reference|project theme override)/
    )
    expect(() => normalizePptxSemanticDocument(doc)).toThrow(PptxSemanticValidationError)

    doc.styles.projectTheme.baseStyleId = 999999
    expect(() => validateInheritanceStyleRecords(doc)).toThrow(
      /Invalid (?:geometry style links: missing theme reference|semantic graph: identity reference)/
    )
    expect(() => normalizePptxSemanticDocument(doc)).toThrow(PptxSemanticValidationError)
  })
  it('rejects unknown project style record kinds atomically', () => {
    const doc = schema3Fixture()
    doc.styles.forged = {
      kind: 'unsupported-project-style',
      origin: 'project',
    }
    expect(() => validateInheritanceStyleRecords(doc)).toThrow(
      /Invalid geometry style links: unsupported project style record kind/
    )
    expect(() => normalizePptxSemanticDocument(doc)).toThrow(PptxSemanticValidationError)
  })

  it('exports validateThemeOverrideRecord for direct unit verification', () => {
    expect(typeof validateThemeOverrideRecord).toBe('function')
    const doc = schema3Fixture()
    const valid = {
      kind: 'theme-override',
      origin: 'project',
      baseStyleId: 'theme',
      values: { colors: { accent1: { kind: 'srgb', value: 'AABBCC' } } },
    }
    const overrides = new Set()
    const target = validateThemeOverrideRecord(doc, valid, overrides)
    expect(target).toBeDefined()
    expect(overrides.has('theme')).toBe(true)

    expect(() => validateThemeOverrideRecord(doc, valid, overrides)).toThrow(
      /Invalid geometry style links: duplicate theme override/
    )

    const themeIndex = doc.sourceIdentities.findIndex(
      (id) => id === 'theme' || (Array.isArray(id) && id[2] === 'theme')
    )
    const validNumeric = {
      kind: 'theme-override',
      origin: 'project',
      baseStyleId: themeIndex,
      values: { colors: { accent1: { kind: 'srgb', value: 'AABBCC' } } },
    }
    expect(() => validateThemeOverrideRecord(doc, validNumeric, overrides)).toThrow(
      /Invalid geometry style links: duplicate theme override/
    )
  })
})

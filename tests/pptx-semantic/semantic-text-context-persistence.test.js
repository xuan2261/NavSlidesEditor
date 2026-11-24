import { beforeAll, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { fixture, slide, layout, master } from './semantic-text-style-context-fixture'
import { expandedTextContextDocument } from './text-context-fixture-utils'

const require = createRequire(import.meta.url)
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
const {
  canonicalEditableSnapshot,
} = require('../../server/services/pptx-import/canonical-snapshot')
const { assertSemanticBaseline } = require('../../server/services/pptx-import/semantic-baseline')
const {
  collectTrustedImportMetadata,
} = require('../../server/services/pptx-import/trusted-import-metadata')
const { normalizePptxSemanticDocument } = require('../../shared/src/pptx-semantic-document')
const { normalizeSemanticPresentation } = require('../../shared/src/pptx-semantic-presentation')
const {
  toPresentationEditorDto,
  toExternalPresentationDto,
} = require('../../server/services/pptx-import/package-store/dto')
const {
  sanitizeClientEditableData,
} = require('../../server/services/pptx-import/authority-sanitizer')
const { updatePresentationSchema } = require('../../server/middleware/schemas')
const clone = (v) => JSON.parse(JSON.stringify(v))
let imported, baseline, instanceId, contextId

beforeAll(async () => {
  const zip = await fixture()
  for (const part of [slide, layout, master])
    zip.file(
      part,
      (await zip.file(part).async('string')).replaceAll(
        '<p:spPr/>',
        '<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="457200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>'
      )
    )
  zip.file(
    'ppt/presentation.xml',
    (await zip.file('ppt/presentation.xml').async('string')).replace(
      '</p:presentation>',
      '<p:sldSz cx="9144000" cy="5143500"/></p:presentation>'
    )
  )
  imported = await projectSemanticImport({
    zip,
    geometryInheritance: true,
    presentation: { id: 'deck', slides: [{ id: 'slide', elements: [] }] },
  })
  // Keep the existing legacy-v1 replay/forgery matrix; current compact imports
  // are exercised by the native snapshot and font identity regression.
  const legacy = clone(imported.presentation)
  legacy.pptxSemantic = expandedTextContextDocument(legacy.pptxSemantic)
  baseline = normalizeSemanticPresentation(legacy)
  instanceId = Object.keys(baseline.pptxSemantic.instances)[0]
  contextId = `text-context:${instanceId}`
})

describe('source text context persistence', () => {
  it('retains exact contexts and bindings through canonical JSON save/reopen', () => {
    const saved = canonicalEditableSnapshot(baseline)
    const reopened = normalizeSemanticPresentation(clone(saved))
    const model = reopened.pptxSemantic
    expect(model.schemaVersion).toBe(2)
    for (const context of Object.values(imported.admission.textStyleContexts)) {
      const record = model.styles[`text-context:${context.occurrenceId}`]
      expect(record).toMatchObject({ kind: 'text-context', origin: 'source', payload: context })
      expect(record.source.preconditionHash).toBe(
        model.definitions[context.definitionId].source.preconditionHash
      )
      const instance = model.instances[context.occurrenceId]
      if (instance)
        expect(instance.textSourceBinding).toEqual({
          contextId: `text-context:${context.occurrenceId}`,
        })
    }
    expect(model.definitions).toEqual(baseline.pptxSemantic.definitions)
    expect(() => assertSemanticBaseline(baseline, reopened)).not.toThrow()
    expect(imported.admission.visualQualification).toBe('unqualified')
    expect(model.fonts).toEqual({})
  })

  it('covers persisted text contexts with the existing trusted source hash', () => {
    const trusted = collectTrustedImportMetadata(baseline, 'original')
    const changed = clone(baseline)
    changed.pptxSemantic.styles[contextId].payload.paragraphs[0].run.entries[0].properties.bold =
      true
    expect(
      collectTrustedImportMetadata(changed, 'original').projection.immutableSourceHash
    ).not.toBe(trusted.projection.immutableSourceHash)
    expect(trusted.projection.modelVersion).toBe(2)
  })

  it('preserves bindings through actual save schema, sanitizer and read/export DTOs', () => {
    const saved = canonicalEditableSnapshot(
      sanitizeClientEditableData(updatePresentationSchema.parse(baseline))
    )
    for (const dto of [toPresentationEditorDto, toExternalPresentationDto])
      expect(dto(clone(saved)).pptxSemantic).toEqual(clone(baseline.pptxSemantic))
    expect(Object.isFrozen(baseline.pptxSemantic.styles[contextId].payload.body)).toBe(true)
  })

  it('does not treat a structurally valid detached context as server authority', () => {
    const changed = clone(baseline)
    changed.pptxSemantic.styles[contextId].payload.body.entries[0].properties.insetLeftEmu = 3
    expect(() => normalizePptxSemanticDocument(changed.pptxSemantic)).not.toThrow()
    expect(() => assertSemanticBaseline(baseline, changed)).toThrow(/immutable/)
  })

  it('keeps context-unavailable older schema two documents compatible', () => {
    const older = clone(baseline)
    for (const [id, style] of Object.entries(older.pptxSemantic.styles))
      if (style.kind === 'text-context') delete older.pptxSemantic.styles[id]
    for (const instance of Object.values(older.pptxSemantic.instances))
      delete instance.textSourceBinding
    const reopened = normalizeSemanticPresentation(clone(canonicalEditableSnapshot(older)))
    expect(Object.values(reopened.pptxSemantic.styles).some((s) => s.kind === 'text-context')).toBe(
      false
    )
    expect(() => assertSemanticBaseline(baseline, reopened)).toThrow()
  })

  it('rejects source list property edits disguised as component overrides', () => {
    const model = clone(baseline.pptxSemantic)
    const source = model.definitions[model.instances[instanceId].definitionId]
    const root = source.content.textListStyle.componentId
    model.instances[instanceId].overrides.components = {
      [root]: { textListStyle: source.content.textListStyle },
    }
    expect(() => normalizePptxSemanticDocument(model)).toThrow()
  })

  it('isolates an occurrence text edit from its sibling, source, and context', () => {
    const next = clone(baseline),
      model = next.pptxSemantic
    const original = model.instances[instanceId]
    const sibling = { ...clone(original), id: 'copy', paintIndex: original.paintIndex + 1 }
    model.instances.copy = sibling
    next.slides[0].elements.push({
      ...clone(next.slides[0].elements[0]),
      id: 'copy',
      pptxInstanceId: 'copy',
    })
    const text = clone(model.definitions[original.definitionId].content.textDocument)
    text.paragraphs[0].runs[0].text = 'Changed occurrence only'
    original.overrides.components = { [text.componentId]: { textDocument: text } }
    const reopened = normalizeSemanticPresentation(clone(canonicalEditableSnapshot(next)))
    expect(() => assertSemanticBaseline(baseline, reopened)).not.toThrow()
    expect(reopened.pptxSemantic.instances.copy.overrides).toEqual({})
    expect(reopened.pptxSemantic.definitions).toEqual(baseline.pptxSemantic.definitions)
    expect(reopened.pptxSemantic.styles).toEqual(baseline.pptxSemantic.styles)
    expect(
      reopened.pptxSemantic.instances[instanceId].overrides.components[text.componentId]
        .textDocument
    ).toEqual(text)
  })

  it.each([
    [
      'context payload',
      (m) => {
        m.styles[contextId].payload.body.entries[0].properties.insetLeftEmu = 3
      },
    ],
    [
      'missing context',
      (m) => {
        delete m.styles[contextId]
      },
    ],
    [
      'binding removal',
      (m) => {
        delete m.instances[instanceId].textSourceBinding
      },
    ],
    [
      'binding owner',
      (m) => {
        m.instances[instanceId].textSourceBinding.contextId = 'forged'
      },
    ],
    [
      'source list declaration',
      (m) => {
        m.definitions[
          `${master}#shape:4`
        ].content.textListStyle.entries[0].defaultRunProperties.fontSizePt = 99
      },
    ],
    [
      'source property component',
      (m) => {
        m.definitions[`${master}#shape:4`].components.find(
          (c) => c.kind === 'property'
        ).locator.path = [0, 99]
      },
    ],
  ])('rejects client changes to %s against the server baseline', (_, mutate) => {
    const changed = clone(baseline)
    mutate(changed.pptxSemantic)
    expect(() => assertSemanticBaseline(baseline, changed)).toThrow()
  })

  it.each([
    [
      'occurrence',
      (c) => {
        c.occurrenceId = 'forged'
      },
    ],
    [
      'owner',
      (c) => {
        c.definitionId = `${master}#shape:4`
      },
    ],
    [
      'provider',
      (c) => {
        c.bindings.layoutDefinitionId = `${master}#shape:4`
      },
    ],
    [
      'relationship',
      (c) => {
        c.relationships[1].relationshipId = 'forged'
      },
    ],
    [
      'hash',
      (c) => {
        c.provenance[0].preconditionHash = 'a'.repeat(64)
      },
    ],
    [
      'path',
      (c) => {
        c.body.entries[0].source.path = '0.99'
      },
    ],
    [
      'untyped property',
      (c) => {
        c.body.entries[0].properties.fabricated = 1
      },
    ],
    [
      'font provenance',
      (c) => {
        c.fontRequests[0].source.path = '0.99'
      },
    ],
  ])('rejects structurally forged context %s', (_, mutate) => {
    const model = clone(baseline.pptxSemantic)
    mutate(model.styles[contextId].payload)
    expect(() => normalizePptxSemanticDocument(model)).toThrow()
  })

  it.each([
    [
      'root component',
      (d) => {
        d.content.textListStyle.componentId = d.content.textDocument.componentId
      },
    ],
    [
      'entry owner',
      (d) => {
        d.content.textListStyle.entries[0].source.part = slide
      },
    ],
    [
      'entry path',
      (d) => {
        d.content.textListStyle.entries[0].source.path = '0.99'
      },
    ],
    [
      'entry property kind',
      (d) => {
        d.components.find((c) => c.id === d.content.textListStyle.entries[0].componentId).kind =
          'run'
      },
    ],
  ])('rejects invalid source list %s without a server baseline', (_, mutate) => {
    const model = clone(baseline.pptxSemantic)
    mutate(model.definitions[`${master}#shape:4`])
    expect(() => normalizePptxSemanticDocument(model)).toThrow()
  })
})

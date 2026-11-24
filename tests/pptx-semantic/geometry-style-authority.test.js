import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'
const require = createRequire(import.meta.url)
const { assertSemanticBaseline } = require('../../server/services/pptx-import/semantic-baseline')
const {
  collectTrustedImportMetadata,
  validateTrustedImportMetadata,
  getTrustedImportMetadata,
} = require('../../server/services/pptx-import/trusted-import-metadata')
const {
  normalizePptxSemanticDocument,
  PptxSemanticValidationError,
} = require('../../shared/src/pptx-semantic-document')
const { hashRecord } = require('../../server/services/pptx-import/package-store/schemas')

function fixture() {
  const deck = geometryProjectionFixture(),
    model = deck.pptxSemantic
  model.schemaVersion = 2
  const definition = model.definitions.definition,
    hash = definition.source.preconditionHash
  const location = (partUri, path = [0, 0]) => ({
    partUri,
    preconditionHash: hash,
    componentLocator: { path, preconditionHash: hash },
  })
  const source = location(definition.source.partUri)
  definition.source.componentLocator = source.componentLocator
  definition.content.geometrySource = { styleId: 'declarations' }
  const wrap = (value, path = [0, 0, 0]) => ({ source: location(source.partUri, path), value })
  model.styles.declarations = {
    origin: 'source',
    kind: 'geometry-declarations',
    source,
    payload: {
      definitionId: 'definition',
      properties: {},
      styleRefs: {},
      geometry: { definitionId: 'definition', componentId: 'geometry' },
      transform: wrap({
        off: wrap({ x: wrap(0), y: wrap(0) }),
        ext: wrap({ cx: wrap(100), cy: wrap(80) }),
      }),
    },
  }
  model.styles.context = {
    origin: 'source',
    kind: 'geometry-context',
    source,
    payload: {
      definitionId: 'definition',
      hostSlidePartUri: source.partUri,
      relationshipChain: [source.partUri],
      edges: [],
      declarationIds: ['declarations'],
      geometry: { definitionId: 'definition', componentId: 'geometry' },
      transformDeclarationIds: ['declarations'],
      themeId: null,
      colorMapIds: [],
      matrixBindings: {},
    },
  }
  model.styles.theme = {
    origin: 'source',
    kind: 'theme',
    source: location('ppt/theme/theme1.xml'),
    payload: {
      colors: {},
      fillStyles: [],
      backgroundFillStyles: [],
      lineStyles: [],
      effectStyles: [],
    },
  }
  for (const instance of Object.values(model.instances)) {
    instance.sourceBinding = { contextId: 'context' }
    instance.relationshipChain = [source.partUri]
  }
  return deck
}
const normalized = (deck) => normalizePptxSemanticDocument(deck.pptxSemantic)
const reject = (before, after) =>
  expect(() => assertSemanticBaseline(before, after)).toThrow(PptxSemanticValidationError)

describe('schema two server-owned source authority', () => {
  it('protects complete source templates while permitting canonical occurrence edits and reload', () => {
    const before = fixture(),
      source = before.pptxSemantic.definitions.definition.content.geometry
    source.schemaVersion = 2
    delete source.width
    delete source.height
    delete before.pptxSemantic.definitions.definition.content.extent
    normalized(before)
    const metadata = collectTrustedImportMetadata(before, 'original')
    expect(metadata.projection.operations).toEqual([
      { instanceId: 'i1', operations: ['geometry.edit', 'inheritance.edit'] },
      { instanceId: 'i2', operations: ['geometry.edit', 'inheritance.edit'] },
    ])
    const edited = structuredClone(before)
    const canonical = { ...structuredClone(source), schemaVersion: 1, width: 100, height: 80 }
    canonical.paths[0].commands[1].points[0].x = 33
    edited.pptxSemantic.instances.i1.overrides.components = {
      geometry: { geometryDocument: canonical, geometryStyle: { stroke: { cap: null } } },
    }
    normalized(edited)
    expect(() => assertSemanticBaseline(before, edited)).not.toThrow()
    expect(collectTrustedImportMetadata(edited, 'original').projection.immutableSourceHash).toBe(
      metadata.projection.immutableSourceHash
    )
    const reloaded = JSON.parse(JSON.stringify(edited))
    normalized(reloaded)
    expect(() => assertSemanticBaseline(before, reloaded)).not.toThrow()
    expect(reloaded.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    expect(reloaded.pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
    for (const mutate of [
      (model) => {
        model.definitions.definition.content.geometry.guides[0].formula = 'val 10'
      },
      (model) => {
        Object.assign(model.definitions.definition.content.geometry, {
          schemaVersion: 1,
          width: 100,
          height: 80,
        })
      },
      (model) => {
        model.styles.declarations.payload.transform.value.ext.value.cx.value = 200
      },
      (model) => {
        model.styles.rebound = structuredClone(model.styles.context)
        model.instances.i1.sourceBinding.contextId = 'rebound'
      },
    ]) {
      const forged = structuredClone(edited)
      mutate(forged.pptxSemantic)
      normalized(forged)
      reject(before, forged)
    }
  })
  it('uses real typed normalization for source declarations and contexts', () => {
    expect(normalized(fixture()).schemaVersion).toBe(2)
  })
  it.each([
    (m) => {
      m.styles.theme.payload.colors = {
        accent1: {
          source: {
            ...m.styles.theme.source,
            componentLocator: {
              path: [0, 0, 1],
              preconditionHash: m.styles.theme.source.preconditionHash,
            },
          },
          value: { kind: 'srgb', value: 'ffffff' },
        },
      }
    },
    (m) => {
      m.styles.theme.source.preconditionHash = 'b'.repeat(64)
      m.styles.theme.source.componentLocator.preconditionHash = 'b'.repeat(64)
    },
    (m) => {
      delete m.styles.theme
    },
    (m) => {
      m.styles.extraTheme = structuredClone(m.styles.theme)
    },
    (m) => {
      m.styles.theme = {
        origin: 'project',
        kind: 'theme-override',
        baseStyleId: 'otherTheme',
        values: {},
      }
      m.styles.otherTheme = structuredClone(fixture().pptxSemantic.styles.theme)
    },
    (m) => {
      m.styles.secondContext = structuredClone(m.styles.context)
    },
  ])('rejects structurally valid source record forgery %#', (mutate) => {
    const before = fixture(),
      after = structuredClone(before)
    mutate(after.pptxSemantic)
    normalized(after)
    reject(before, after)
  })
  it('rejects an existing rebind even when both contexts are trusted and valid', () => {
    const before = fixture()
    before.pptxSemantic.styles.otherContext = structuredClone(before.pptxSemantic.styles.context)
    const after = structuredClone(before)
    after.pptxSemantic.instances.i1.sourceBinding.contextId = 'otherContext'
    normalized(after)
    reject(before, after)
    after.pptxSemantic.instances.i1.lineage = { tombstone: true }
    reject(before, after)
  })
  it.each([
    (m) => {
      delete m.instances.i1.sourceBinding
    },
    (m) => {
      delete m.instances.i1.relationshipChain
    },
    (m) => {
      m.instances.i1.relationshipChain = []
    },
    (m) => {
      delete m.instances.i1
    },
    (m) => {
      m.schemaVersion = 1
    },
    (m) => {
      m.schemaVersion = 1
      m.styles = {}
      delete m.definitions.definition.content.geometrySource
      for (const i of Object.values(m.instances)) delete i.sourceBinding
    },
  ])('rejects source identity removal or schema downgrade %#', (mutate) => {
    const before = fixture(),
      after = structuredClone(before)
    mutate(after.pptxSemantic)
    reject(before, after)
  })
  it('rejects promotion of a project definition to a new untrusted source identity', () => {
    const before = fixture()
    before.pptxSemantic.definitions.group = {
      id: 'group',
      kind: 'group',
      origin: 'project',
      source: null,
      components: [],
      content: {},
    }
    const after = structuredClone(before)
    after.pptxSemantic.definitions.group.origin = 'source'
    after.pptxSemantic.definitions.group.source = {
      ...after.pptxSemantic.definitions.definition.source,
      nativeId: 'group-source',
    }
    normalized(after)
    reject(before, after)
  })
  it('persists copied bindings, grouping, moves, sparse paint and project theme changes', () => {
    const before = fixture(),
      after = structuredClone(before),
      m = after.pptxSemantic
    m.instances.clone = {
      ...structuredClone(m.instances.i1),
      id: 'clone',
      slideId: 's2',
      localTransform: [1, 0, 0, 1, 25, 30],
      paintIndex: 9,
    }
    m.definitions.group = {
      id: 'group',
      kind: 'group',
      origin: 'project',
      source: null,
      components: [],
      content: {},
    }
    m.instances.group = {
      id: 'group',
      definitionId: 'group',
      slideId: 's2',
      parentInstanceId: null,
      localTransform: [1, 0, 0, 1, 0, 0],
      paintIndex: 2,
      overrides: {},
    }
    m.instances.clone.parentInstanceId = 'group'
    m.instances.clone.overrides = {
      components: {
        geometry: {
          geometryStyle: {
            fill: { color: { kind: 'srgb', value: 'ff0000' } },
            stroke: { cap: null },
          },
        },
      },
    }
    m.styles.override = {
      origin: 'project',
      kind: 'theme-override',
      baseStyleId: 'theme',
      values: { colors: { accent1: { kind: 'srgb', value: '112233' } } },
    }
    normalized(after)
    expect(() => assertSemanticBaseline(before, after)).not.toThrow()
    const reload = structuredClone(after)
    reload.pptxSemantic.styles.override.values.colors.accent1.value = '445566'
    expect(() => assertSemanticBaseline(after, reload)).not.toThrow()
  })
  it('rejects a clone with an untrusted context rather than accepting a client assertion', () => {
    const before = fixture(),
      after = structuredClone(before),
      m = after.pptxSemantic
    m.styles.forged = structuredClone(m.styles.context)
    m.instances.clone = {
      ...structuredClone(m.instances.i1),
      id: 'clone',
      sourceBinding: { contextId: 'forged' },
    }
    normalized(after)
    reject(before, after)
  })
  it('hashes only definitions and source styles in profile two under the package Original', () => {
    const deck = fixture(),
      metadata = collectTrustedImportMetadata(deck, 'original')
    expect(metadata.projection).toEqual({
      schemaVersion: 2,
      modelVersion: 2,
      immutableSourceHash: hashRecord({
        definitions: deck.pptxSemantic.definitions,
        styles: deck.pptxSemantic.styles,
      }),
      operations: [
        { instanceId: 'i1', operations: ['geometry.edit', 'inheritance.edit'] },
        { instanceId: 'i2', operations: ['geometry.edit', 'inheritance.edit'] },
      ],
    })
    deck.pptxSemantic.instances.i1.localTransform[4] += 10
    deck.pptxSemantic.styles.override = {
      origin: 'project',
      kind: 'theme-override',
      baseStyleId: 'theme',
      values: {},
    }
    expect(collectTrustedImportMetadata(deck, 'original').projection).toEqual(metadata.projection)
    deck.pptxSemantic.styles.theme.payload.colors = {
      accent1: {
        source: deck.pptxSemantic.styles.theme.source,
        value: { kind: 'srgb', value: '112233' },
      },
    }
    expect(collectTrustedImportMetadata(deck, 'original').projection.immutableSourceHash).not.toBe(
      metadata.projection.immutableSourceHash
    )
    const head = {
      presentationId: 'deck',
      originalRevisionId: 'original',
      packageRevisionId: 'original',
    }
    const state = {
      mutationResults: [
        {
          presentationId: 'deck',
          packageRevisionId: 'original',
          operation: 'package-import',
          trustedImportMetadata: metadata,
        },
      ],
    }
    expect(getTrustedImportMetadata(state, head)).toEqual(metadata)
    expect(() => validateTrustedImportMetadata(metadata, 'replacement')).toThrow(TypeError)
    for (const patch of [
      { immutableSourceHash: 'invalid' },
      { definitionsHash: 'a'.repeat(64) },
      { schemaVersion: 1 },
      { modelVersion: 1 },
      { adapterQualified: true },
      { transactionEligible: true },
      { level4Promoted: true },
      { native: true },
    ]) {
      expect(() =>
        validateTrustedImportMetadata(
          { ...metadata, projection: { ...metadata.projection, ...patch } },
          'original'
        )
      ).toThrow(TypeError)
    }
  })
  it('retains the exact version one profile and baseline rules', () => {
    const deck = geometryProjectionFixture(),
      before = structuredClone(deck)
    expect(collectTrustedImportMetadata(deck, 'original').projection).toEqual({
      schemaVersion: 1,
      modelVersion: 1,
      definitionsHash: hashRecord(deck.pptxSemantic.definitions),
      operations: [
        { instanceId: 'i1', operations: ['geometry.edit'] },
        { instanceId: 'i2', operations: ['geometry.edit'] },
      ],
    })
    deck.pptxSemantic.styles.legacy = { arbitrary: 'preserved' }
    deck.pptxSemantic.instances.i1.relationshipChain = ['legacy-editable']
    expect(() => assertSemanticBaseline(before, deck)).not.toThrow()
  })
})

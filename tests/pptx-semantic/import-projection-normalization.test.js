// @vitest-environment node
import { createRequire } from 'node:module'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import JSZip from 'jszip'
import { chartProjectionFixture } from './projection-capabilities-fixture'
import { geometryStyleFixture } from './geometry-style-fixture'

const require = createRequire(import.meta.url)
const semantic = require('../../shared/src/pptx-semantic-document')
const snapshots = require('../../server/services/pptx-import/canonical-snapshot')
const { compactSemanticGraph } = require('../../shared/src/pptx-semantic-source-graph')
const { semanticInstances } = require('../../shared/src/pptx-semantic-records')
const { buildImportSourceMap } = require('../../server/services/pptx-import/source-map')
const modulePaths = [
  require.resolve('../../shared/src/pptx-projection-capabilities'),
  require.resolve('../../server/services/pptx-import/trusted-import-metadata'),
  require.resolve('../../server/services/pptx-import/package-store/import-commit'),
]
const cached = modulePaths.map((file) => require.cache[file])
let normalization, canonicalization, capabilities, metadata, prepareImport
beforeAll(() => {
  // Call-through spies exercise real validation and publication, never substitute models.
  normalization = vi.spyOn(semantic, 'normalizePptxSemanticDocument')
  canonicalization = vi.spyOn(snapshots, 'canonicalEditableSnapshot')
  for (const file of modulePaths) delete require.cache[file]
  capabilities = require(modulePaths[0])
  metadata = require(modulePaths[1])
  ;({ prepareImport } = require(modulePaths[2]))
})
beforeEach(() => { normalization.mockClear(); canonicalization.mockClear() })
afterAll(() => {
  normalization.mockRestore()
  canonicalization.mockRestore()
  modulePaths.forEach((file, index) => {
    if (cached[index]) require.cache[file] = cached[index]
    else delete require.cache[file]
  })
})

const expectedDomains = (model) => [...semanticInstances(model)].flatMap(([instanceId]) => {
  const { operations } = capabilities.getProjectionCapabilities(model, instanceId)
  return operations.length ? [{ instanceId, operations }] : []
})

describe('import operation-scoped validated projection reuse', () => {
  it.each([1, 2, 3])('preserves schema %i single-occurrence domains with one batch normalization', (schema) => {
    let model = schema === 1 ? chartProjectionFixture().pptxSemantic : geometryStyleFixture()
    if (schema === 3) model = structuredClone(compactSemanticGraph(model))
    const before = structuredClone(model)
    const expected = expectedDomains(model)
    normalization.mockClear()
    expect(capabilities.getProjectionCapabilitiesForInstances(model)).toEqual(expected)
    expect(normalization).toHaveBeenCalledTimes(1)
    expect(model).toEqual(before)
  })

  it('keeps locked, inactive and invalid chart override domains identical', () => {
    for (const failure of ['locked', 'tombstone', 'values']) {
      const model = chartProjectionFixture().pptxSemantic
      const instance = model.instances.i1
      if (failure === 'locked') instance.overrides.locked = true
      else if (failure === 'values') instance.overrides.components = { 'series-17': { values: ['bad', 20] } }
      else instance.lineage = { [failure]: true }
      const expected = expectedDomains(model)
      normalization.mockClear()
      expect(capabilities.getProjectionCapabilitiesForInstances(model)).toEqual(expected)
      expect(normalization).toHaveBeenCalledTimes(1)
    }
  })

  it.each(['missing-definition', 'authority', 'accessor', 'frozen-lookalike'])(
    'does not bypass malformed %s model validation', (failure) => {
      const model = chartProjectionFixture().pptxSemantic
      let invoked = false
      if (failure === 'missing-definition') model.instances.i2.definitionId = 'missing'
      if (failure === 'authority') model.transactionEligible = true
      if (failure === 'accessor') Object.defineProperty(model.definitions, 'bad', {
        enumerable: true, get() { invoked = true; return {} },
      })
      if (failure === 'frozen-lookalike') {
        model.instances.i2.definitionId = 'missing'
        const freeze = (value) => {
          if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
        }
        freeze(model)
      }
      expect(capabilities.getProjectionCapabilities(model, 'i1')).toEqual({ operations: [] })
      expect(() => capabilities.getProjectionCapabilitiesForInstances(model)).toThrow()
      expect(invoked).toBe(false)
    }
  )

  it('revalidates the same mutable model instead of caching caller claims', () => {
    const model = chartProjectionFixture().pptxSemantic
    expect(capabilities.getProjectionCapabilitiesForInstances(model)).toHaveLength(2)
    model.instances.i1.overrides.locked = true
    expect(capabilities.getProjectionCapabilitiesForInstances(model)).toEqual([
      { instanceId: 'i2', operations: ['chart.series.set-values'] },
    ])
    model.instances.i2.definitionId = 'missing'
    expect(() => capabilities.getProjectionCapabilitiesForInstances(model)).toThrow()
  })

  it('binds only detached metadata and preserves baseline, profile and Original validation', () => {
    const projection = chartProjectionFixture()
    projection.slides[0].elements[0]._pptxImportMeta = { sourceCrop: true }
    const expected = metadata.collectTrustedImportMetadata(projection, 'original')
    canonicalization.mockClear()
    const prepared = metadata.prepareTrustedImportProjection(projection)
    expect(canonicalization).toHaveBeenCalledTimes(1)
    projection.slides[0].elements[0]._pptxImportMeta.sourceCrop = false
    projection.pptxSemantic.instances.i1.overrides.locked = true
    prepared.canonicalProjection.pptxSemantic.instances.i1.overrides.locked = true
    prepared.canonicalProjection.slides[0].elements[0].width = 999
    expect(prepared.collectTrustedImportMetadata('original')).toEqual(expected)
    expect(() => prepared.collectTrustedImportMetadata('')).toThrow(/Original revision binding/)
    const first = prepared.collectTrustedImportMetadata('original')
    first.projection.operations.length = 0
    expect(prepared.collectTrustedImportMetadata('original')).toEqual(expected)
    projection.slides[0].elements[0]._pptxImportMeta.sourceCrop = 'forged'
    expect(() => metadata.collectTrustedImportMetadata(projection, 'original')).toThrow(/trusted import metadata/)
  })

  it('retains raw snapshot limits and rejects malformed semantic data at preparation', () => {
    const projection = chartProjectionFixture()
    expect(() => metadata.prepareTrustedImportProjection(projection, { maxElements: 0 })).toThrow(/elements/)
    projection.pptxSemantic.instances.i2.definitionId = 'missing'
    expect(() => metadata.prepareTrustedImportProjection(projection)).toThrow()
  })

  it('prepares a real OPC package with one canonical snapshot and unchanged metadata', async () => {
    const projection = chartProjectionFixture()
    const expected = metadata.collectTrustedImportMetadata(projection, 'original')
    const sourceMap = await buildImportSourceMap(projection, null, null)
    const zip = new JSZip()
    zip.file('[Content_Types].xml', '<Types/>')
    zip.file('ppt/presentation.xml', '<p:presentation/>')
    const source = await zip.generateAsync({ type: 'nodebuffer' })
    const blob = { sha256: 'a'.repeat(64) }
    // Preparation's storage seam is incidental; inventory/source-map/snapshot validation are real.
    const store = { stageBlob: async () => blob, blobs: { commit: async () => blob } }
    canonicalization.mockClear()
    const prepared = await prepareImport(store, source, {
      jobId: 'operation-scope', presentationId: projection.id, projection, sourceMap,
    })
    expect(canonicalization).toHaveBeenCalledTimes(1)
    expect(prepared.authority.projection).toEqual(snapshots.canonicalEditableSnapshot(projection))
    expect(prepared.authority.trustedImportMetadata).toEqual({
      ...expected, originalRevisionId: prepared.revision.id,
    })
  })
})

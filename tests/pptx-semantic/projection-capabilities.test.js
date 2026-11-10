import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import JSZip from 'jszip'
import { chartProjectionFixture, valuesOperation } from './projection-capabilities-fixture'

const require = createRequire(import.meta.url)
const capabilities = () => require('../../shared/src/pptx-projection-capabilities.js')
const operations = () => require('../../shared/src/pptx-projection-operation.js')
const runtime = require('../../server/services/pptx-import/package-store-runtime')
const { buildImportSourceMap } = require('../../server/services/pptx-import/source-map')
const { savePackageProjection } = require('../../server/services/generation-safe-save')
const {
  resolveEditorProjectionContext,
} = require('../../server/services/pptx-import/package-authority-snapshot')
const { executeValidatedEditedExport } = require('../../server/services/validated-edited-export')
const {
  CANONICAL_FEATURE_MATRIX,
} = require('../../server/services/pptx-import/canonical-feature-matrix')
const { updatePresentationSchema } = require('../../server/middleware/schemas')

describe('projection operation domain independent of native package qualification', () => {
  it('rejects unbound derived chart changes at actual save admission', () => {
    const deck = chartProjectionFixture()
    deck.slides[0].elements[0].chartData.datasets[0].data[0] = 999
    expect(updatePresentationSchema.safeParse(deck).success).toBe(false)
    const changedType = chartProjectionFixture()
    changedType.slides[0].elements[0].chartType = 'pie'
    expect(updatePresentationSchema.safeParse(changedType).success).toBe(false)
    const valid = operations().applyPresentationProjectionOperation(
      chartProjectionFixture(),
      valuesOperation()
    )
    expect(updatePresentationSchema.safeParse(valid).success).toBe(true)
  })
  it('updates only the exact selected series occurrence and derives compatibility atomically', () => {
    const before = chartProjectionFixture()
    const after = operations().applyPresentationProjectionOperation(before, valuesOperation())
    expect(after.pptxSemantic.instances.i1.overrides.components['series-17']).toEqual({
      values: [11, 22],
    })
    expect(after.slides[0].elements[0].chartData.datasets[0].data).toEqual([11, 22])
    expect(after.slides[1]).toEqual(before.slides[1])
    expect(after.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    expect(before.pptxSemantic.instances.i1.overrides).toEqual({})
    expect(Object.isFrozen(after.pptxSemantic.definitions['chart-definition'])).toBe(true)
    expect(capabilities().getProjectionCapabilities(after.pptxSemantic, 'i1').operations).toEqual([
      'chart.series.set-values',
    ])
  })

  it.each([
    ['name', { componentId: 'Revenue' }],
    ['index', { componentId: '0' }],
    ['wrong instance', { instanceId: 'missing' }],
    ['unknown op', { type: 'chart.add-series' }],
    ['string', { values: ['11', 22] }],
    ['length', { values: [11] }],
    ['nonfinite', { values: [Infinity, 22] }],
    ['all occurrences', { scope: 'definition' }],
    ['authority', { editable: true }],
    ['native flag', { transactionEligible: true }],
  ])('rejects %s without any partial mutation', (_label, patch) => {
    const before = chartProjectionFixture(),
      bytes = JSON.stringify(before)
    expect(() =>
      operations().applyPresentationProjectionOperation(before, { ...valuesOperation(), ...patch })
    ).toThrow()
    expect(JSON.stringify(before)).toBe(bytes)
  })

  it.each(['inventory', 'formula', 'foreign locator', 'tombstone', 'paint-only', 'locked'])(
    'does not grant operation permission for %s',
    (failure) => {
      const deck = chartProjectionFixture()
      const definition = deck.pptxSemantic.definitions['chart-definition']
      if (failure === 'inventory') definition.components[0].kind = 'property'
      if (failure === 'formula') definition.content.chartProjection.dataMode = 'formula'
      if (failure === 'foreign locator')
        definition.components[0].locator.preconditionHash = 'b'.repeat(64)
      if (failure === 'tombstone') deck.pptxSemantic.instances.i1.lineage = { tombstone: true }
      if (failure === 'paint-only') deck.pptxSemantic.instances.i1.lineage = { paintOnly: true }
      if (failure === 'locked') deck.slides[0].locked = true
      expect(() =>
        operations().applyPresentationProjectionOperation(deck, valuesOperation())
      ).toThrow()
    }
  )

  it('rejects independently changed derived chart data and malformed canonical overrides', () => {
    const deck = chartProjectionFixture()
    deck.slides[0].elements[0].chartData.datasets[0].data[0] = 999
    expect(() =>
      capabilities().assertProjectionChartBinding(deck.pptxSemantic, deck.slides[0].elements[0])
    ).toThrow()
    deck.pptxSemantic.instances.i1.overrides.components = { 'series-17': { values: ['bad', 20] } }
    expect(() => capabilities().projectChartData(deck.pptxSemantic, 'i1')).toThrow()
  })

  it('persists and reopens a real chart projection save while the actual native export gate rejects it', async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'task10-capabilities-'))
    const before = chartProjectionFixture()
    const nativeBefore = JSON.stringify(CANONICAL_FEATURE_MATRIX)
    try {
      const store = await runtime.initializePackageStore({ rootDir })
      const zip = new JSZip()
      zip.file('[Content_Types].xml', '<Types/>')
      zip.file('ppt/presentation.xml', '<p:presentation/>')
      const original = await zip.generateAsync({ type: 'nodebuffer' })
      const prepared = await store.prepareImport(original, {
        jobId: 'task10-import',
        presentationId: before.id,
        projection: before,
        sourceMap: await buildImportSourceMap(before, null, null),
      })
      const imported = await store.publishImport(prepared)
      const after = operations().applyPresentationProjectionOperation(before, valuesOperation())
      const saved = await savePackageProjection({
        presentationId: before.id,
        expectedGeneration: 1,
        idempotencyKey: 'task10-values',
        after,
        loadStored: async () => before,
      })
      expect(saved).toMatchObject({ ok: true, generation: 2 })
      await runtime.shutdownPackageStore()
      const reopened = await runtime.initializePackageStore({ rootDir })
      const context = resolveEditorProjectionContext(reopened.getState(), before.id)
      expect(context.ok).toBe(true)
      expect(context.after.pptxSemantic).toEqual(after.pptxSemantic)
      expect(context.after.slides[0].elements[0].chartData.datasets[0].data).toEqual([11, 22])
      expect(context.after.slides[1]).toEqual(saved.projection.slides[1])
      const refused = await executeValidatedEditedExport(
        {
          presentationId: before.id,
          expectedGeneration: 2,
          idempotencyKey: 'task10-native-export',
        },
        { store: reopened }
      )
      expect(refused).toMatchObject({
        ok: false,
        status: 422,
        blockReason: 'CANONICAL_TEXT_JOURNAL_INVALID',
      })
      expect(await reopened.readOriginal(imported.head.originalRevisionId)).toEqual(original)
      expect(JSON.stringify(CANONICAL_FEATURE_MATRIX)).toBe(nativeBefore)
    } finally {
      await runtime.shutdownPackageStore()
      await fs.rm(rootDir, { recursive: true, force: true })
    }
  })
})

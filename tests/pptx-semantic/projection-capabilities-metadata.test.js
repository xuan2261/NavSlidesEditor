import { beforeAll, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { chartProjectionFixture } from './projection-capabilities-fixture'
import { geometryGroupFillFixture } from './geometry-group-fill-fixture'
import { familyDocumentsFixture } from './family-documents-fixture'
import { geometryProjectionFixture } from './geometry-projection-fixture'
import { geometryStyleFixture } from './geometry-style-fixture'
const require = createRequire(import.meta.url)
const {
  collectTrustedImportMetadata,
  validateTrustedImportMetadata,
} = require('../../server/services/pptx-import/trusted-import-metadata')
const { toPresentationEditorDto } = require('../../server/services/pptx-import/package-store/dto')
const { getProjectionCapabilities } = require('../../shared/src/pptx-projection-capabilities')
let familyDocuments
beforeAll(async () => {
  familyDocuments = await familyDocumentsFixture()
})

describe('server-owned imported projection operation profile', () => {
  it('persists a source-bound geometry and inheritance domain under the Original binding', () => {
    const deck = geometryProjectionFixture()
    deck.pptxSemantic = geometryStyleFixture()
    const before = structuredClone(deck)
    const sidecar = collectTrustedImportMetadata(deck, 'original-revision')
    expect(sidecar.projection.operations).toEqual([
      { instanceId: 'i1', operations: ['geometry.edit', 'inheritance.edit'] },
      { instanceId: 'i2', operations: ['geometry.edit', 'inheritance.edit'] },
    ])
    expect(validateTrustedImportMetadata(JSON.parse(JSON.stringify(sidecar)), 'original-revision')).toEqual(sidecar)
    expect(deck).toEqual(before)
    for (const operations of [
      ['geometry.edit', 'geometry.edit'],
      ['inheritance.edit', 'geometry.edit'],
      ['group.fill.edit', 'inheritance.edit'],
      ['geometry.edit', 'native.export-qualified'],
    ]) {
      const forged = structuredClone(sidecar)
      forged.projection.operations[0].operations = operations
      expect(() => validateTrustedImportMetadata(forged, 'original-revision')).toThrow(/projection operation domain/)
    }
  })
  it.each(['group', 'table', 'chart', 'diagram', 'equation'])(
    'retains the exact source-derived %s domain without granting native authority',
    (kind) => {
      const deck =
        kind === 'group'
          ? geometryGroupFillFixture()
          : {
              pptxSemantic: familyDocuments[kind],
              slides: [
                {
                  id: 's1',
                  elements: [
                    {
                      id: 'element',
                      pptxInstanceId: 'occurrence',
                      type: kind === 'equation' ? 'latex' : kind,
                    },
                  ],
                },
              ],
            }
      const before = JSON.stringify(deck)
      const expected = Object.values(deck.pptxSemantic.instances).flatMap((instance) => {
        const operations = getProjectionCapabilities(deck.pptxSemantic, instance.id).operations
        return operations.length ? [{ instanceId: instance.id, operations }] : []
      })
      expect(expected.length).toBeGreaterThan(0)
      const sidecar = collectTrustedImportMetadata(deck, 'original-revision')
      expect(sidecar.projection).toMatchObject({
        schemaVersion: deck.pptxSemantic.schemaVersion,
        modelVersion: deck.pptxSemantic.schemaVersion,
        operations: expected,
      })
      expect(
        sidecar.projection[
          deck.pptxSemantic.schemaVersion === 2 ? 'immutableSourceHash' : 'definitionsHash'
        ]
      ).toMatch(/^[a-f0-9]{64}$/)
      expect(sidecar.projection).not.toHaveProperty('transactionEligible')
      expect(
        validateTrustedImportMetadata(JSON.parse(JSON.stringify(sidecar)), 'original-revision')
      ).toEqual(sidecar)
      expect(JSON.stringify(deck)).toBe(before)
    }
  )
  it.each(['duplicate', 'multiple', 'unknown', 'legacy', 'accessor'])(
    'rejects a forged %s typed operation domain without invoking accessors',
    (kind) => {
      const sidecar = collectTrustedImportMetadata(geometryGroupFillFixture(), 'original-revision')
      const domain = sidecar.projection.operations.find((entry) => entry.instanceId === 'g1')
      let called = false
      if (kind === 'duplicate') sidecar.projection.operations.push(structuredClone(domain))
      if (kind === 'multiple') domain.operations.push('geometry.edit')
      if (kind === 'unknown') domain.operations[0] = 'native.export-qualified'
      if (kind === 'legacy') {
        sidecar.projection = {
          schemaVersion: 1,
          modelVersion: 1,
          definitionsHash: 'a'.repeat(64),
          operations: [domain],
        }
      }
      if (kind === 'accessor')
        Object.defineProperty(domain.operations, '0', {
          enumerable: true,
          get() {
            called = true
            return 'group.fill.edit'
          },
        })
      expect(() => validateTrustedImportMetadata(sidecar, 'original-revision')).toThrow()
      expect(called).toBe(false)
    }
  )
  it('captures the model and operation domain under the Original binding without native eligibility', () => {
    const deck = chartProjectionFixture()
    const metadata = collectTrustedImportMetadata(deck, 'original-revision')
    expect(metadata?.projection).toMatchObject({
      schemaVersion: 1,
      modelVersion: 1,
      operations: [
        { instanceId: 'i1', operations: ['chart.series.set-values'] },
        { instanceId: 'i2', operations: ['chart.series.set-values'] },
      ],
    })
    expect(metadata.projection.definitionsHash).toMatch(/^[a-f0-9]{64}$/)
    expect(metadata.originalRevisionId).toBe('original-revision')
    expect(metadata.projection).not.toHaveProperty('transactionEligible')
    Object.assign(deck.slides[0].elements[0]._pptxChartMeta, {
      editable: true,
      adapterQualified: true,
      transactionEligible: true,
      level4Promoted: true,
    })
    expect(collectTrustedImportMetadata(deck, 'original-revision').projection).toEqual(
      metadata.projection
    )
    expect(
      toPresentationEditorDto({ ...deck, trustedImportMetadata: metadata })
    ).not.toHaveProperty('trustedImportMetadata')
  })
  it('validates profile version, Original binding and allowed operation claims', () => {
    const metadata = collectTrustedImportMetadata(chartProjectionFixture(), 'original-revision')
    expect(metadata).toBeDefined()
    expect(() => validateTrustedImportMetadata(metadata, 'different-original')).toThrow()
    for (const patch of [
      { modelVersion: 99 },
      { definitionsHash: 'not-a-hash' },
      { transactionEligible: true },
      { operations: [{ instanceId: 'i1', operations: ['native.export-qualified'] }] },
    ]) {
      expect(() =>
        validateTrustedImportMetadata(
          {
            ...metadata,
            projection: { ...metadata.projection, ...patch },
          },
          'original-revision'
        )
      ).toThrow()
    }
  })
})

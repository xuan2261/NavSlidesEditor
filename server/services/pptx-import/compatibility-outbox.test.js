const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { openPackageStore } = require('./package-store')
const {
  acknowledgeCompatibilityOutbox,
  drainCompatibilityOutbox,
  queueCompatibilityRemoval,
  queueCompatibilityUpsert,
  snapshotCompatibilityOutbox,
} = require('./compatibility-outbox')
const { applyCompatibilityWrites } = require('./compatibility-view')

const roots = []

async function createStore() {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'navslides-compatibility-outbox-'))
  roots.push(rootDir)
  const store = await openPackageStore({ rootDir })
  await store.acquireWriter()
  return store
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

describe('package compatibility outbox', () => {
  it('keeps an unacknowledged write durable when applying it fails', async () => {
    const store = await createStore()
    await store.mutate((next) => {
      queueCompatibilityUpsert(next, {
        presentationId: 'deck-1',
        generation: 2,
        presentation: { id: 'deck-1', title: 'Updated', slides: [] },
      })
    })

    await expect(drainCompatibilityOutbox(store, async () => {
      throw new Error('injected compatibility persistence failure')
    })).rejects.toThrow('injected compatibility persistence failure')

    expect(store.getState().compatibilityOutbox).toEqual([
      expect.objectContaining({
        operation: 'upsert',
        presentationId: 'deck-1',
        generation: 2,
      }),
    ])
    await store.releaseWriter()
  })

  it('acknowledges only writes successfully applied to the compatibility view', async () => {
    const store = await createStore()
    await store.mutate((next) => {
      queueCompatibilityUpsert(next, {
        presentationId: 'deck-1',
        generation: 2,
        presentation: { id: 'deck-1', title: 'Updated', slides: [] },
      })
      queueCompatibilityRemoval(next, {
        presentationId: 'deck-2',
        generation: 3,
      })
    })
    const applied = []

    await expect(drainCompatibilityOutbox(store, async (writes) => {
      applied.push(...writes)
    })).resolves.toBe(2)

    expect(applied).toHaveLength(2)
    expect(store.getState().compatibilityOutbox).toEqual([])
    await store.releaseWriter()
  })

  it('acknowledges only the writes included in the applied snapshot', async () => {
    const store = await createStore()
    await store.mutate((next) => {
      queueCompatibilityUpsert(next, {
        presentationId: 'deck-1',
        generation: 2,
        presentation: { id: 'deck-1', title: 'Updated', slides: [] },
      })
    })
    const appliedWrites = snapshotCompatibilityOutbox(store)
    await store.mutate((next) => {
      queueCompatibilityRemoval(next, {
        presentationId: 'deck-2',
        generation: 3,
      })
    })

    await acknowledgeCompatibilityOutbox(store, appliedWrites)

    expect(store.getState().compatibilityOutbox).toEqual([
      expect.objectContaining({ operation: 'remove', presentationId: 'deck-2' }),
    ])
    await store.releaseWriter()
  })

  it('preserves server-owned metadata when applying a canonical package projection', () => {
    const presentations = [{
      id: 'deck-1',
      title: 'Before',
      slides: [{
        id: 'slide-1',
        elements: [{
          id: 'element-1',
          type: 'text',
          content: '<p>Before</p>',
          _pptxImportMeta: { inset: { left: 4, right: 8 } },
          _pptxChartMeta: { preservationTier: 'preserve-only' },
          _pptxSource: { partUri: 'ppt/slides/slide1.xml' },
          _pptxDiagram: { unsupported: true },
        }],
      }],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      deletedAt: '2026-01-03T00:00:00.000Z',
      pptxOriginal: { id: 'original-1', sha256: 'a'.repeat(64) },
      _pptxMeta: { originalSize: { width: 720, height: 540 } },
      _pptxImportReport: {
        schemaVersion: 1,
        jobId: 'job-import-1',
        summary: { warningCount: 1, byType: { 'media-missing': 1 }, omittedCount: 0 },
        diagnostics: [{ type: 'media-missing', message: 'gone' }],
      },
      pptxAggregateHead: { generation: 2 },
    }]

    applyCompatibilityWrites(presentations, [{
      operation: 'upsert',
      presentationId: 'deck-1',
      generation: 3,
      updatedAt: '2026-01-04T00:00:00.000Z',
      presentation: {
        id: 'deck-1',
        title: 'After',
        slides: [{
          id: 'slide-1',
          elements: [{
            id: 'element-1',
            type: 'text',
            content: '<p>After</p>',
          }],
        }],
        _pptxImportReport: {
          schemaVersion: 1,
          jobId: 'client-forged',
          summary: { warningCount: 999, byType: { flood: 999 }, omittedCount: 0 },
          diagnostics: [],
        },
        pptxAggregateHead: { generation: 3 },
      },
    }])

    expect(presentations[0]).toMatchObject({
      title: 'After',
      slides: [{
        id: 'slide-1',
        elements: [{
          id: 'element-1',
          content: '<p>After</p>',
          _pptxImportMeta: { inset: { left: 4, right: 8 } },
          _pptxChartMeta: { preservationTier: 'preserve-only' },
        }],
      }],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-04T00:00:00.000Z',
      deletedAt: '2026-01-03T00:00:00.000Z',
      pptxOriginal: { id: 'original-1', sha256: 'a'.repeat(64) },
      _pptxMeta: { originalSize: { width: 720, height: 540 } },
      _pptxImportReport: {
        schemaVersion: 1,
        jobId: 'job-import-1',
        summary: { warningCount: 1, byType: { 'media-missing': 1 }, omittedCount: 0 },
      },
      pptxAggregateHead: { generation: 3 },
    })
    expect(presentations[0].slides[0].elements[0]).not.toHaveProperty('_pptxSource')
    expect(presentations[0].slides[0].elements[0]).not.toHaveProperty('_pptxDiagram')
  })

  it('ignores compatibility writes older than the stored package generation', () => {
    const presentations = [{
      id: 'deck-1',
      title: 'Generation 4',
      slides: [],
      pptxAggregateHead: { generation: 4 },
    }]

    applyCompatibilityWrites(presentations, [{
      operation: 'upsert',
      presentationId: 'deck-1',
      generation: 3,
      presentation: {
        id: 'deck-1',
        title: 'Generation 3',
        slides: [],
        pptxAggregateHead: { generation: 3 },
      },
    }])

    expect(presentations[0].title).toBe('Generation 4')
  })
})

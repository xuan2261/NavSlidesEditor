// @vitest-environment node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import JSZip from 'jszip'
import { createRequire } from 'node:module'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { hashRecord } = await import('./pptx-import/package-store/schemas.js')

const dataDir = path.join(
  os.tmpdir(),
  `navslides-package-authority-reader-${process.pid}-${Date.now()}`
)
process.env.SLIDES_DATA_DIR = dataDir

const storage = await import('./storage.js')
const { openPackageStore } = await import('./pptx-import/package-store/index.js')
const { PackageStore } = createRequire(import.meta.url)('./pptx-import/package-store/index.js')
const { readAuthoritativePresentation } = await import('./package-backed-presentation-read.js')

async function withStore(action) {
  const store = await openPackageStore({ rootDir: storage.DATA_DIR })
  await store.acquireWriter()
  try {
    return await action(store)
  } finally {
    await store.releaseWriter()
  }
}

async function seedOriginal({ mutateHead } = {}) {
  await storage.writePresentations([
    {
      id: 'deck-reader',
      title: 'Compatibility title',
      slides: [{ id: 's1', elements: [] }],
    },
  ])
  await withStore(async (store) => {
    await store.commitOriginal(Buffer.from('reader-package'), {
      ownerType: 'presentation',
      ownerId: 'deck-reader',
    })
    if (mutateHead) await store.mutate(mutateHead)
    const head = store.getState().heads.find((item) => item.presentationId === 'deck-reader')
    await storage.withPresentations((presentations) => {
      presentations[0].pptxAggregateHead = head
    })
  })
}

async function seedProjectedImport(extra = {}) {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types />')
  zip.file('ppt/presentation.xml', '<p:presentation />')
  const bytes = await zip.generateAsync({ type: 'nodebuffer' })
  const projection = { id: 'deck-reader', title: 'Canonical import', slides: [], ...extra }
  const sourceMap = {
    entries: Object.fromEntries(
      (projection.slides || []).flatMap((slide) =>
        (slide.elements || []).map((element) => [
          `${slide.id}:${element.id}`,
          {
            status: 'missing',
            kind: element.type,
            partUri: 'unknown',
            sourceHash: 'a'.repeat(64),
            relationshipChain: [],
            groupAncestry: [],
            occurrencePath: [],
          },
        ])
      )
    ),
  }
  return withStore(async (store) => {
    const result = await store.commitImport(bytes, {
      jobId: 'reader-projection-job',
      presentationId: projection.id,
      projection,
      sourceMap,
      compatibilityPresentation: projection,
    })
    const { applyCompatibilityWrites } = await import('./pptx-import/compatibility-view.js')
    await storage.withPresentations((rows) => {
      applyCompatibilityWrites(rows, store.getState().compatibilityOutbox)
    })
    return { bytes, head: result.head }
  })
}

describe('package-backed presentation reader authority boundary', () => {
  it('uses one real defensive store snapshot across single and bulk read authority checks', async () => {
    await seedProjectedImport()
    const stored = await storage.readPresentations()
    const snapshot = vi.spyOn(PackageStore.prototype, 'getState')
    try {
      const resolved = await readAuthoritativePresentation('deck-reader', { normalize: false })
      expect(resolved.presentation.title).toBe('Canonical import')
      expect(snapshot).toHaveBeenCalledTimes(1)
      snapshot.mockClear()
      const { readAuthoritativePresentations } =
        await import('./package-backed-presentation-read.js')
      expect(await readAuthoritativePresentations(stored, { normalize: false })).toEqual([resolved])
      expect(snapshot).toHaveBeenCalledTimes(1)
    } finally {
      snapshot.mockRestore()
    }
  })

  beforeEach(async () => {
    await fs.rm(dataDir, { recursive: true, force: true })
    await fs.mkdir(dataDir, { recursive: true })
    storage.initDataFiles()
  })

  afterEach(async () => {
    await fs.rm(dataDir, { recursive: true, force: true })
  })

  it.each([undefined, 'native-aspect-v1', 'native-aspect-v2'])(
    'normalizes final package geometry only for legacy policies: %s',
    async (geometryPolicy) => {
      const metadata = {
        originalSize: { width: 960, height: 720 },
        ...(geometryPolicy === undefined ? {} : { geometryPolicy }),
      }
      const { bytes, head } = await seedProjectedImport({
        resolution: { width: 720, height: 540 },
        _pptxMeta: metadata,
        slides: [
          {
            id: 's1',
            elements: [{ id: 'e1', type: 'shape', x: 360, y: 270, width: 72, height: 72 }],
          },
        ],
      })
      // The matching head remains authoritative even when its compatibility geometry is stale.
      await storage.withPresentations((rows) => {
        rows[0].resolution = { width: 960, height: 540 }
        rows[0]._pptxMeta = { originalSize: { width: 720, height: 540 }, usedFonts: ['Calibri'] }
      })
      const stored = await storage.readPresentations()
      const stateBefore = await withStore((store) => store.getState())
      const expectedMetadata = {
        originalSize:
          geometryPolicy === 'native-aspect-v1'
            ? { width: 960, height: 720 }
            : { width: 720, height: 540 },
        ...(geometryPolicy === 'native-aspect-v1' ? { geometryPolicy } : {}),
        usedFonts: ['Calibri'],
      }
      const resolved = await readAuthoritativePresentation('deck-reader')
      expect(resolved.presentation.resolution).toEqual({
        width: geometryPolicy === 'native-aspect-v1' ? 720 : 960,
        height: 540,
      })
      expect(resolved.presentation._pptxMeta).toEqual(expectedMetadata)
      expect(resolved.presentation.slides[0].elements[0]).toMatchObject({
        x: 360,
        y: 270,
        width: 72,
        height: 72,
      })
      expect(resolved.generation).toBe(head.generation)
      const raw = await readAuthoritativePresentation('deck-reader', { normalize: false })
      expect(raw.presentation.resolution).toEqual({ width: 720, height: 540 })
      const { readAuthoritativePresentations } =
        await import('./package-backed-presentation-read.js')
      expect(await readAuthoritativePresentations(stored)).toEqual([resolved])
      expect(await storage.readPresentations()).toEqual(stored)
      await withStore(async (store) => {
        expect(store.getState()).toEqual(stateBefore)
        expect(await store.readOriginal(head.originalRevisionId)).toEqual(bytes)
      })
    }
  )

  it('does not grant package authority from the native geometry marker', async () => {
    await seedProjectedImport({
      resolution: { width: 720, height: 540 },
      _pptxMeta: {
        originalSize: { width: 960, height: 720 },
        geometryPolicy: 'native-aspect-v1',
      },
    })
    await storage.withPresentations((rows) => {
      delete rows[0].pptxAggregateHead
    })
    await expect(readAuthoritativePresentation('deck-reader')).rejects.toMatchObject({
      code: 'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE',
      status: 422,
    })
  })
  it('fails closed when compatibility claims a package head that is absent from the store', async () => {
    await storage.writePresentations([
      {
        id: 'missing-head',
        title: 'Stale compatibility',
        slides: [],
        pptxAggregateHead: {
          presentationId: 'missing-head',
          packageRevisionId: 'r0-missing',
          generation: 1,
        },
      },
    ])

    await expect(readAuthoritativePresentation('missing-head')).rejects.toMatchObject({
      code: 'PRESENTATION_PACKAGE_HEAD_MISSING',
      status: 422,
    })
  })

  it('recovers immutable original authority when the successor revision is missing', async () => {
    await seedOriginal({
      mutateHead: (next) => {
        const head = next.heads[0]
        next.revisions = next.revisions.filter(
          (revision) => revision.id === head.originalRevisionId
        )
        next.heads[0].packageRevisionId = 'missing-successor'
        next.heads[0].projectionRevisionId = null
        next.heads[0].sourceMapRevisionId = null
        next.heads[0].journalRevisionId = null
      },
    })

    const resolved = await readAuthoritativePresentation('deck-reader', {
      normalize: false,
      allowIncompleteAuthority: true,
    })
    expect(resolved.generation).toBe(1)
    expect(resolved.presentation.pptxAggregateHead.packageRevisionId).toBe('missing-successor')
    expect(resolved.presentation.title).toBe('Compatibility title')
  })

  it('does not use compatibility fallback for an original-only head with a stale journal pointer', async () => {
    await seedOriginal({
      mutateHead: (next) => {
        next.heads[0].journalRevisionId = 'a'.repeat(64)
      },
    })

    await expect(readAuthoritativePresentation('deck-reader')).rejects.toMatchObject({
      code: 'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE',
      status: 422,
    })
  })

  it('requires the original revision to exist and remain presentation-owned', async () => {
    await seedOriginal({
      mutateHead: (next) => {
        const head = next.heads[0]
        next.owners = next.owners.filter(
          (owner) =>
            owner.revisionId !== head.originalRevisionId || owner.ownerType !== 'presentation'
        )
      },
    })

    await expect(readAuthoritativePresentation('deck-reader')).rejects.toMatchObject({
      code: 'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE',
      status: 422,
    })
  })

  it('does not downgrade when projected mutation authority exists behind null head pointers', async () => {
    await seedOriginal({
      mutateHead: (next) => {
        const head = next.heads[0]
        next.mutationResults.push({
          schemaVersion: 1,
          presentationId: head.presentationId,
          packageRevisionId: head.packageRevisionId,
          idempotencyKey: 'malformed-projection',
          state: 'committed',
          projection: { id: head.presentationId, slides: [] },
          sourceMap: {
            presentationId: head.presentationId,
            revisionId: head.packageRevisionId,
            packageGeneration: head.generation,
            entries: {},
          },
        })
      },
    })

    await expect(readAuthoritativePresentation('deck-reader')).rejects.toMatchObject({
      code: 'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE',
      status: 422,
    })
  })

  it('fails closed when a projected package revision is no longer presentation-owned', async () => {
    await seedOriginal({
      mutateHead: (next) => {
        const head = next.heads[0]
        const projection = { id: head.presentationId, slides: [] }
        const sourceMap = {
          presentationId: head.presentationId,
          revisionId: head.packageRevisionId,
          packageGeneration: head.generation,
          entries: {},
        }
        head.projectionRevisionId = hashRecord(projection)
        head.sourceMapRevisionId = hashRecord(sourceMap)
        next.mutationResults.push({
          schemaVersion: 1,
          operation: 'package-import',
          presentationId: head.presentationId,
          packageRevisionId: head.packageRevisionId,
          idempotencyKey: 'projected-without-owner',
          generation: head.generation,
          state: 'committed',
          projection,
          sourceMap,
        })
        next.owners = next.owners.filter(
          (owner) =>
            !(
              owner.ownerType === 'presentation' &&
              owner.ownerId === head.presentationId &&
              owner.revisionId === head.packageRevisionId
            )
        )
      },
    })

    await expect(readAuthoritativePresentation('deck-reader')).rejects.toMatchObject({
      code: 'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE',
      status: 422,
    })
  })

  it('isolates a missing-head row in bulk reads so healthy rows remain available', async () => {
    const { readAuthoritativePresentations } = await import('./package-backed-presentation-read.js')
    await storage.writePresentations([
      {
        id: 'healthy-plain',
        title: 'Healthy',
        slides: [{ id: 's1', elements: [] }],
      },
      {
        id: 'ghost-missing-head',
        title: 'Ghost',
        slides: [],
        pptxAggregateHead: {
          presentationId: 'ghost-missing-head',
          packageRevisionId: 'r0-missing',
          generation: 1,
        },
      },
    ])

    const quarantine = []
    const resolved = await readAuthoritativePresentations(await storage.readPresentations(), {
      collectQuarantine: quarantine,
    })
    expect(resolved.map((item) => item.presentation.id)).toEqual(['healthy-plain'])
    expect(quarantine).toEqual([
      expect.objectContaining({
        id: 'ghost-missing-head',
        code: 'PRESENTATION_PACKAGE_HEAD_MISSING',
        status: 422,
      }),
    ])
  })

  it('keeps single-read fail-closed when package head is missing', async () => {
    await storage.writePresentations([
      {
        id: 'missing-head-single',
        title: 'Stale',
        slides: [],
        pptxAggregateHead: {
          presentationId: 'missing-head-single',
          packageRevisionId: 'r0-missing',
          generation: 1,
        },
      },
    ])
    await expect(readAuthoritativePresentation('missing-head-single')).rejects.toMatchObject({
      code: 'PRESENTATION_PACKAGE_HEAD_MISSING',
      status: 422,
    })
  })
  it.each(['missing-head', 'wrong-generation', 'same-generation-wrong-hash'])(
    'P07-14: rejects a persisted %s before canonical authority can mask it',
    async (mismatch) => {
      const { head, bytes } = await seedProjectedImport()
      await storage.withPresentations((rows) => {
        if (mismatch === 'missing-head') delete rows[0].pptxAggregateHead
        else if (mismatch === 'wrong-generation') rows[0].pptxAggregateHead.generation += 1
        else rows[0].pptxAggregateHead.sourceMapRevisionId = '0'.repeat(64)
      })
      const raw = (await storage.readPresentations())[0]
      expect(raw.pptxAggregateHead).not.toEqual(head)

      await expect(
        readAuthoritativePresentation('deck-reader', { normalize: false })
      ).rejects.toMatchObject({ code: 'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE', status: 422 })
      const { readAuthoritativePresentations } =
        await import('./package-backed-presentation-read.js')
      const quarantine = []
      const listed = await readAuthoritativePresentations(
        [raw, { id: 'healthy-plain', title: 'Healthy', slides: [] }],
        { normalize: false, collectQuarantine: quarantine }
      )
      expect(listed.map(({ presentation }) => presentation.id)).toEqual(['healthy-plain'])
      expect(quarantine).toEqual([
        expect.objectContaining({
          id: 'deck-reader',
          code: 'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE',
        }),
      ])
      expect((await storage.readPresentations())[0]).toEqual(raw)
      await withStore(async (store) => {
        expect(await store.readOriginal(head.originalRevisionId)).toEqual(bytes)
      })
    }
  )

  it('P07-12: exposes an exactly projected import through both list and direct readers', async () => {
    const { head } = await seedProjectedImport()
    const { readAuthoritativePresentations } = await import('./package-backed-presentation-read.js')
    const opened = await readAuthoritativePresentation('deck-reader', { normalize: false })
    const listed = await readAuthoritativePresentations(await storage.readPresentations(), {
      normalize: false,
    })
    expect(opened.presentation).toMatchObject({
      title: 'Canonical import',
      pptxAggregateHead: head,
    })
    expect(listed).toEqual([opened])
  })
})

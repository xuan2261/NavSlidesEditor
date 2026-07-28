// @vitest-environment node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const { hashRecord } = await import('./pptx-import/package-store/schemas.js')

const dataDir = path.join(
  os.tmpdir(),
  `navslides-package-authority-reader-${process.pid}-${Date.now()}`
)
process.env.SLIDES_DATA_DIR = dataDir

const storage = await import('./storage.js')
const { openPackageStore } = await import('./pptx-import/package-store/index.js')
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
  await storage.writePresentations([{
    id: 'deck-reader',
    title: 'Compatibility title',
    slides: [{ id: 's1', elements: [] }],
  }])
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

describe('package-backed presentation reader authority boundary', () => {
  beforeEach(async () => {
    await fs.rm(dataDir, { recursive: true, force: true })
    await fs.mkdir(dataDir, { recursive: true })
    storage.initDataFiles()
  })

  afterEach(async () => {
    await fs.rm(dataDir, { recursive: true, force: true })
  })

  it('fails closed when compatibility claims a package head that is absent from the store', async () => {
    await storage.writePresentations([{
      id: 'missing-head',
      title: 'Stale compatibility',
      slides: [],
      pptxAggregateHead: {
        presentationId: 'missing-head',
        packageRevisionId: 'r0-missing',
        generation: 1,
      },
    }])

    await expect(readAuthoritativePresentation('missing-head'))
      .rejects.toMatchObject({
        code: 'PRESENTATION_PACKAGE_HEAD_MISSING',
        status: 422,
      })
  })

  it('recovers immutable original authority when the successor revision is missing', async () => {
    await seedOriginal({
      mutateHead: (next) => {
        const head = next.heads[0]
        next.revisions = next.revisions.filter((revision) => revision.id === head.originalRevisionId)
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

    await expect(readAuthoritativePresentation('deck-reader'))
      .rejects.toMatchObject({
        code: 'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE',
        status: 422,
      })
  })

  it('requires the original revision to exist and remain presentation-owned', async () => {
    await seedOriginal({
      mutateHead: (next) => {
        const head = next.heads[0]
        next.owners = next.owners.filter((owner) =>
          owner.revisionId !== head.originalRevisionId || owner.ownerType !== 'presentation'
        )
      },
    })

    await expect(readAuthoritativePresentation('deck-reader'))
      .rejects.toMatchObject({
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

    await expect(readAuthoritativePresentation('deck-reader'))
      .rejects.toMatchObject({
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
        next.owners = next.owners.filter((owner) =>
          !(owner.ownerType === 'presentation' &&
            owner.ownerId === head.presentationId &&
            owner.revisionId === head.packageRevisionId)
        )
      },
    })

    await expect(readAuthoritativePresentation('deck-reader'))
      .rejects.toMatchObject({
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
    await storage.writePresentations([{
      id: 'missing-head-single',
      title: 'Stale',
      slides: [],
      pptxAggregateHead: {
        presentationId: 'missing-head-single',
        packageRevisionId: 'r0-missing',
        generation: 1,
      },
    }])
    await expect(readAuthoritativePresentation('missing-head-single'))
      .rejects.toMatchObject({
        code: 'PRESENTATION_PACKAGE_HEAD_MISSING',
        status: 422,
      })
  })
})

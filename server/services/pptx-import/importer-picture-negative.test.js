// @vitest-environment node
// Actual parser-worker + source-semantic rejection, not task12 qualification.
// The importer exposes no request/spawn guard: these cases do not observe network
// requests or converter launches. No CJS internals or StateStore are mocked.
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import importer from './importer.js'
import mediaDedup from './media-dedup.js'
import fixture from './importer-picture-negative-fixture.js'

const { importPptxFile } = importer
const { createMediaTransaction } = mediaDedup
const { pictureNegativePackage, supportedPixels } = fixture
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

afterEach(() => vi.unstubAllEnvs())

describe('source-bound negative picture import acceptance', () => {
  it.each(['external', 'emf'])(
    'rejects %s pictures after staging supported media and rolls back atomically',
    async (kind) => {
      // Exercise the semantic gate, not an earlier legacy strict-mapper gate.
      // Conversion is explicitly disabled, independent of the developer's setup.
      vi.stubEnv('PPTX_SLA_STRICT', '0')
      vi.stubEnv('PPTX_SLA_STRICT_COUNT', '0')
      vi.stubEnv('PPTX_SLA_STRICT_NODES', '0')
      vi.stubEnv('PPTX_SLA_STRICT_PRIMITIVES', '0')
      vi.stubEnv('PPTX_EMF_CONVERT', '0')
      vi.stubEnv('PPTX_IMPORT_MEDIA_ORIGINS', '')
      const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-picture-negative-'))
      const uploadsDir = path.join(directory, 'uploads')
      const file = path.join(directory, `${kind}.pptx`)
      const hashScope = {}
      const transaction = createMediaTransaction({ hashScope })
      try {
        await fs.mkdir(uploadsDir)
        const source = await pictureNegativePackage(kind)
        const inputHash = sha256(source)
        await fs.writeFile(file, source)
        expect(await fs.readdir(uploadsDir)).toEqual([])
        expect(hashScope).toEqual({})
        const outcome = await importPptxFile(file, {
          originalName: `${kind}.pptx`,
          semanticImport: true,
          geometryInheritance: true,
          uploadsDir,
          mediaTransaction: transaction,
        }).then(
          (result) => ({ result }),
          (error) => ({ error })
        )

        expect(outcome.error).toMatchObject({
          name: 'PptxImportError',
          code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
          status: 422,
          sourceLocation: {
            partUri: 'ppt/slides/slide1.xml',
            definitionId: expect.any(String),
          },
        })
        // Any returned deck, even a placeholder/legacy deck or one carrying
        // trusted qualification, fails this acceptance boundary.
        expect(outcome).not.toHaveProperty('result')
        expect(outcome.error).not.toHaveProperty('presentation')
        expect(outcome.error).not.toHaveProperty('semanticAdmission')
        expect(outcome.error).not.toHaveProperty('trustedSemanticImportMetadata')
        expect(await fs.readFile(file)).toEqual(source)
        expect(sha256(await fs.readFile(file))).toBe(inputHash)

        // Observe actual bytes and their isolated hash record BEFORE rollback;
        // empty staging on an early failure cannot satisfy the cleanup contract.
        const staged = await fs.readdir(uploadsDir)
        expect(staged.length).toBeGreaterThan(0)
        const supportedHash = sha256(supportedPixels)
        const supportedEntry = hashScope['pptx-import']?.[supportedHash]
        expect(supportedEntry).toMatchObject({
          filename: expect.stringMatching(/\.png$/),
          size: supportedPixels.length,
          mimeType: 'image/png',
        })
        expect(staged).toContain(supportedEntry.filename)
        expect(await fs.readFile(path.join(uploadsDir, supportedEntry.filename)))
          .toEqual(supportedPixels)

        await transaction.rollback()
        expect(await fs.readdir(uploadsDir)).toEqual([])
        expect(hashScope).toEqual({})
        expect(await fs.readFile(file)).toEqual(source)
        expect(sha256(await fs.readFile(file))).toBe(inputHash)
      } finally {
        try {
          await transaction.rollback()
        } finally {
          await fs.rm(directory, { recursive: true, force: true })
        }
      }
    },
    30000
  )
})

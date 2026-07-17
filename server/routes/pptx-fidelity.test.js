import { beforeAll, describe, expect, it } from 'vitest'
import crypto from 'node:crypto'
import express from 'express'
import request from 'supertest'
import matrixModule from '../services/pptx-import/canonical-feature-matrix.js'
import * as storage from '../services/storage.js'
import presentationsRouter from './presentations.js'

const {
  CANONICAL_FEATURE_MATRIX_ENVELOPE,
  CANONICAL_FEATURE_MATRIX_VERSION,
  FEATURE_MATRIX_SCHEMA_VERSION,
  featureMatrixHash,
} = matrixModule
const app = express()
app.use(express.json())
app.use('/api/presentations', presentationsRouter)

const expectedMatrix = Object.freeze({
  schemaVersion: FEATURE_MATRIX_SCHEMA_VERSION,
  matrixVersion: CANONICAL_FEATURE_MATRIX_VERSION,
  hash: featureMatrixHash(CANONICAL_FEATURE_MATRIX_ENVELOPE),
})

describe('PPTX fidelity route', () => {
  beforeAll(() => storage.initDataFiles())

  it('returns canonical public-safe metadata without false level-four claims', async () => {
    const created = await request(app).post('/api/presentations').send({
      title: `Fidelity ${Date.now()}`,
      slides: [],
    })
    const response = await request(app)
      .get(`/api/presentations/${created.body.id}/pptx-fidelity`)

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      schemaVersion: 1,
      presentationId: created.body.id,
      matrix: expectedMatrix,
      fidelity: {
        status: 'reconstructed',
        maxClaimLevel: 0,
        achievedClaimLevel: 0,
        verifiedClaimLevel: 0,
        targetClaimLevel: 4,
        level5Available: false,
      },
    })
    expect(response.body.fidelity.rows.every((row) => row.verifiedEditable === false)).toBe(true)
    expect(response.body.localEvidence).toMatchObject({
      authority: 'local',
      matrix: expectedMatrix,
      originalAvailable: false,
    })
    expect(response.body.localEvidence.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'primitive.text.run.plain-replacement',
        reasons: expect.any(Array),
      }),
    ]))
    expect(response.body).not.toHaveProperty('revision')
    expect(JSON.stringify(response.body)).not.toMatch(
      /sha256|packagePath|originalPath|argv|stderr|manifestHash|adapterId|fixtureIds|requiredTestIds/i,
    )
  })

  it('fails closed with a paired reason when original package metadata has no verified package', async () => {
    const id = crypto.randomUUID()
    await storage.withPresentations((presentations) => {
      presentations.push({
        id,
        title: 'Missing source package',
        slides: [],
        pptxOriginal: { id: crypto.randomUUID(), sha256: 'a'.repeat(64) },
      })
    })

    const response = await request(app).get(`/api/presentations/${id}/pptx-fidelity`)

    expect(response.status).toBe(200)
    expect(response.body.exports.original).toEqual({
      available: false,
      label: 'Download Original',
      reasonCode: 'original-package-unverified',
      reason: 'The original package is not verified for download.',
    })
    expect(response.body.exports.validatedEdited.available).toBe(false)
  })

  it.each(['protection', 'unknown'])('keeps route payloads original-only for %s package content', async (kind) => {
    const id = crypto.randomUUID()
    await storage.withPresentations((presentations) => {
      presentations.push({
        id,
        title: `Original-only ${kind}`,
        slides: [],
        pptxOriginal: {
          id: crypto.randomUUID(),
          sha256: `route-secret-${kind}`,
          packagePath: `C:\\private\\${kind}.pptx`,
          sourceRef: { partUri: 'ppt/slides/slide1.xml' },
          capabilitySummary: { kinds: [kind] },
        },
      })
    })

    const response = await request(app).get(`/api/presentations/${id}/pptx-fidelity`)

    expect(response.status).toBe(200)
    expect(response.body.fidelity.status).toBe('original-only')
    expect(response.body.exports.validatedEdited).toMatchObject({
      available: false,
      reasonCode: 'original-only-package',
      reason: 'This package can only be recovered as its original file.',
    })
    expect(JSON.stringify(response.body)).not.toMatch(new RegExp(`route-secret-${kind}|private|slide1`, 'i'))
  })
})

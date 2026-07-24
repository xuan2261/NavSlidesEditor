import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import matrix from '../canonical-feature-matrix.js'
import matrixSubject from './matrix-subject.js'
import corpusManifest from './corpus-manifest.js'
import { hashCanonical } from './claim-evaluator.js'

const { CANONICAL_FEATURE_MATRIX } = matrix
const { canonicalMatrixSubject } = matrixSubject
const {
  buildCorpusInventory,
  buildCorpusManifest,
  buildQualificationManifest,
  verifyCorpusManifest,
} = corpusManifest

function completeFixtureMap(deckId) {
  return Object.fromEntries(
    [...new Set(CANONICAL_FEATURE_MATRIX.flatMap((row) => row.fixtureIds))].map((fixtureId) => [
      fixtureId,
      deckId,
    ])
  )
}

describe('corpus manifest', () => {
  it('derives all coverage rows and matrix identity from the canonical matrix', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-corpus-manifest-'))
    try {
      await fs.writeFile(path.join(dir, 'b.pptx'), 'deck-b')
      await fs.writeFile(path.join(dir, 'a.pptx'), 'deck-a')
      await fs.writeFile(path.join(dir, 'ignored.txt'), 'not-a-deck')

      const manifest = await buildCorpusManifest(dir, completeFixtureMap('a.pptx'))

      expect(manifest).toMatchObject({ schemaVersion: 2, matrix: canonicalMatrixSubject() })
      expect(manifest.decks.map((deck) => deck.id)).toEqual(['a.pptx', 'b.pptx'])
      expect(manifest.decks[0].sha256).toBe(createHash('sha256').update('deck-a').digest('hex'))
      expect(manifest.features.map((row) => row.rowId)).toEqual(
        CANONICAL_FEATURE_MATRIX.map((row) => row.id)
      )
      expect(manifest.features[0]).toMatchObject({
        rowId: CANONICAL_FEATURE_MATRIX[0].id,
        editabilityTier: CANONICAL_FEATURE_MATRIX[0].tier,
        fixtureIds: CANONICAL_FEATURE_MATRIX[0].fixtureIds,
        requiredTests: CANONICAL_FEATURE_MATRIX[0].requiredTestIds,
      })
      const { sha256: _sha256, ...coverage } = manifest.features[0]
      expect(manifest.features[0].sha256).toBe(hashCanonical(coverage))
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('rejects arbitrary rows and incomplete or invalid fixture mappings', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-corpus-manifest-'))
    try {
      await fs.writeFile(path.join(dir, 'deck.pptx'), 'deck')
      await expect(buildCorpusManifest(dir, [{ feature: 'arbitrary' }])).rejects.toThrow(
        'fixture mapping must be a plain object'
      )
      await expect(buildCorpusManifest(dir, {})).rejects.toThrow(
        'missing canonical fixture mapping'
      )
      const invalidMap = completeFixtureMap('missing.pptx')
      await expect(buildCorpusManifest(dir, invalidMap)).rejects.toThrow('unknown corpus deck')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('fails closed when a qualification corpus differs from its exact inventory', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-corpus-manifest-'))
    try {
      await fs.writeFile(path.join(dir, 'a.pptx'), 'deck-a')
      const manifest = buildQualificationManifest(await buildCorpusInventory(dir))
      await fs.rename(path.join(dir, 'a.pptx'), path.join(dir, 'renamed.pptx'))

      const verification = verifyCorpusManifest(manifest, await buildCorpusInventory(dir))
      expect(verification.ok).toBe(false)
      expect(verification.errors).toContain('corpus-deck-set-mismatch')
      expect(verification.manifestDigest).toBe(manifest.manifestDigest)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('detects missing decks, hash drift, and a stale matrix subject', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-corpus-manifest-'))
    try {
      await fs.writeFile(path.join(dir, 'a.pptx'), 'deck-a')
      await fs.writeFile(path.join(dir, 'b.pptx'), 'deck-b')
      const inventory = await buildCorpusInventory(dir)
      const manifest = buildQualificationManifest(inventory)

      expect(verifyCorpusManifest(manifest, { decks: [inventory.decks[0]] }).errors).toContain(
        'corpus-deck-set-mismatch'
      )
      await fs.writeFile(path.join(dir, 'a.pptx'), 'changed-bytes')
      expect(verifyCorpusManifest(manifest, await buildCorpusInventory(dir)).errors).toContain(
        'corpus-deck-hash-mismatch'
      )
      const staleMatrix = { ...manifest, matrix: { ...manifest.matrix, hash: '0'.repeat(64) } }
      expect(verifyCorpusManifest(staleMatrix, inventory).errors).toContain('stale-matrix-subject')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('rejects duplicate corpus content and pins the checked-in eleven-deck corpus', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-corpus-manifest-'))
    try {
      await fs.writeFile(path.join(dir, 'a.pptx'), 'same-deck')
      await fs.writeFile(path.join(dir, 'b.pptx'), 'same-deck')
      await expect(buildCorpusInventory(dir)).rejects.toThrow('duplicate corpus content hash')

      const corpusDir = path.resolve('server/data/test-corpus')
      const manifestPath = path.join(corpusDir, 'importer-qualification-manifest.json')
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
      const verification = verifyCorpusManifest(manifest, await buildCorpusInventory(corpusDir))
      expect(manifest.decks).toHaveLength(11)
      expect(verification).toMatchObject({ ok: true, manifestDigest: manifest.manifestDigest })
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})

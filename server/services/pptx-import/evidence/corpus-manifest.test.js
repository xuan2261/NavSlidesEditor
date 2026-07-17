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
const { buildCorpusManifest } = corpusManifest

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
})

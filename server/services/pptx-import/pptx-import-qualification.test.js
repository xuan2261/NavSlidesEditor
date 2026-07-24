import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import manifestTools from './evidence/corpus-manifest.js'
import qualification from './pptx-import-qualification.js'

const { buildCorpusInventory, buildQualificationManifest } = manifestTools
const { qualifyDeck, runImporterQualification } = qualification

function finiteStats(overrides = {}) {
  return {
    sceneGraphMappedNodes: 0,
    sceneGraphUnmapped: 0,
    primitivePlaceholderCount: 0,
    nativeObjectCoverage: {
      chartCoverageGapCount: 0,
      smartArtCoverageGapCount: 0,
    },
    ...overrides,
  }
}

async function setupDeck() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-qualification-'))
  const filePath = path.join(dir, 'deck.pptx')
  await fs.writeFile(filePath, 'deck-bytes')
  const inventory = await buildCorpusInventory(dir)
  return { dir, filePath, deck: inventory.decks[0], inventory }
}

describe('PPTX importer qualification', () => {
  it('retains finite best-effort evidence when strict import rejects', async () => {
    const { dir, filePath, deck } = await setupDeck()
    const importer = vi
      .fn()
      .mockResolvedValueOnce({ stats: finiteStats({ sceneGraphMappedNodes: 4 }) })
      .mockRejectedValueOnce(Object.assign(new Error('EMF conversion disabled'), { type: 'emf-convert-disabled' }))
    try {
      const result = await qualifyDeck({ deck, corpusDir: dir, importer })

      expect(importer).toHaveBeenNthCalledWith(1, expect.stringMatching(/[\\/]deck\.pptx$/), {})
      expect(importer).toHaveBeenNthCalledWith(2, expect.stringMatching(/[\\/]deck\.pptx$/), { strict: true })
      expect(importer.mock.calls[0][0]).not.toBe(filePath)
      expect(importer.mock.calls[1][0]).toBe(importer.mock.calls[0][0])
      expect(result.evidence).toMatchObject({
        available: true,
        sceneGraphMappedNodes: 4,
        sceneGraphUnmapped: 0,
        chartCoverageGapCount: 0,
        smartArtCoverageGapCount: 0,
        permanentPlaceholderCount: 0,
      })
      expect(result.strictOutcome).toMatchObject({ status: 'rejected', type: 'emf-convert-disabled' })
      expect(result.blockers).toContain('strict-rejected')
      expect(result.sourceHashes.bestEffort).toBe(deck.sha256)
      expect(result.sourceHashes.strict).toBe(deck.sha256)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('records source-hash failures as blockers without importing an unknown source', async () => {
    const { dir, deck } = await setupDeck()
    const importer = vi.fn()
    try {
      const result = await qualifyDeck({
        deck,
        corpusDir: dir,
        importer,
        hash: async () => {
          throw new Error('source disappeared')
        },
      })

      expect(importer).not.toHaveBeenCalled()
      expect(result.blockers).toEqual(expect.arrayContaining([
        'source-hash-unavailable-bestEffort',
        'source-hash-unavailable-strict',
      ]))
      expect(result.errorDetails).toHaveLength(1)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('blocks missing or non-finite native evidence even when strict import passes', async () => {
    const { dir, deck } = await setupDeck()
    const importer = vi.fn().mockResolvedValue({
      stats: finiteStats({ sceneGraphMappedNodes: Number.NaN, sceneGraphUnmapped: undefined }),
    })
    try {
      const result = await qualifyDeck({ deck, corpusDir: dir, importer })

      expect(result.passed).toBe(false)
      expect(result.evidence.available).toBe(false)
      expect(result.blockers).toEqual(expect.arrayContaining([
        'missing-or-non-finite-sceneGraphMappedNodes',
        'missing-or-non-finite-sceneGraphUnmapped',
      ]))
      expect(importer).toHaveBeenCalledTimes(2)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('fails exact inventory checks before importing and records a hash-bound report', async () => {
    const { dir, inventory } = await setupDeck()
    const manifestPath = path.join(dir, 'manifest.json')
    await fs.writeFile(manifestPath, JSON.stringify(buildQualificationManifest(inventory)))
    await fs.writeFile(path.join(dir, 'extra.pptx'), 'unexpected')
    const importer = vi.fn()
    try {
      const report = await runImporterQualification({ corpusDir: dir, manifestPath, importer })

      expect(importer).not.toHaveBeenCalled()
      expect(report).toMatchObject({
        mode: 'importer-qualification',
        exitCode: 1,
        manifestDigest: expect.any(String),
        errors: expect.arrayContaining(['corpus-deck-set-mismatch']),
      })
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('reports zero-gap qualified evidence with exact options and source hashes', async () => {
    const { dir, inventory } = await setupDeck()
    const manifestPath = path.join(dir, 'manifest.json')
    await fs.writeFile(manifestPath, JSON.stringify(buildQualificationManifest(inventory)))
    const importer = vi.fn().mockResolvedValue({ stats: finiteStats() })
    try {
      const report = await runImporterQualification({ corpusDir: dir, manifestPath, importer })

      expect(report).toMatchObject({
        mode: 'importer-qualification',
        exitCode: 0,
        importerOptions: { bestEffort: {}, strict: { strict: true } },
      })
      expect(report.results[0]).toMatchObject({
        sourceSha256: inventory.decks[0].sha256,
        sourceHashes: { bestEffort: inventory.decks[0].sha256, strict: inventory.decks[0].sha256 },
        passed: true,
      })
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})

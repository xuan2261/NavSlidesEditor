import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import manifestTools from './evidence/corpus-manifest.js'
import qualification from './pptx-import-qualification.js'

const { buildCorpusInventory } = manifestTools
const { qualifyDeck } = qualification

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
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-qualification-source-'))
  const filePath = path.join(dir, 'deck.pptx')
  await fs.writeFile(filePath, 'deck-bytes')
  const inventory = await buildCorpusInventory(dir)
  return { dir, filePath, deck: inventory.decks[0] }
}

describe('PPTX importer qualification source binding', () => {
  it('uses one hash-verified snapshot when the original changes between passes', async () => {
    const { dir, filePath, deck } = await setupDeck()
    const consumed = []
    const importer = vi.fn(async (inputPath, options) => {
      consumed.push({ inputPath, bytes: await fs.readFile(inputPath, 'utf8'), options })
      if (!options.strict) await fs.writeFile(filePath, 'mutated-original-bytes')
      return { stats: finiteStats() }
    })

    try {
      const result = await qualifyDeck({ deck, corpusDir: dir, importer })

      expect(result.passed).toBe(true)
      expect(consumed.map(({ bytes }) => bytes)).toEqual(['deck-bytes', 'deck-bytes'])
      expect(new Set(consumed.map(({ inputPath }) => inputPath))).toHaveLength(1)
      expect(consumed[0].inputPath).not.toBe(filePath)
      expect(result.sourceHashes).toEqual({
        bestEffort: deck.sha256,
        strict: deck.sha256,
      })
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('provides the importer a read-only snapshot', async () => {
    const { dir, deck } = await setupDeck()
    let writeError = null
    const importer = vi.fn(async (inputPath, options) => {
      if (options.strict) {
        try {
          await fs.writeFile(inputPath, 'mutated-snapshot-bytes')
        } catch (error) {
          writeError = error
        }
      }
      return { stats: finiteStats() }
    })

    try {
      const result = await qualifyDeck({ deck, corpusDir: dir, importer })

      expect(writeError).toBeInstanceOf(Error)
      expect(result.passed).toBe(true)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('rejects a strict result if its snapshot changes during the import', async () => {
    const { dir, deck } = await setupDeck()
    const importer = vi.fn(async (inputPath, options) => {
      if (options.strict) {
        await fs.chmod(inputPath, 0o600)
        await fs.writeFile(inputPath, 'mutated-snapshot-bytes')
      }
      return { stats: finiteStats() }
    })

    try {
      const result = await qualifyDeck({ deck, corpusDir: dir, importer })

      expect(result.passed).toBe(false)
      expect(result.strictOutcome).toMatchObject({
        status: 'rejected',
        type: 'source-snapshot-changed',
      })
      expect(result.blockers).toEqual(expect.arrayContaining([
        'source-snapshot-changed-strict-post',
        'strict-source-invalid',
      ]))
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('removes the temporary snapshot directory after an importer deletes its file', async () => {
    const { dir, deck } = await setupDeck()
    let snapshotDir = null
    const importer = vi.fn(async (inputPath, options) => {
      if (options.strict) {
        snapshotDir = path.dirname(inputPath)
        await fs.rm(inputPath)
      }
      return { stats: finiteStats() }
    })

    try {
      const result = await qualifyDeck({ deck, corpusDir: dir, importer })

      expect(result.passed).toBe(false)
      expect(result.blockers).not.toContain('snapshot-cleanup-failed')
      await expect(fs.access(snapshotDir)).rejects.toThrow()
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('blocks source bytes that no longer match the manifest before importing', async () => {
    const { dir, filePath, deck } = await setupDeck()
    const importer = vi.fn()
    await fs.writeFile(filePath, 'changed-source-bytes')

    try {
      const result = await qualifyDeck({ deck, corpusDir: dir, importer })

      expect(importer).not.toHaveBeenCalled()
      expect(result.passed).toBe(false)
      expect(result.blockers).toEqual(expect.arrayContaining([
        'source-snapshot-hash-mismatch',
        'strict-not-run',
      ]))
      expect(result.errorDetails).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'source-hash-mismatch' }),
      ]))
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('blocks invalid negative count evidence even when strict import passes', async () => {
    const { dir, deck } = await setupDeck()
    const importer = vi.fn().mockResolvedValue({
      stats: finiteStats({ sceneGraphUnmapped: -1 }),
    })

    try {
      const result = await qualifyDeck({ deck, corpusDir: dir, importer })

      expect(result.passed).toBe(false)
      expect(result.evidence.available).toBe(false)
      expect(result.blockers).toContain('invalid-count-sceneGraphUnmapped')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('keeps best-effort failure details in the result errorDetails array', async () => {
    const { dir, deck } = await setupDeck()
    const importer = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('<private>parser failed</private>'), {
        type: 'parser-output-invalid',
      }))
      .mockResolvedValueOnce({ stats: finiteStats() })

    try {
      const result = await qualifyDeck({ deck, corpusDir: dir, importer })

      expect(result.errorDetails).toEqual([{
        type: 'parser-output-invalid',
        message: expect.not.stringContaining('<private>'),
      }])
      expect(result.evidence.errorDetails).toEqual(result.errorDetails)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})

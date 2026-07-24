import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import cli from './pptx-oracle-cli.js'

const { buildReport, captureCorpusActuals, main, parseArgs } = cli

describe('pptx-oracle-cli release gate', () => {
  const dirs = []
  afterEach(async () => {
    delete process.env.PPTX_ORACLE
    delete process.env.CI
    await Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
  })

  it('defaults to the non-skippable integrity gate and rejects debt/override arguments', () => {
    expect(parseArgs([])).toMatchObject({ mode: 'integrity' })
    expect(parseArgs(['--debt-record']).invalid).toContain('debt-record-not-eligible')
    expect(parseArgs(['--actual-manifest-out', 'shared.json']).invalid).toContain('actual-manifest-output-override-forbidden')
    expect(parseArgs(['--force-threshold', '1']).invalid).toContain('candidate-threshold-override-forbidden')
    expect(parseArgs(['--mode', 'seed-goldens']).invalid).toContain('placeholder-golden-mode-forbidden')
  })

  it('publishes package-backed captures into a fresh atomic run directory', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'oracle-capture-'))
    dirs.push(root)
    const manifestPath = path.join(root, 'corpus.json')
    await fs.writeFile(manifestPath, JSON.stringify({ manifestDigest: 'a'.repeat(64) }))
    const seenOutDirs = []
    const capture = async ({ outDir }) => {
      seenOutDirs.push(outDir)
      return { ok: true, actual: { source: { fileName: 'deck-a.pptx' }, slides: [] } }
    }
    const result = await captureCorpusActuals({
      baseUrl: 'http://127.0.0.1:4010', corpusManifest: manifestPath, corpus: root,
      actualsDir: path.join(root, 'actuals'), reportDir: path.join(root, 'reports'),
    }, {
      capture, inventoryBuilder: async () => ({ decks: [{ id: 'deck-a.pptx' }] }),
      manifestVerifier: () => ({ ok: true, errors: [] }),
      canonicalReader: async () => ({ manifestDigest: 'a'.repeat(64) }),
    })
    expect(result).toMatchObject({ ok: true, decks: 1 })
    expect(result.actualsDir).toMatch(/run-/)
    expect(seenOutDirs[0]).not.toBe(result.actualsDir)
    await expect(fs.access(result.actualManifestPath)).resolves.toBeUndefined()
    expect((await fs.readdir(path.join(root, 'actuals'))).some((name) => name.startsWith('.capture-'))).toBe(false)
  })

  it('retains cleanup identifiers from a failed package-backed capture', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'oracle-capture-'))
    dirs.push(root)
    const manifestPath = path.join(root, 'corpus.json')
    await fs.writeFile(manifestPath, JSON.stringify({ manifestDigest: 'a'.repeat(64) }))
    const result = await captureCorpusActuals({
      baseUrl: 'http://127.0.0.1:4010', corpusManifest: manifestPath, corpus: root, actualsDir: path.join(root, 'actuals'),
    }, {
      capture: async () => ({
        ok: false, error: 'untrusted error detail',
        cleanup: { jobId: 'job-1', presentationId: 'presentation-1' }, cleanupError: 'untrusted cleanup detail',
        captureCleanupErrors: ['capture-page-close-timeout', 'untrusted teardown detail'], outputCleanupError: 'untrusted output detail',
      }),
      inventoryBuilder: async () => ({ decks: [{ id: 'deck-a.pptx' }] }),
      manifestVerifier: () => ({ ok: true, errors: [] }),
      canonicalReader: async () => ({ manifestDigest: 'a'.repeat(64) }),
    })
    expect(result).toMatchObject({
      ok: false,
      failures: [{
        file: 'deck-a.pptx', error: 'package-backed-capture-failed', jobId: 'job-1', presentationId: 'presentation-1',
        cleanupError: 'capture-cleanup-failed', captureCleanupErrors: ['capture-page-close-timeout'],
        outputCleanupError: 'actual-output-cleanup-failed',
      }],
    })
  })

  it('refuses a self-consistent noncanonical corpus manifest before HTTP capture', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'oracle-capture-'))
    dirs.push(root)
    const manifestPath = path.join(root, 'corpus.json')
    await fs.writeFile(manifestPath, JSON.stringify({ manifestDigest: 'a'.repeat(64) }))
    const capture = async () => { throw new Error('must not capture') }
    const result = await captureCorpusActuals({
      baseUrl: 'http://127.0.0.1:4010', corpusManifest: manifestPath, corpus: root, actualsDir: path.join(root, 'actuals'),
    }, {
      capture,
      canonicalReader: async () => ({ manifestDigest: 'b'.repeat(64) }),
    })
    expect(result).toEqual({ ok: false, error: 'noncanonical-qualification-manifest' })
  })

  it('returns a structured non-zero blocked result when local evidence is absent', async () => {
    const reportDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oracle-cli-'))
    dirs.push(reportDir)
    const code = await main(['--mode', 'integrity', '--report-dir', reportDir])
    expect(code).toBe(1)
    const reports = await fs.readdir(reportDir)
    expect(reports).toHaveLength(1)
    const report = JSON.parse(await fs.readFile(path.join(reportDir, reports[0]), 'utf8'))
    expect(report.gate.integrity.verdict).toBe('blocked')
    expect(report.gate.qualification.verdict).toBe('blocked')
  })

  it('does not allow PPTX_ORACLE=off to pass integrity or qualification', async () => {
    process.env.PPTX_ORACLE = 'off'
    const integrityDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oracle-cli-'))
    const qualificationDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oracle-cli-'))
    dirs.push(integrityDir, qualificationDir)
    expect(await main(['--mode', 'integrity', '--report-dir', integrityDir])).toBe(1)
    expect(await main(['--mode', 'qualification', '--report-dir', qualificationDir])).toBe(1)
  })

  it('reports the separate integrity and claim verdicts without candidate thresholds', () => {
    const report = buildReport({
      mode: 'qualification', gate: {
        integrity: { verdict: 'passed', reasons: [] }, qualification: { verdict: 'failed', reasons: ['mean-ssim-below-phase08-full-policy'] },
      },
      evidence: { subjectHash: 'evidence-subject' },
      actuals: [{ jobId: 'job-1', presentation: { packageRevisionId: 'r0' }, slides: [{ index: 0, ssim: 0.98 }] }],
    })
    expect(report).toMatchObject({
      mode: 'qualification', gate: { integrity: { verdict: 'passed' }, qualification: { verdict: 'failed' } },
      evidence: { subjectHash: 'evidence-subject' },
      actuals: [{ jobId: 'job-1', presentation: { packageRevisionId: 'r0' }, slides: [{ index: 0, ssim: 0.98 }] }],
    })
    expect(report.evidence).toEqual({ subjectHash: 'evidence-subject' })
    expect(report.actuals[0].presentation.packageRevisionId).toBe('r0')
    expect(report.generatedAt).toBeTruthy()
  })
})

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { compareBaseline, saveFinalEvidence } from '../e2e/helpers/navigator-performance-evidence.js'

const roots = []
afterEach(async () => {
  delete process.env.NAVIGATOR_BASELINE_INPUT
  delete process.env.NAVIGATOR_REPORT_OUTPUT
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})
async function directory() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'navigator-evidence-'))
  roots.push(root)
  return root
}
function receipt(stable = true) {
  return {
    budgetHash: 'frozen', environment: { comparisonEnvironmentHash: 'machine', build: { manifestHash: 'build' } },
    fixtures: [{ name: '50x0', fixtureHash: 'fixture' }],
    summary: { complete: true, stable, fixtures: [{ fixture: '50x0', metrics: { input: { pooled: { median: 40, p95: 50 } } } }] },
  }
}

describe('navigator measurement receipts', () => {
  it('retains per-test evidence and never overwrites an explicitly named historical receipt', async () => {
    const root = await directory()
    const historical = path.join(root, 'historical.json')
    await writeFile(historical, 'historical bytes')
    process.env.NAVIGATOR_REPORT_OUTPUT = historical
    const attachments = []
    const info = { outputPath: (name) => path.join(root, name), attach: async (...args) => attachments.push(args) }
    await expect(saveFinalEvidence(info, 'navigator-baseline.json', { status: 'measured' })).rejects.toMatchObject({ code: 'EEXIST' })
    expect(await readFile(historical, 'utf8')).toBe('historical bytes')
    expect(JSON.parse(await readFile(path.join(root, 'navigator-baseline.json'), 'utf8'))).toEqual({ status: 'measured' })
    expect(attachments).toHaveLength(1)
  })
  it('writes an explicitly named new receipt without changing baseline/candidate filenames', async () => {
    const root = await directory()
    process.env.NAVIGATOR_REPORT_OUTPUT = path.join(root, 'unique-run.json')
    const info = { outputPath: (name) => path.join(root, name), attach: async () => {} }
    await saveFinalEvidence(info, 'navigator-candidate.json', { status: 'measured' })
    expect(await readFile(process.env.NAVIGATOR_REPORT_OUTPUT, 'utf8')).toBe(await readFile(path.join(root, 'navigator-candidate.json'), 'utf8'))
  })
  it.each([[false, true], [true, false]])('rejects qualifying noisy comparisons (baseline stable=%s, candidate stable=%s)', async (baselineStable, candidateStable) => {
    const root = await directory()
    process.env.NAVIGATOR_BASELINE_INPUT = path.join(root, 'baseline.json')
    await writeFile(process.env.NAVIGATOR_BASELINE_INPUT, JSON.stringify(receipt(baselineStable)))
    const comparison = await compareBaseline(receipt(candidateStable))
    expect(comparison.pairs.every((pair) => pair.withinCap)).toBe(true)
    expect(comparison.stable).toBe(false)
    expect(comparison.passed).toBe(false)
  })
  it('qualifies stable paired data within the unchanged cap', async () => {
    const root = await directory()
    process.env.NAVIGATOR_BASELINE_INPUT = path.join(root, 'baseline.json')
    await writeFile(process.env.NAVIGATOR_BASELINE_INPUT, JSON.stringify(receipt()))
    expect(await compareBaseline(receipt())).toMatchObject({ stable: true, passed: true })
  })
  it.each(['baseline', 'candidate'])('rejects incomplete %s data even when stable flags and ratios look acceptable', async (incomplete) => {
    const root = await directory()
    process.env.NAVIGATOR_BASELINE_INPUT = path.join(root, 'baseline.json')
    const baseline = receipt()
    const candidate = receipt()
    ;(incomplete === 'baseline' ? baseline : candidate).summary.complete = false
    await writeFile(process.env.NAVIGATOR_BASELINE_INPUT, JSON.stringify(baseline))
    expect(await compareBaseline(candidate)).toMatchObject({ stable: false, passed: false })
  })
  it('rejects empty paired populations instead of vacuously passing every ratio', async () => {
    const root = await directory()
    process.env.NAVIGATOR_BASELINE_INPUT = path.join(root, 'baseline.json')
    const candidate = receipt()
    candidate.summary.fixtures[0].metrics = {}
    await writeFile(process.env.NAVIGATOR_BASELINE_INPUT, JSON.stringify(receipt()))
    expect(await compareBaseline(candidate)).toMatchObject({ pairs: [], passed: false })
  })
  it('retains the frozen ten-percent paired regression cap', async () => {
    const root = await directory()
    process.env.NAVIGATOR_BASELINE_INPUT = path.join(root, 'baseline.json')
    const candidate = receipt()
    candidate.summary.fixtures[0].metrics.input.pooled.p95 = 60
    await writeFile(process.env.NAVIGATOR_BASELINE_INPUT, JSON.stringify(receipt()))
    const comparison = await compareBaseline(candidate)
    expect(comparison.stable).toBe(true)
    expect(comparison.pairs.find((pair) => pair.statistic === 'p95')).toMatchObject({ ratio: 1.2, withinCap: false })
    expect(comparison.passed).toBe(false)
  })
})

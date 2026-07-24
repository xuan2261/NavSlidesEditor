import fs from 'fs-extra'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import schema from './report-schema.js'
import matrix from './run-matrix.js'

const { SKIP_REASONS, assertValidPerfReport } = schema
const { runFullMatrix, runTinyMatrix, writeReport } = matrix

const tempDirs = []

afterEach(async () => {
  while (tempDirs.length) {
    await fs.remove(tempDirs.pop()).catch(() => {})
  }
})

describe('perf matrix runner (P3 schema / skip path)', () => {
  it('tiny matrix produces schema-valid report with stage timings', async () => {
    const report = await runTinyMatrix()
    assertValidPerfReport(report)
    expect(report.skipped).toBe(false)
    expect(report.mode).toBe('tiny')
    expect(report.runs.length).toBeGreaterThanOrEqual(1)
    const baseline = report.runs.find((r) => r.dimension === 'tiny')
    expect(baseline.ok).toBe(true)
    expect(baseline.stages.parse.durationMs).toBeGreaterThanOrEqual(0)
    expect(baseline.stages.map.durationMs).toBeGreaterThanOrEqual(0)
    expect(report.archiveReuse.status).toBe('deferred')
    expect(report.doublePass.residualCost).toMatch(/revalidate/i)
  })

  it('full ladder without PPTX_PERF emits structured skip (not shell throw)', async () => {
    const report = await runFullMatrix({ env: { ...process.env, PPTX_PERF: undefined } })
    assertValidPerfReport(report)
    expect(report).toMatchObject({
      skipped: true,
      reason: SKIP_REASONS.ENV,
      mode: 'full',
    })
  })

  it('writeReport persists JSON under plans/reports path', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-perf-report-'))
    tempDirs.push(dir)
    const report = await runTinyMatrix()
    const out = await writeReport(report, {
      reportDir: dir,
      fileName: 'pptx-import-perf-matrix-test.json',
    })
    expect(out).toContain('pptx-import-perf-matrix-test.json')
    const loaded = await fs.readJson(out)
    assertValidPerfReport(loaded)
  })
})

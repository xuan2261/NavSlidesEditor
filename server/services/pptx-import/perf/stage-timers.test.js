import fs from 'fs-extra'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import guards from '../pptx-guards.js'
import stageTimers from './stage-timers.js'
import synthetic from './synthetic-package.js'

const { validatePptxPackage } = guards
const { createStageTimer, percentile, summarizeDurations } = stageTimers
const { buildEntryLadderPackage, buildTinyPptx } = synthetic

const tempDirs = []

afterEach(async () => {
  while (tempDirs.length) {
    await fs.remove(tempDirs.pop()).catch(() => {})
  }
})

async function writeTempPptx(bytes, name = 'fixture.pptx') {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-stage-timer-'))
  tempDirs.push(dir)
  const filePath = path.join(dir, name)
  await fs.writeFile(filePath, bytes)
  return filePath
}

describe('stage-timers (P1 always-on)', () => {
  it('tiny fixture stage timer returns parse/map durations ≥ 0', async () => {
    const filePath = await writeTempPptx(await buildTinyPptx(), 'tiny.pptx')
    const timer = createStageTimer()

    await timer.measure('parse', () => validatePptxPackage(filePath, 'tiny.pptx'))
    await timer.measure('map', async () => {
      await validatePptxPackage(filePath, 'tiny.pptx')
    })

    const snap = timer.snapshot()
    expect(snap.parse.durationMs).toBeGreaterThanOrEqual(0)
    expect(snap.map.durationMs).toBeGreaterThanOrEqual(0)
    expect(snap.parse.peakRssBytes).toBeGreaterThan(0)
    expect(snap.map.peakRssBytes).toBeGreaterThan(0)
  })

  it('records error flag when stage throws without losing duration', async () => {
    let clock = 100
    const timer = createStageTimer({
      now: () => {
        clock += 5
        return clock
      },
      rss: () => 1024,
    })

    await expect(
      timer.measure('parse', async () => {
        throw new Error('boom')
      })
    ).rejects.toThrow(/boom/)

    const snap = timer.snapshot()
    expect(snap.parse.durationMs).toBeGreaterThanOrEqual(0)
    expect(snap.parse.error).toBe(true)
  })

  it('near-limit entry count fixture rejects under tight budget', async () => {
    const bytes = await buildEntryLadderPackage({ entryCount: 12 })
    const filePath = await writeTempPptx(bytes, 'entries.pptx')
    await expect(
      validatePptxPackage(filePath, 'entries.pptx', { maxZipEntries: 10 })
    ).rejects.toThrow(/too many ZIP entries/i)
  })

  it('entry ladder under budget completes with stage timing', async () => {
    const bytes = await buildEntryLadderPackage({ entryCount: 8 })
    const filePath = await writeTempPptx(bytes, 'ok-entries.pptx')
    const timer = createStageTimer()
    const result = await timer.measure('parse', () =>
      validatePptxPackage(filePath, 'ok-entries.pptx', { maxZipEntries: 20 })
    )
    expect(result.entryCount).toBeGreaterThanOrEqual(2)
    expect(timer.snapshot().parse.durationMs).toBeGreaterThanOrEqual(0)
  })
})

describe('summarizeDurations', () => {
  it('computes p50/p95 for sorted samples', () => {
    const summary = summarizeDurations([10, 20, 30, 40, 50])
    expect(summary.count).toBe(5)
    expect(summary.p50).toBe(percentile([10, 20, 30, 40, 50], 50))
    expect(summary.p95).toBe(percentile([10, 20, 30, 40, 50], 95))
    expect(summary.min).toBe(10)
    expect(summary.max).toBe(50)
  })
})

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import cli from './pptx-oracle-cli.js'

const { parseArgs, buildReport, main } = cli

function solid(w, h, v) {
  const buf = Buffer.alloc(w * h * 4)
  buf.fill(v)
  return buf
}

describe('pptx-oracle-cli (T2.3 T2.4 T2.6 T2.7)', () => {
  /** @type {string[]} */
  const temps = []
  afterEach(async () => {
    await Promise.all(temps.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })))
    delete process.env.PPTX_ORACLE
    delete process.env.CI
    delete process.env.GITHUB_ACTIONS
  })

  async function tempDir() {
    const d = await fs.mkdtemp(path.join(os.tmpdir(), 'oracle-cli-'))
    temps.push(d)
    return d
  }

  it('T2.3 parses args and report schema has decks + meanSsim', () => {
    const args = parseArgs(['--corpus', 'x', '--mean-threshold', '0.9', '--milestone', 'phase02'])
    expect(args.corpus).toBe('x')
    expect(args.meanThreshold).toBe(0.9)
    const report = buildReport({
      decks: [{ file: 'a.pptx', slides: [{ index: 0, ssim: 0.91 }] }],
      meanSsim: 0.91,
    })
    expect(report).toMatchObject({
      meanSsim: 0.91,
      decks: [{ file: 'a.pptx', slides: [{ index: 0, ssim: 0.91 }] }],
    })
    expect(report.generatedAt).toBeTruthy()
    expect(parseArgs([]).requireActuals).toBe(true)
    expect(parseArgs(['--debt-record'])).toMatchObject({
      requireActuals: false,
      debtRecord: true,
    })
  })

  it('T2.4 PPTX_ORACLE=off exits 0 with skipped outside CI', async () => {
    process.env.PPTX_ORACLE = 'off'
    delete process.env.CI
    delete process.env.GITHUB_ACTIONS
    const code = await main(['--help'])
    expect(code).toBe(0)
    const codeOff = await main([])
    expect(codeOff).toBe(0)
  })

  it('T2.6 force threshold 1.0 on noisy pair → exit 1', async () => {
    const dir = await tempDir()
    const a = path.join(dir, 'a.raw')
    const b = path.join(dir, 'b.raw')
    await fs.writeFile(a, solid(8, 8, 0))
    await fs.writeFile(b, solid(8, 8, 255))
    const reportDir = path.join(dir, 'reports')
    const code = await main([
      '--pair-a',
      a,
      '--pair-b',
      b,
      '--width',
      '8',
      '--height',
      '8',
      '--force-threshold',
      '1',
      '--report-dir',
      reportDir,
    ])
    expect(code).toBe(1)
    const names = await fs.readdir(reportDir)
    expect(names.some((n) => n.startsWith('pptx-oracle-') && n.endsWith('.json'))).toBe(true)
  })

  it('T2.7 report path is under report-dir with timestamp', async () => {
    const dir = await tempDir()
    const a = path.join(dir, 'a.raw')
    await fs.writeFile(a, solid(4, 4, 10))
    const reportDir = path.join(dir, 'r')
    const code = await main([
      '--pair-a',
      a,
      '--pair-b',
      a,
      '--width',
      '4',
      '--height',
      '4',
      '--report-dir',
      reportDir,
    ])
    expect(code).toBe(0)
    const names = await fs.readdir(reportDir)
    expect(names.length).toBe(1)
  })
})

import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'
import manifest from './qualification-manifest.json'
import { assertAuthoritativeReceipt } from '../../../../scripts/officecli/physical-feasibility-receipt.mjs'

const execFileAsync = promisify(execFile)
const ROOT = path.resolve(import.meta.dirname, '../../../..')
const SCRIPT = path.join(ROOT, 'scripts/officecli/run-physical-feasibility.mjs')
const REPORTS = path.join(
  ROOT,
  'plans/260925-0631-single-user-powerpoint-native-fidelity-release-deep-tdd/reports',
)
const RECEIPT = path.join(REPORTS, 'officecli-physical-feasibility.json')
const GOVERNANCE = path.join(REPORTS, 'release-scope-manifest.json')

describe('OfficeCLI physical feasibility gate', () => {
  it('the real CLI exits non-zero when required arguments are absent', async () => {
    await expect(execFileAsync(process.execPath, [SCRIPT], { cwd: ROOT }))
      .rejects.toMatchObject({ code: 1 })
  })

  it('cannot confuse unit seams with an authoritative physical gate', () => {
    const governance = JSON.parse(fs.readFileSync(GOVERNANCE, 'utf8'))
    if (!fs.existsSync(RECEIPT)) {
      expect(governance.officeCliPreG0Decision).toMatchObject({
        status: 'blocked',
        observedReceipt: expect.stringMatching(/absent/i),
      })
      return
    }
    const receipt = JSON.parse(fs.readFileSync(RECEIPT, 'utf8'))
    expect(() => assertAuthoritativeReceipt(receipt, manifest)).not.toThrow()
    expect(governance.officeCliPreG0Decision).toMatchObject({
      status: 'approved',
      receiptPath: expect.stringMatching(/officecli-physical-feasibility\.json$/),
    })
  })

  it('rejects a shallow hand-written authoritative receipt', () => {
    expect(() => assertAuthoritativeReceipt({
      schemaVersion: 1,
      status: 'passed',
      authoritative: true,
      binary: {
        version: manifest.version,
        sha256: manifest.releaseAsset.sha256,
        byteLength: manifest.releaseAsset.byteLength,
      },
    }, manifest)).toThrow(/receipt|evidence|provenance/i)
  })

  it('records attribution without claiming OfficeCLI redistribution', () => {
    for (const noticePath of ['NOTICE', 'website/NOTICE.md']) {
      const notice = fs.readFileSync(path.join(ROOT, noticePath), 'utf8')
      expect(notice).toContain('OfficeCLI')
      expect(notice).toMatch(/does not bundle or redistribute OfficeCLI/i)
    }
  })
})

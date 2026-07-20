import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { main } from './pptx-sla-1to1-cli.js'

const dirs = []

async function runDirectory(files) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-claim-run-'))
  dirs.push(dir)
  await Promise.all(Object.entries(files).map(([name, value]) =>
    fs.writeFile(path.join(dir, name), JSON.stringify(value))))
  return dir
}

async function trustRootPath() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-trust-root-'))
  dirs.push(dir)
  const file = path.join(dir, 'trusted.json')
  await fs.writeFile(file, JSON.stringify({
    approvedPolicyIdentity: 'test-policy',
    policy: { identity: 'test-policy', digest: 'invalid' },
    publicKeys: {},
  }))
  return file
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

describe('claim CLI fail-closed behavior', () => {
  it('never reads implicit static baselines', async () => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    expect(await main(['--claim-level', 'original-recovery', '--json'])).toBe(1)
  })

  it('fails a visual claim when the fresh composite run lacks provider evidence', async () => {
    const dir = await runDirectory({
      'manifest.json': { schemaVersion: 1, claimLevel: 'powerpoint-compatibility-visual-fidelity' },
      'corpus-manifest.json': { decks: [], features: [] },
      'claim-policy.json': {},
      'epoch-ledger.json': { entries: [] },
    })
    let output = ''
    vi.spyOn(process.stdout, 'write').mockImplementation((value) => { output += value; return true })
    const trustRoot = await trustRootPath()
    expect(await main(['--run-dir', dir, '--claim-level',
      'powerpoint-compatibility-visual-fidelity', '--trust-root', trustRoot, '--json'])).toBe(1)
    expect(JSON.parse(output).reasons).toContain('trusted-config-required')
  })

  it('reports each requested claim level independently', async () => {
    const dir = await runDirectory({
      'manifest.json': { schemaVersion: 1, claimLevel: 'original-recovery' },
      'corpus-manifest.json': { decks: [], features: [] },
      'claim-policy.json': {},
      'epoch-ledger.json': { entries: [] },
    })
    let output = ''
    vi.spyOn(process.stdout, 'write').mockImplementation((value) => { output += value; return true })
    const trustRoot = await trustRootPath()
    expect(await main(['--run-dir', dir, '--claim-level', 'original-recovery',
      '--trust-root', trustRoot, '--json'])).toBe(1)
    const report = JSON.parse(output)
    expect(report).toHaveProperty('claimLevel', 'original-recovery')
    expect(report).not.toHaveProperty('productOneToOneClaimAllowed')
  })

  it('requires a trust root supplied independently of the run directory', async () => {
    const dir = await runDirectory({
      'manifest.json': { schemaVersion: 1, claimLevel: 'original-recovery' },
      'corpus-manifest.json': { decks: [], features: [] },
      'claim-policy.json': { digest: 'attacker-controlled' },
      'epoch-ledger.json': { entries: [] },
    })
    let output = ''
    vi.spyOn(process.stdout, 'write').mockImplementation((value) => { output += value; return true })
    expect(await main(['--run-dir', dir, '--claim-level', 'original-recovery', '--json'])).toBe(1)
    expect(JSON.parse(output).reasons).toContain('trusted-root-required')
  })

  it('rejects the unsupported legacy milestone argument explicitly', async () => {
    let output = ''
    vi.spyOn(process.stdout, 'write').mockImplementation((value) => { output += value; return true })
    expect(await main(['--milestone', 'phase01', '--json'])).toBe(1)
    expect(JSON.parse(output).reasons).toContain('legacy-milestone-unsupported')
  })

  it('rejects the equals form of the legacy milestone argument explicitly', async () => {
    let output = ''
    vi.spyOn(process.stdout, 'write').mockImplementation((value) => { output += value; return true })
    expect(await main(['--milestone=phase01', '--json'])).toBe(1)
    expect(JSON.parse(output).reasons).toContain('legacy-milestone-unsupported')
  })

  it('rejects a trust root stored inside the evidence run directory', async () => {
    const dir = await runDirectory({
      'manifest.json': {},
      'trusted.json': {},
    })
    let output = ''
    vi.spyOn(process.stdout, 'write').mockImplementation((value) => { output += value; return true })
    expect(await main(['--run-dir', dir, '--trust-root', path.join(dir, 'trusted.json'),
      '--json'])).toBe(1)
    expect(JSON.parse(output).reasons).toContain('trusted-config-required')
  })
})

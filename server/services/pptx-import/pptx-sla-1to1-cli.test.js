import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { main } from './pptx-sla-1to1-cli.js'

const directories = []
const sha = (value) => createHash('sha256').update(value).digest('hex')

async function createDir(prefix) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), prefix))
  directories.push(directory)
  return directory
}

async function writeJson(directory, name, value) {
  await fs.writeFile(path.join(directory, name), JSON.stringify(value))
}

function trustedConfig(root) {
  return {
    rootSha256: sha(JSON.stringify(root)), policyIdentity: 'test-policy',
    authorityFingerprints: { ci: sha('ci'), provider: sha('provider'), ledger: sha('ledger') },
    ledgerCheckpoint: { identity: 'ledger', epoch: 0, digest: sha('checkpoint') },
  }
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })))
})

describe('pptx-sla-1to1-cli', () => {
  it('requires a fresh run, independent trust root, and bounded trusted configuration', async () => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    expect(await main(['--claim-level', 'original-recovery', '--json'])).toBe(1)
    const run = await createDir('pptx-sla-run-')
    await writeJson(run, 'manifest.json', {})
    expect(await main(['--run-dir', run, '--trust-root', path.join(run, 'root.json'), '--json'])).toBe(1)
  })

  it('plumbs valid independent trusted configuration into the canonical evaluator', async () => {
    const run = await createDir('pptx-sla-run-')
    const trusted = await createDir('pptx-sla-trusted-')
    const root = { approvedPolicyIdentity: 'test-policy', policy: { identity: 'test-policy', digest: sha('policy') }, publicKeys: {} }
    await writeJson(run, 'manifest.json', { claimLevel: 'original-recovery' })
    await writeJson(run, 'corpus-manifest.json', {})
    await writeJson(run, 'epoch-ledger.json', {})
    await writeJson(trusted, 'root.json', root)
    await writeJson(trusted, 'config.json', trustedConfig(root))
    let output = ''
    vi.spyOn(process.stdout, 'write').mockImplementation((value) => { output += value; return true })
    expect(await main(['--run-dir', run, '--trust-root', path.join(trusted, 'root.json'),
      '--trusted-config', path.join(trusted, 'config.json'), '--json'])).toBe(1)
    expect(JSON.parse(output).reasons).not.toContain('missing-trusted-config')
  })

  it('fails closed for malformed trusted configuration without an OfficeCLI invocation', async () => {
    const run = await createDir('pptx-sla-run-')
    const trusted = await createDir('pptx-sla-trusted-')
    await writeJson(run, 'manifest.json', {})
    await writeJson(run, 'corpus-manifest.json', {})
    await writeJson(run, 'epoch-ledger.json', {})
    await writeJson(trusted, 'root.json', {})
    await writeJson(trusted, 'config.json', { rootSha256: 'bad' })
    let output = ''
    vi.spyOn(process.stdout, 'write').mockImplementation((value) => { output += value; return true })
    expect(await main(['--run-dir', run, '--trust-root', path.join(trusted, 'root.json'),
      '--trusted-config', path.join(trusted, 'config.json'), '--json'])).toBe(1)
    expect(JSON.parse(output).reasons).toContain('missing-trusted-config')
  })
})

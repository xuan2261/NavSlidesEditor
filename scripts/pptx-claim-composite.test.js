import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { run } from './pptx-claim-composite.js'

const directories = []

async function temporaryFile(name, value) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-claim-script-'))
  directories.push(directory)
  const file = path.join(directory, name)
  await fs.writeFile(file, JSON.stringify(value))
  return file
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })))
})

describe('pptx claim composite script', () => {
  it('returns failure when required input is missing despite stderr backpressure', () => {
    vi.spyOn(process.stderr, 'write').mockReturnValue(false)
    expect(run(['--trusted-config', 'config.json'])).toBe(1)
    expect(run(['--input', 'input.json'])).toBe(1)
  })

  it('rejects ambiguous or malformed command arguments', () => {
    vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    expect(run(['--input'])).toBe(1)
    expect(run(['--input', 'input.json', '--verify', 'verify.json', '--trusted-config', 'config.json'])).toBe(1)
  })

  it('rejects an invalid external trusted configuration instead of using embedded input', async () => {
    const input = await temporaryFile('input.json', { trustedConfig: { rootSha256: 'a'.repeat(64) } })
    const config = await temporaryFile('config.json', {})
    vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    expect(run(['--input', input, '--trusted-config', config])).toBe(1)
  })

  it('delegates synthetic lanes to the canonical evaluator and fails closed', async () => {
    const input = await temporaryFile('input.json', {
      claimLevel: 'feature-editability', lanes: [{ lane: 'semantic', result: 'pass' }],
    })
    const config = await temporaryFile('config.json', {
      rootSha256: 'a'.repeat(64),
      policyIdentity: 'test-policy',
      authorityFingerprints: {
        ci: 'b'.repeat(64), provider: 'c'.repeat(64), ledger: 'd'.repeat(64),
      },
      ledgerCheckpoint: { identity: 'test-ledger', epoch: 0, digest: 'e'.repeat(64) },
    })
    let output = ''
    vi.spyOn(process.stdout, 'write').mockImplementation((value) => { output += value; return true })
    expect(run(['--input', input, '--trusted-config', config, '--json'])).toBe(1)
    expect(JSON.parse(output).reasons).toContain('missing-schema-version')
  })
})

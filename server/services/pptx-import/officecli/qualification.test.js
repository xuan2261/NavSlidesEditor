import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import manifest from './qualification-manifest.json'
import qualification from './qualification.js'

const { discoverConfiguredPath, qualifyOfficeCli, stageExecutionCopy, verifyExecutionCopy } = qualification
const VALID_PATH = 'C:\\Program Files\\OfficeCLI\\officecli.exe'
const roots = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

function validProbe(overrides = {}) {
  return {
    lstatFile: vi.fn(async () => ({ isFile: () => true, isSymbolicLink: () => false })),
    realpath: vi.fn(async (value) => value),
    statFile: vi.fn(async () => ({ isFile: () => true, size: manifest.releaseAsset.byteLength })),
    hashFile: vi.fn(async () => manifest.releaseAsset.sha256),
    ...overrides,
  }
}

describe('OfficeCLI candidate qualification', () => {
  it('reports absent and non-Windows candidates without consulting the filesystem', async () => {
    const probe = validProbe()
    await expect(qualifyOfficeCli({ env: { PATH: 'C:\\untrusted' }, platform: 'win32', probe }))
      .resolves.toMatchObject({ available: false, reason: 'not-configured' })
    await expect(qualifyOfficeCli({ env: { OFFICECLI_PATH: '/opt/officecli' }, platform: 'linux', probe }))
      .resolves.toMatchObject({ available: false, reason: 'unsupported-platform' })
    expect(probe.statFile).not.toHaveBeenCalled()
  })

  it.each([
    ['relative path', { env: { OFFICECLI_PATH: '.\\officecli.exe' }, probe: validProbe() }, 'path-not-absolute'],
    ['wrong hash', { env: { OFFICECLI_PATH: VALID_PATH }, probe: validProbe({ hashFile: vi.fn(async () => 'A'.repeat(64)) }) }, 'hash-mismatch'],
    ['wrong size', { env: { OFFICECLI_PATH: VALID_PATH }, probe: validProbe({ statFile: vi.fn(async () => ({ isFile: () => true, size: 1 })) }) }, 'size-mismatch'],
  ])('rejects %s', async (_label, args, reason) => {
    await expect(qualifyOfficeCli({ platform: 'win32', ...args })).resolves.toMatchObject({ available: false, reason })
  })

  it('qualifies only after a fresh direct version probe', async () => {
    const probeVersion = vi.fn(async () => ({ version: manifest.version, exitCode: 0, resultHash: 'C'.repeat(64) }))
    const probe = validProbe()
    const result = await qualifyOfficeCli({ env: { OFFICECLI_PATH: VALID_PATH }, platform: 'win32', probe, probeVersion })
    expect(result).toMatchObject({
      available: true,
      candidateAvailable: true,
      reason: 'direct-local-qualified',
      inspection: false,
      validation: true,
      mutation: false,
      candidate: { version: manifest.version, identity: { sha256: manifest.releaseAsset.sha256 } },
    })
    expect(probeVersion).toHaveBeenCalledOnce()
  })

  it('requires a fresh exact version probe and emits a direct-local receipt', async () => {
    const probeVersion = vi.fn(async () => ({ version: manifest.version, exitCode: 0, resultHash: 'A'.repeat(64) }))
    const result = await qualifyOfficeCli({
      env: { OFFICECLI_PATH: VALID_PATH },
      platform: 'win32',
      probe: validProbe(),
      probeVersion,
      matrixSubject: { schema: 'editability-matrix-v1', version: '1', sha256: 'B'.repeat(64) },
      now: () => '2026-07-18T00:00:00.000Z',
    })

    expect(probeVersion).toHaveBeenCalledWith(expect.objectContaining({ binary: VALID_PATH, operation: 'version' }))
    expect(result).toMatchObject({
      available: true,
      validation: true,
      receipt: {
        authority: 'local',
        operationPolicyVersion: expect.any(String),
        binary: { canonicalPath: VALID_PATH, sha256: manifest.releaseAsset.sha256, byteLength: manifest.releaseAsset.byteLength },
        version: manifest.version,
        matrixSubject: { sha256: 'B'.repeat(64) },
        limitations: expect.arrayContaining([
          'restricted-identity-not-proven',
          'launcher-identity-absent',
          'independent-descendant-containment-not-proven',
          'teardown-attestation-not-proven',
        ]),
      },
    })
  })

  it('stages a reverified content-addressed execution copy without executing the candidate', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'officecli-copy-'))
    roots.push(root)
    const source = path.join(root, 'administrator-officecli.exe')
    const bytes = Buffer.from('candidate-bytes')
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase()
    await fs.writeFile(source, bytes)
    const executionCopy = await stageExecutionCopy({ identity: { canonicalPath: source, sha256, size: bytes.length } }, { executionRoot: path.join(root, 'protected') })
    expect(executionCopy.canonicalPath).not.toBe(source)
    expect(executionCopy.sha256).toBe(sha256)
    expect(await verifyExecutionCopy(executionCopy)).toBe(true)
    await fs.writeFile(source, 'replaced')
    expect(await verifyExecutionCopy(executionCopy)).toBe(true)
  })

  it('reuses an existing verified immutable execution copy after restart', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'officecli-copy-reuse-'))
    roots.push(root)
    const source = path.join(root, 'administrator-officecli.exe')
    const bytes = Buffer.from('candidate-bytes')
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase()
    await fs.writeFile(source, bytes)
    const options = { executionRoot: path.join(root, 'protected') }
    const first = await stageExecutionCopy({ identity: { canonicalPath: source, sha256, size: bytes.length } }, options)
    const second = await stageExecutionCopy({ identity: { canonicalPath: source, sha256, size: bytes.length } }, options)
    expect(second).toEqual(first)
  })

  it('rejects pre-existing content-addressed execution targets instead of reusing them', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'officecli-copy-existing-'))
    roots.push(root)
    const source = path.join(root, 'administrator-officecli.exe')
    const bytes = Buffer.from('candidate-bytes')
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase()
    const executionRoot = path.join(root, 'protected')
    await fs.mkdir(path.join(executionRoot, sha256), { recursive: true })
    await fs.writeFile(source, bytes)

    await expect(stageExecutionCopy({ identity: { canonicalPath: source, sha256, size: bytes.length } }, { executionRoot }))
      .rejects.toMatchObject({ code: 'EXECUTION_COPY_EXISTS' })
  })

  it('rejects symbolic-link and multi-link execution copies', async () => {
    const executionCopy = { canonicalPath: 'C:\\private\\officecli.exe', sha256: 'A'.repeat(64), byteLength: 4 }
    const linkedProbe = {
      lstatFile: async () => ({ isSymbolicLink: () => true }),
      statFile: async () => ({ isFile: () => true, size: 4, nlink: 1 }),
      realpath: async (value) => value,
      hashFile: async () => executionCopy.sha256,
    }
    expect(await verifyExecutionCopy(executionCopy, { probe: linkedProbe })).toBe(false)

    const hardlinkProbe = {
      lstatFile: async () => ({ isSymbolicLink: () => false }),
      statFile: async () => ({ isFile: () => true, size: 4, nlink: 2 }),
      realpath: async (value) => value,
      hashFile: async () => executionCopy.sha256,
    }
    expect(await verifyExecutionCopy(executionCopy, { probe: hardlinkProbe })).toBe(false)
  })

  it('never treats a PATH entry or bare executable as discovery', () => {
    expect(discoverConfiguredPath({ env: { OFFICECLI_PATH: 'officecli.exe', PATH: path.dirname(VALID_PATH) }, platform: 'win32' })).toBeNull()
  })
})

describe('OfficeCLI immutable manifest', () => {
  it('pins exact upstream asset identity without distribution acquisition', () => {
    expect(manifest).toMatchObject({ version: '1.0.135', releaseAsset: { assetName: 'officecli-win-x64.exe', sha256: expect.stringMatching(/^[A-F0-9]{64}$/) }, distribution: { supportedPlatform: 'win32', bundled: false, runtimeDownload: false } })
  })
})

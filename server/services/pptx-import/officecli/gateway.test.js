import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import gatewayModule from './gateway.js'

const { createOfficeCliGateway, createRevisionDescriptor } = gatewayModule
const roots = []

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'officecli-gateway-'))
  roots.push(root)
  const bytes = Buffer.from('guarded-pptx')
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase()
  return { root, bytes, sha256, revision: createRevisionDescriptor({ id: 'revision-1', sha256: sha256.toLowerCase(), byteLength: bytes.length, safetyVerdict: { rawZipSafe: true, xmlSafe: true, verifiedSha256: sha256.toLowerCase() } }) }
}

function qualified(sha256, size) {
  const executionCopy = { canonicalPath: 'C:\\private\\officecli.exe', sha256, byteLength: size }
  return {
    available: true,
    candidate: { version: '1.0.135', identity: { sha256, size } },
    executionCopy,
    containmentReceipt: {
      kind: 'officecli-containment-receipt-v1',
      verdict: 'qualified',
      executionCopy,
      launcher: { sha256: 'launcher-sha', version: '1.0.0' },
      binary: { sha256, version: '1.0.135' },
      policyDigest: 'policy-sha',
    },
  }
}

function directQualified(sha256, size) {
  const binary = {
    canonicalPath: 'C:\\OfficeCli\\officecli-1.0.135-pinned-937db176.exe',
    sha256,
    byteLength: size,
    volumeIdentity: 'volume-1',
    fileId: 'file-1',
    linkCount: 1,
  }
  return {
    available: true,
    validation: true,
    candidate: { version: '1.0.135', identity: binary },
    receipt: {
      kind: 'officecli-direct-qualification-v1',
      authority: 'local',
      version: '1.0.135',
      binary,
    },
  }
}

afterEach(async () => { await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))) })

describe('contained OfficeCLI gateway', () => {
  it('starts only the freshly qualified canonical OfficeCLI binary with fixed direct validation arguments', async () => {
    const { root, bytes, revision, sha256 } = await fixture()
    const runOfficeCli = vi.fn(async () => ({ exitCode: 0, stdout: '{"valid":true}' }))
    const gateway = createOfficeCliGateway({
      workspaceRoot: root,
      platform: 'win32',
      qualification: async () => directQualified(sha256, bytes.length),
      readRevision: async () => bytes,
      runOfficeCli,
    })

    await expect(gateway.validatePackage(revision)).resolves.toMatchObject({ ok: true, data: { valid: true }, metrics: { direct: true } })
    expect(runOfficeCli).toHaveBeenCalledWith(expect.objectContaining({
      binary: 'C:\\OfficeCli\\officecli-1.0.135-pinned-937db176.exe',
      argv: expect.arrayContaining(['validate', '--json']),
    }))
  })

  it('runs only a typed validate request through the launcher', async () => {
    const { root, bytes, revision, sha256 } = await fixture()
    const launcherClient = { run: vi.fn(async () => ({ exitCode: 0, receipt: { ok: true } })) }
    const gateway = createOfficeCliGateway({ workspaceRoot: root, platform: 'win32', qualification: async () => qualified(sha256, bytes.length), readRevision: async () => bytes, launcherClient, executionCopyVerifier: async () => true })
    await expect(gateway.validatePackage(revision)).resolves.toMatchObject({ ok: true, data: { ok: true } })
    expect(launcherClient.run).toHaveBeenCalledWith(expect.objectContaining({ operation: 'validate', inputPath: expect.stringMatching(/input\.pptx$/) }))
  })

  it('rejects unavailable qualification before reading or creating a workspace', async () => {
    const { root, bytes, revision } = await fixture()
    const readRevision = vi.fn(async () => bytes)
    const gateway = createOfficeCliGateway({ workspaceRoot: root, platform: 'win32', qualification: async () => ({ available: false }), readRevision })
    await expect(gateway.validatePackage(revision)).rejects.toMatchObject({ code: 'QUALIFICATION_REQUIRED' })
    expect(readRevision).not.toHaveBeenCalled()
    expect(await fs.readdir(root)).toEqual([])
  })

  it('rejects candidate identity without a qualified containment receipt before reading or staging', async () => {
    const { root, bytes, revision, sha256 } = await fixture()
    const readRevision = vi.fn(async () => bytes)
    const candidateOnly = qualified(sha256, bytes.length)
    delete candidateOnly.containmentReceipt
    const gateway = createOfficeCliGateway({
      workspaceRoot: root,
      platform: 'win32',
      qualification: async () => candidateOnly,
      readRevision,
      launcherClient: { run: vi.fn() },
      executionCopyVerifier: async () => true,
    })
    await expect(gateway.validatePackage(revision)).rejects.toMatchObject({ code: 'QUALIFICATION_RECEIPT_REQUIRED' })
    expect(readRevision).not.toHaveBeenCalled()
    expect(await fs.readdir(root)).toEqual([])
  })

  it('rejects an invalid workspace root before reading the revision', async () => {
    const { bytes, revision, sha256 } = await fixture()
    const readRevision = vi.fn(async () => bytes)
    const gateway = createOfficeCliGateway({
      workspaceRoot: '',
      platform: 'win32',
      qualification: async () => qualified(sha256, bytes.length),
      readRevision,
      launcherClient: { run: vi.fn() },
      executionCopyVerifier: async () => true,
    })
    await expect(gateway.validatePackage(revision)).rejects.toMatchObject({ code: 'WORKSPACE_INVALID' })
    expect(readRevision).not.toHaveBeenCalled()
  })

  it('uses the receipt-bound execution copy when the qualification has no top-level copy', async () => {
    const { root, bytes, revision, sha256 } = await fixture()
    const qualifiedReceipt = qualified(sha256, bytes.length)
    delete qualifiedReceipt.executionCopy
    const launcherClient = { run: vi.fn(async () => ({ exitCode: 0, receipt: { ok: true } })) }
    const gateway = createOfficeCliGateway({
      workspaceRoot: root,
      platform: 'win32',
      qualification: async () => qualifiedReceipt,
      readRevision: async () => bytes,
      launcherClient,
      executionCopyVerifier: async () => true,
    })
    await expect(gateway.validatePackage(revision)).resolves.toMatchObject({ ok: true, data: { ok: true } })
    expect(launcherClient.run).toHaveBeenCalledOnce()
  })

  it('rechecks qualification so a revoked tuple cannot be reused', async () => {
    const { root, bytes, revision, sha256 } = await fixture()
    const qualify = vi.fn()
      .mockResolvedValueOnce(qualified(sha256, bytes.length))
      .mockResolvedValueOnce(qualified(sha256, bytes.length))
      .mockResolvedValueOnce({ available: false })
    const gateway = createOfficeCliGateway({
      workspaceRoot: root,
      platform: 'win32',
      qualification: qualify,
      readRevision: async () => bytes,
      launcherClient: { run: vi.fn(async () => ({ exitCode: 0, receipt: { ok: true } })) },
      executionCopyVerifier: async () => true,
    })
    await expect(gateway.validatePackage(revision)).resolves.toMatchObject({ ok: true })
    await expect(gateway.validatePackage(revision)).rejects.toMatchObject({ code: 'QUALIFICATION_REQUIRED' })
    expect(qualify).toHaveBeenCalledTimes(3)
  })

  it('rechecks qualification after a queued admission wait', async () => {
    const { root, bytes, revision, sha256 } = await fixture()
    let releaseAdmission
    let current = qualified(sha256, bytes.length)
    const qualify = vi.fn(async () => current)
    const launcherClient = { run: vi.fn(async () => ({ exitCode: 0, receipt: { ok: true } })) }
    const gateway = createOfficeCliGateway({
      workspaceRoot: root,
      platform: 'win32',
      qualification: qualify,
      readRevision: async () => bytes,
      launcherClient,
      executionCopyVerifier: async () => true,
      admission: { reserve: vi.fn(() => new Promise((resolve) => { releaseAdmission = resolve })) },
    })
    const pending = gateway.validatePackage(revision)
    await vi.waitFor(() => expect(releaseAdmission).toEqual(expect.any(Function)))
    current = { available: false }
    releaseAdmission(() => {})
    await expect(pending).rejects.toMatchObject({ code: 'QUALIFICATION_REQUIRED' })
    expect(launcherClient.run).not.toHaveBeenCalled()
    expect(qualify).toHaveBeenCalledOnce()
  })

  it('cancels queued validation during shutdown before launcher creation', async () => {
    const { root, bytes, revision, sha256 } = await fixture()
    let releaseAdmission
    let reserveSignal
    const launcherClient = { run: vi.fn() }
    const gateway = createOfficeCliGateway({
      workspaceRoot: root,
      platform: 'win32',
      qualification: async () => qualified(sha256, bytes.length),
      readRevision: async () => bytes,
      launcherClient,
      executionCopyVerifier: async () => true,
      admission: { reserve: vi.fn(({ signal }) => new Promise((resolve) => {
        reserveSignal = signal
        releaseAdmission = resolve
      })) },
    })
    const pending = gateway.validatePackage(revision)
    await vi.waitFor(() => expect(releaseAdmission).toEqual(expect.any(Function)))
    const shutdown = gateway.shutdown()
    await vi.waitFor(() => expect(reserveSignal.aborted).toBe(true))
    releaseAdmission(() => {})
    await shutdown
    await expect(pending).rejects.toBeInstanceOf(Error)
    expect(launcherClient.run).not.toHaveBeenCalled()
  })

  it('disables all OfficeCLI work on non-Windows before reading, workspace, or process launch', async () => {
    const { root, bytes, revision } = await fixture()
    const readRevision = vi.fn(async () => bytes)
    const launcherClient = { run: vi.fn() }
    const gateway = createOfficeCliGateway({ workspaceRoot: root, platform: 'linux', qualification: vi.fn(), readRevision, launcherClient })
    await expect(gateway.validatePackage(revision)).rejects.toMatchObject({ code: 'CAPABILITY_UNAVAILABLE' })
    expect(readRevision).not.toHaveBeenCalled()
    expect(launcherClient.run).not.toHaveBeenCalled()
    expect(await fs.readdir(root)).toEqual([])
  })

  it('releases admission even when workspace cleanup fails', async () => {
    const { root, bytes, revision, sha256 } = await fixture()
    const release = vi.fn()
    const gateway = createOfficeCliGateway({
      workspaceRoot: root, platform: 'win32', qualification: async () => qualified(sha256, bytes.length), readRevision: async () => bytes,
      launcherClient: { run: vi.fn(async () => ({ exitCode: 0, receipt: { ok: true } })) }, executionCopyVerifier: async () => true,
      admission: { reserve: vi.fn(async () => release) }, cleanupWorkspace: async () => { throw new Error('cleanup failed') },
    })
    await expect(gateway.validatePackage(revision)).rejects.toThrow('cleanup failed')
    expect(release).toHaveBeenCalledOnce()
  })

  it('aborts an active launcher request during shutdown', async () => {
    const { root, bytes, revision, sha256 } = await fixture()
    let signal
    const launcherClient = { run: vi.fn(({ signal: requestSignal }) => new Promise((resolve, reject) => {
      signal = requestSignal
      requestSignal.addEventListener('abort', () => reject(requestSignal.reason), { once: true })
    })) }
    const gateway = createOfficeCliGateway({ workspaceRoot: root, platform: 'win32', qualification: async () => qualified(sha256, bytes.length), readRevision: async () => bytes, launcherClient, executionCopyVerifier: async () => true })
    const pending = gateway.validatePackage(revision)
    await vi.waitFor(() => expect(launcherClient.run).toHaveBeenCalledOnce())
    await gateway.shutdown()
    await expect(pending).rejects.toBe(signal.reason)
    expect(signal.aborted).toBe(true)
  })

  it('waits for active cleanup and closes the gateway before returning', async () => {
    const { root, bytes, revision, sha256 } = await fixture()
    let drained = false
    const launcherClient = { run: vi.fn(({ signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => {
        setTimeout(() => {
          drained = true
          reject(new Error('launcher drained'))
        }, 40)
      }, { once: true })
    })) }
    const gateway = createOfficeCliGateway({
      workspaceRoot: root,
      platform: 'win32',
      qualification: async () => qualified(sha256, bytes.length),
      readRevision: async () => bytes,
      launcherClient,
      executionCopyVerifier: async () => true,
    })
    const pending = gateway.validatePackage(revision)
    await vi.waitFor(() => expect(launcherClient.run).toHaveBeenCalledOnce())
    await gateway.shutdown()
    expect(drained).toBe(true)
    await expect(pending).rejects.toThrow('launcher drained')
    await expect(gateway.validatePackage(revision)).rejects.toMatchObject({ code: 'GATEWAY_CLOSED' })
  })

  it('keeps inspection and mutation unavailable while direct edit adapters are not integrated', async () => {
    const { root, bytes, revision, sha256 } = await fixture()
    const gateway = createOfficeCliGateway({ workspaceRoot: root, platform: 'win32', qualification: async () => qualified(sha256, bytes.length), readRevision: async () => bytes, executionCopyVerifier: async () => true })
    await expect(gateway.inspectPresentation(revision, { slide: 1 })).rejects.toMatchObject({ code: 'INSPECTION_UNAVAILABLE' })
    await expect(gateway.applyTextPatch(revision, {})).rejects.toMatchObject({ code: 'MUTATION_DISABLED' })
    expect(await fs.readdir(root)).toEqual([])
  })
})

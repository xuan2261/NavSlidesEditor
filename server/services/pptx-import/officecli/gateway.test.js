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
  return directQualified(sha256, size)
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
  it('fails before staging when the immutable input exceeds the configured resource budget', async () => {
    const { root, bytes, revision, sha256 } = await fixture()
    const readRevision = vi.fn(async () => bytes)
    const runOfficeCli = vi.fn()
    const gateway = createOfficeCliGateway({
      workspaceRoot: root,
      platform: 'win32',
      qualification: async () => directQualified(sha256, bytes.length),
      readRevision,
      runOfficeCli,
      limits: { maxInputBytes: bytes.length - 1 },
    })

    await expect(gateway.validatePackage(revision)).rejects.toMatchObject({ code: 'INPUT_LIMIT_EXCEEDED' })
    expect(runOfficeCli).not.toHaveBeenCalled()
    expect(await fs.readdir(root)).toEqual([])
  })

  it('never treats zero exit with a failed validation result as success', async () => {
    const { root, bytes, revision, sha256 } = await fixture()
    const gateway = createOfficeCliGateway({
      workspaceRoot: root,
      platform: 'win32',
      qualification: async () => directQualified(sha256, bytes.length),
      readRevision: async () => bytes,
      runOfficeCli: async () => ({ exitCode: 0, stdout: '{"valid":false}' }),
    })

    await expect(gateway.validatePackage(revision)).rejects.toMatchObject({ code: 'OUTPUT_INVALID' })
  })

  it('quarantines an uncleaned workspace and returns one cleanup-uncertain failure', async () => {
    const { root, bytes, revision, sha256 } = await fixture()
    const gateway = createOfficeCliGateway({
      workspaceRoot: root,
      platform: 'win32',
      qualification: async () => directQualified(sha256, bytes.length),
      readRevision: async () => bytes,
      runOfficeCli: async () => ({ exitCode: 0, stdout: '{"valid":true}' }),
      cleanupWorkspace: async () => { throw new Error('cleanup failed') },
    })

    await expect(gateway.validatePackage(revision)).rejects.toMatchObject({ code: 'CLEANUP_UNCERTAIN' })
  })

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

  it('does not accept a legacy launcher qualification as executable authority', async () => {
    const { root, bytes, revision, sha256 } = await fixture()
    const launcherClient = { run: vi.fn(async () => ({ exitCode: 0, receipt: { ok: true } })) }
    const legacy = {
      available: true,
      candidate: { version: '1.0.135', identity: { canonicalPath: 'C:\\private\\officecli.exe', sha256, byteLength: bytes.length } },
      containmentReceipt: { kind: 'officecli-containment-receipt-v1' },
    }
    const gateway = createOfficeCliGateway({ workspaceRoot: root, platform: 'win32', qualification: async () => legacy, readRevision: async () => bytes, launcherClient })
    await expect(gateway.validatePackage(revision)).rejects.toMatchObject({ code: 'QUALIFICATION_REQUIRED' })
    expect(launcherClient.run).not.toHaveBeenCalled()
  })

  it('rejects unavailable qualification before reading or creating a workspace', async () => {
    const { root, bytes, revision } = await fixture()
    const readRevision = vi.fn(async () => bytes)
    const gateway = createOfficeCliGateway({ workspaceRoot: root, platform: 'win32', qualification: async () => ({ available: false }), readRevision })
    await expect(gateway.validatePackage(revision)).rejects.toMatchObject({ code: 'QUALIFICATION_REQUIRED' })
    expect(readRevision).not.toHaveBeenCalled()
    expect(await fs.readdir(root)).toEqual([])
  })

  it('rejects a direct candidate without its current local receipt before reading or staging', async () => {
    const { root, bytes, revision, sha256 } = await fixture()
    const readRevision = vi.fn(async () => bytes)
    const candidateOnly = qualified(sha256, bytes.length)
    delete candidateOnly.receipt
    const gateway = createOfficeCliGateway({
      workspaceRoot: root,
      platform: 'win32',
      qualification: async () => candidateOnly,
      readRevision,
    })
    await expect(gateway.validatePackage(revision)).rejects.toMatchObject({ code: 'QUALIFICATION_REQUIRED' })
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

  it('uses only the canonical direct binary bound to the local receipt', async () => {
    const { root, bytes, revision, sha256 } = await fixture()
    const qualifiedReceipt = qualified(sha256, bytes.length)
    const runOfficeCli = vi.fn(async () => ({ exitCode: 0, stdout: '{"valid":true}' }))
    const gateway = createOfficeCliGateway({
      workspaceRoot: root,
      platform: 'win32',
      qualification: async () => qualifiedReceipt,
      readRevision: async () => bytes,
      runOfficeCli,
    })
    await expect(gateway.validatePackage(revision)).resolves.toMatchObject({ ok: true, data: { valid: true } })
    expect(runOfficeCli).toHaveBeenCalledWith(expect.objectContaining({ binary: qualifiedReceipt.receipt.binary.canonicalPath }))
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
      runOfficeCli: async () => ({ exitCode: 0, stdout: '{"valid":true}' }),
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
    const runOfficeCli = vi.fn(async () => ({ exitCode: 0, stdout: '{"valid":true}' }))
    const gateway = createOfficeCliGateway({
      workspaceRoot: root,
      platform: 'win32',
      qualification: qualify,
      readRevision: async () => bytes,
      runOfficeCli,
      admission: { reserve: vi.fn(() => new Promise((resolve) => { releaseAdmission = resolve })) },
    })
    const pending = gateway.validatePackage(revision)
    await vi.waitFor(() => expect(releaseAdmission).toEqual(expect.any(Function)))
    current = { available: false }
    releaseAdmission(() => {})
    await expect(pending).rejects.toMatchObject({ code: 'QUALIFICATION_REQUIRED' })
    expect(runOfficeCli).not.toHaveBeenCalled()
    expect(qualify).toHaveBeenCalledOnce()
  })

  it('cancels queued validation during shutdown before launcher creation', async () => {
    const { root, bytes, revision, sha256 } = await fixture()
    let releaseAdmission
    let reserveSignal
    const runOfficeCli = vi.fn()
    const gateway = createOfficeCliGateway({
      workspaceRoot: root,
      platform: 'win32',
      qualification: async () => qualified(sha256, bytes.length),
      readRevision: async () => bytes,
      runOfficeCli,
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
    expect(runOfficeCli).not.toHaveBeenCalled()
  })

  it('disables all OfficeCLI work on non-Windows before reading, workspace, or process launch', async () => {
    const { root, bytes, revision } = await fixture()
    const readRevision = vi.fn(async () => bytes)
    const runOfficeCli = vi.fn()
    const gateway = createOfficeCliGateway({ workspaceRoot: root, platform: 'linux', qualification: vi.fn(), readRevision, runOfficeCli })
    await expect(gateway.validatePackage(revision)).rejects.toMatchObject({ code: 'CAPABILITY_UNAVAILABLE' })
    expect(readRevision).not.toHaveBeenCalled()
    expect(runOfficeCli).not.toHaveBeenCalled()
    expect(await fs.readdir(root)).toEqual([])
  })

  it('releases admission even when workspace cleanup fails', async () => {
    const { root, bytes, revision, sha256 } = await fixture()
    const release = vi.fn()
    const gateway = createOfficeCliGateway({
      workspaceRoot: root, platform: 'win32', qualification: async () => qualified(sha256, bytes.length), readRevision: async () => bytes,
      runOfficeCli: async () => ({ exitCode: 0, stdout: '{"valid":true}' }),
      admission: { reserve: vi.fn(async () => release) }, cleanupWorkspace: async () => { throw new Error('cleanup failed') },
    })
    await expect(gateway.validatePackage(revision)).rejects.toMatchObject({ code: 'CLEANUP_UNCERTAIN' })
    expect(release).toHaveBeenCalledOnce()
  })

  it('aborts an active direct request during shutdown', async () => {
    const { root, bytes, revision, sha256 } = await fixture()
    let signal
    const runOfficeCli = vi.fn(({ signal: requestSignal }) => new Promise((resolve, reject) => {
      signal = requestSignal
      requestSignal.addEventListener('abort', () => reject(requestSignal.reason), { once: true })
    }))
    const gateway = createOfficeCliGateway({ workspaceRoot: root, platform: 'win32', qualification: async () => qualified(sha256, bytes.length), readRevision: async () => bytes, runOfficeCli })
    const pending = gateway.validatePackage(revision)
    await vi.waitFor(() => expect(runOfficeCli).toHaveBeenCalledOnce())
    await gateway.shutdown()
    await expect(pending).rejects.toBe(signal.reason)
    expect(signal.aborted).toBe(true)
  })

  it('waits for active direct request cleanup before returning', async () => {
    const { root, bytes, revision, sha256 } = await fixture()
    let drained = false
    const runOfficeCli = vi.fn(({ signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => {
        setTimeout(() => {
          drained = true
          reject(new Error('launcher drained'))
        }, 40)
      }, { once: true })
    }))
    const gateway = createOfficeCliGateway({
      workspaceRoot: root,
      platform: 'win32',
      qualification: async () => qualified(sha256, bytes.length),
      readRevision: async () => bytes,
      runOfficeCli,
    })
    const pending = gateway.validatePackage(revision)
    await vi.waitFor(() => expect(runOfficeCli).toHaveBeenCalledOnce())
    await gateway.shutdown()
    expect(drained).toBe(true)
    await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' })
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

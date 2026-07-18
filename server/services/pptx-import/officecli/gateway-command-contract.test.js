import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import gatewayModule from './gateway.js'

const { createOfficeCliGateway, createRevisionDescriptor } = gatewayModule
const roots = []

async function setup() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'officecli-contract-'))
  roots.push(root)
  const bytes = Buffer.from('guarded-pptx')
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase()
  const revision = createRevisionDescriptor({ id: 'r1', sha256: sha256.toLowerCase(), byteLength: bytes.length, safetyVerdict: { rawZipSafe: true, xmlSafe: true, verifiedSha256: sha256.toLowerCase() } })
  const executionCopy = { canonicalPath: 'C:\\protected\\officecli.exe', sha256, byteLength: bytes.length }
  const qualification = {
    available: true,
    candidate: { version: '1.0.135', identity: { sha256, size: bytes.length } },
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
  return { root, bytes, revision, qualification }
}
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))) })

describe('OfficeCLI command contract', () => {
  it('passes no arbitrary argv, path, or environment across its public boundary', async () => {
    const { root, bytes, revision, qualification } = await setup()
    const launcherClient = { run: vi.fn(async () => ({ exitCode: 0, receipt: { ok: true } })) }
    const gateway = createOfficeCliGateway({ workspaceRoot: root, platform: 'win32', qualification: async () => qualification, readRevision: async () => bytes, launcherClient, executionCopyVerifier: async () => true })
    expect('execute' in gateway).toBe(false)
    await gateway.validatePackage(revision)
    expect(launcherClient.run).toHaveBeenCalledWith(expect.objectContaining({ operation: 'validate', inputPath: expect.stringMatching(/input\.pptx$/) }))
    expect(launcherClient.run.mock.calls[0][0]).not.toHaveProperty('argv')
  })

  it('fails rendering and inspection before a workspace or process call', async () => {
    const { root, bytes, revision, qualification } = await setup()
    const launcherClient = { run: vi.fn() }
    const gateway = createOfficeCliGateway({ workspaceRoot: root, platform: 'win32', qualification: async () => qualification, readRevision: async () => bytes, launcherClient, executionCopyVerifier: async () => true })
    await expect(gateway.renderInformativePreview(revision)).rejects.toMatchObject({ code: 'RENDERING_UNAVAILABLE' })
    await expect(gateway.readRawPart(revision, 'ppt/slides/slide1.xml')).rejects.toMatchObject({ code: 'INSPECTION_UNAVAILABLE' })
    expect(launcherClient.run).not.toHaveBeenCalled()
    expect(await fs.readdir(root)).toEqual([])
  })
})

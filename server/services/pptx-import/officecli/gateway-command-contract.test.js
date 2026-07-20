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
  const binary = {
    canonicalPath: 'C:\\OfficeCli\\officecli-1.0.135-pinned-937db176.exe',
    sha256,
    byteLength: bytes.length,
    volumeIdentity: 'volume-1',
    fileId: 'file-1',
    linkCount: 1,
  }
  const qualification = {
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
  return { root, bytes, revision, qualification }
}
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))) })

describe('OfficeCLI command contract', () => {
  it('passes no arbitrary argv, path, or environment across its public boundary', async () => {
    const { root, bytes, revision, qualification } = await setup()
    const runOfficeCli = vi.fn(async () => ({ exitCode: 0, stdout: '{"valid":true}' }))
    const gateway = createOfficeCliGateway({
      workspaceRoot: root,
      platform: 'win32',
      qualification: async () => qualification,
      readRevision: async () => bytes,
      runOfficeCli,
    })
    expect('execute' in gateway).toBe(false)
    await gateway.validatePackage(revision, {
      binary: 'C:\\attacker.exe',
      argv: ['--unsafe'],
      env: { SECRET: 'leak' },
      inputPath: 'C:\\attacker.pptx',
    })
    const request = runOfficeCli.mock.calls[0][0]
    expect(request).toMatchObject({
      binary: qualification.receipt.binary.canonicalPath,
      argv: ['validate', expect.stringMatching(/input\.pptx$/), '--json'],
    })
    expect(request.argv).toHaveLength(3)
    expect(request).not.toHaveProperty('operation')
    expect(request).not.toHaveProperty('env')
  })

  it('fails rendering and inspection before a workspace or process call', async () => {
    const { root, bytes, revision, qualification } = await setup()
    const runOfficeCli = vi.fn()
    const gateway = createOfficeCliGateway({ workspaceRoot: root, platform: 'win32', qualification: async () => qualification, readRevision: async () => bytes, runOfficeCli })
    await expect(gateway.renderInformativePreview(revision)).rejects.toMatchObject({ code: 'RENDERING_UNAVAILABLE' })
    await expect(gateway.readRawPart(revision, 'ppt/slides/slide1.xml')).rejects.toMatchObject({ code: 'INSPECTION_UNAVAILABLE' })
    expect(runOfficeCli).not.toHaveBeenCalled()
    expect(await fs.readdir(root)).toEqual([])
  })
})

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import manifest from './qualification-manifest.json'
import harness from '../../../../scripts/officecli/run-physical-feasibility.mjs'

const ROOT = path.resolve(import.meta.dirname, '../../../..')
const FIXTURES = path.join(ROOT, 'server/data/test-corpus/adversarial')
const roots = []

function requestOptions(root) {
  return {
    binary: 'C:\\admin\\officecli.exe',
    valid: path.join(FIXTURES, 'good-package.pptx'),
    malformed: ['bad-crc.pptx', 'malformed-xml.pptx'].map((name) => path.join(FIXTURES, name)),
    acquiredAt: '2026-09-25T00:00:00.000Z',
    ...(root && {
      executionRoot: path.join(root, 'execution'),
      workspaceRoot: path.join(root, 'workspace'),
    }),
  }
}

function reviewedManifest() {
  return {
    ...manifest,
    license: {
      ...manifest.license,
      textSha256: 'A'.repeat(64),
      upstreamNoticeStatus: 'absent',
      redistributionReviewStatus: 'reviewed-not-bundled',
    },
    provenance: {
      acquisitionTimestampRequired: true,
      releaseCommitVerified: true,
      checksumManifestVerified: true,
    },
  }
}

function safeProbe() {
  return {
    lstatFile: vi.fn(async () => ({
      isFile: () => true,
      isSymbolicLink: () => false,
      isReparsePoint: () => false,
    })),
    realpath: vi.fn(async (value) => value),
    statFile: vi.fn(async () => ({
      isFile: () => true,
      isReparsePoint: () => false,
      size: manifest.releaseAsset.byteLength,
      nlink: 1,
      dev: 1,
      ino: 2,
    })),
    hashFile: vi.fn(async () => manifest.releaseAsset.sha256),
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

describe('OfficeCLI physical feasibility harness', () => {
  it('fails closed before process work when physical prerequisites are absent', async () => {
    const runBoundedProcess = vi.fn()
    await expect(harness.runPhysicalFeasibility({}, { runBoundedProcess }))
      .rejects.toMatchObject({ code: 'PHYSICAL_PREREQUISITE_MISSING' })
    expect(runBoundedProcess).not.toHaveBeenCalled()
  })

  it('blocks unresolved legal and provenance fields before inspecting or running a binary', async () => {
    const inspectBinary = vi.fn()
    const unresolved = { ...manifest, license: { ...manifest.license, textSha256: undefined } }
    await expect(harness.runPhysicalFeasibility(requestOptions(), { manifest: unresolved, inspectBinary }))
      .rejects.toMatchObject({ code: 'LEGAL_PROVENANCE_UNRESOLVED' })
    expect(inspectBinary).not.toHaveBeenCalled()
  })

  it.each([
    ['hash', 'B'.repeat(64), manifest.releaseAsset.byteLength],
    ['length', manifest.releaseAsset.sha256, 1],
  ])('rejects wrong binary %s before staging', async (_case, sha256, byteLength) => {
    const stageExecutionCopy = vi.fn()
    await expect(harness.runPhysicalFeasibility(requestOptions(), {
      manifest: reviewedManifest(), stageExecutionCopy,
      inspectBinary: vi.fn(async () => ({ canonicalPath: 'C:\\admin\\officecli.exe', sha256, byteLength })),
    })).rejects.toMatchObject({ code: 'BINARY_IDENTITY_MISMATCH' })
    expect(stageExecutionCopy).not.toHaveBeenCalled()
  })

  it('uses production qualification and gateway contracts through safe process seams', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'officecli-feasibility-'))
    roots.push(root)
    const staged = 'C:\\staged\\937DB176\\officecli.exe'
    const runBoundedProcess = vi.fn(async ({ argv }) => argv[0] === '--version'
      ? { exitCode: 0, stdout: `${manifest.version}\n`, stderr: '' }
      : { exitCode: 0, stdout: '{"valid":true}', stderr: '' })
    const result = await harness.runPhysicalFeasibility(requestOptions(root), {
      evidenceMode: 'test-double',
      manifest: reviewedManifest(),
      probe: safeProbe(),
      inspectBinary: vi.fn(async () => ({
        canonicalPath: 'C:\\admin\\officecli.exe',
        sha256: manifest.releaseAsset.sha256,
        byteLength: manifest.releaseAsset.byteLength,
      })),
      stageExecutionCopy: vi.fn(async () => ({
        canonicalPath: staged,
        sha256: manifest.releaseAsset.sha256,
        byteLength: manifest.releaseAsset.byteLength,
      })),
      runBoundedProcess,
    })

    expect(result).toMatchObject({
      schemaVersion: 1,
      status: 'test-only',
      authoritative: false,
      binary: { version: manifest.version, sha256: manifest.releaseAsset.sha256 },
      processPolicy: { stdoutBounded: true, stderrBounded: true, pathLookup: false },
      fixtures: [
        {
          name: 'good-package.pptx', actual: 'accepted',
          validationPath: 'production-preflight-and-gateway', ok: true,
        },
        {
          name: 'bad-crc.pptx', actual: 'rejected',
          validationPath: 'production-preflight', reasonCode: 'zip-crc-mismatch', ok: true,
        },
        {
          name: 'malformed-xml.pptx', actual: 'rejected',
          validationPath: 'production-preflight', reasonCode: 'xml-dtd-prohibited', ok: true,
        },
      ],
    })
    expect(runBoundedProcess.mock.calls.some(([request]) => request.argv[0] === '--version')).toBe(true)
    expect(runBoundedProcess.mock.calls.filter(([request]) => request.argv[0] === 'validate')).toHaveLength(1)
    expect(result.processes).toEqual(expect.arrayContaining([
      expect.objectContaining({ operation: 'version', exitCode: 0, stdoutBytes: expect.any(Number) }),
      expect.objectContaining({ operation: 'validate', exitCode: 0, stdoutSha256: expect.stringMatching(/^[A-F0-9]{64}$/) }),
    ]))
  })

  it('fails qualification on real-output version drift', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'officecli-version-drift-'))
    roots.push(root)
    await expect(harness.runPhysicalFeasibility(requestOptions(root), {
      manifest: reviewedManifest(),
      probe: safeProbe(),
      inspectBinary: vi.fn(async () => ({
        canonicalPath: 'C:\\admin\\officecli.exe',
        sha256: manifest.releaseAsset.sha256,
        byteLength: manifest.releaseAsset.byteLength,
      })),
      stageExecutionCopy: vi.fn(async () => ({
        canonicalPath: 'C:\\staged\\officecli.exe',
        sha256: manifest.releaseAsset.sha256,
        byteLength: manifest.releaseAsset.byteLength,
      })),
      runBoundedProcess: vi.fn(async () => ({ exitCode: 0, stdout: '9.9.9', stderr: '' })),
    })).rejects.toMatchObject({ code: 'OFFICECLI_VERSION_MISMATCH' })
  })

  it('rejects receipts containing absolute paths or raw process output', () => {
    expect(() => harness.assertSafeReceipt({ configuredPath: 'C:\\secret\\officecli.exe' }))
      .toThrow(/receipt/i)
    expect(() => harness.assertSafeReceipt({ stdout: '{"valid":true}' }))
      .toThrow(/receipt/i)
  })

})

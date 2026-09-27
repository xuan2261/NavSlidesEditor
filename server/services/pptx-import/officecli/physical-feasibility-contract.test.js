import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'
import manifest from './qualification-manifest.json'
import { assertAuthoritativeReceipt } from '../../../../scripts/officecli/physical-feasibility-receipt.mjs'
import {
  assertPrerequisites,
  inspectPinnedBinary,
  validateFixture,
} from '../../../../scripts/officecli/physical-feasibility-support.mjs'

const execFileAsync = promisify(execFile)
const ROOT = path.resolve(import.meta.dirname, '../../../..')
const SCRIPT = path.join(ROOT, 'scripts/officecli/run-physical-feasibility.mjs')
const REPORTS = path.join(
  ROOT,
  'plans/260925-0631-single-user-powerpoint-native-fidelity-release-deep-tdd/reports'
)
const RECEIPT = path.join(REPORTS, 'officecli-physical-feasibility.json')
const GOVERNANCE = path.join(REPORTS, 'release-scope-manifest.json')
const RECEIPT_FIXTURES = [
  {
    name: 'officecli-positive-powerpoint-16.pptx',
    sha256: '29B2D6F12E922204C4A914D3C3BC427FF48B0915231DFF37DCF3F91A21D00FC2',
    actual: 'accepted',
    validationPath: 'production-preflight-and-gateway',
    reasonCode: null,
    exitCode: 0,
    ok: true,
  },
  {
    name: 'bad-crc.pptx',
    sha256: '9D572715870493397798E82473593F4CF373B01DDDEB8175EAB034C131274607',
    actual: 'rejected',
    validationPath: 'production-preflight',
    reasonCode: 'zip-crc-mismatch',
    exitCode: null,
    ok: true,
  },
  {
    name: 'malformed-xml.pptx',
    sha256: '4F3B3BC9E807BAF99ECD2C462BBB95D7212457AC24CA424B69903DF73425E55C',
    actual: 'rejected',
    validationPath: 'production-preflight',
    reasonCode: 'xml-dtd-prohibited',
    exitCode: null,
    ok: true,
  },
]

function authoritativeReceipt(fixtures = RECEIPT_FIXTURES) {
  const processEvidence = (operation) => ({
    operation,
    exitCode: 0,
    stdoutBytes: 1,
    stderrBytes: 0,
    durationMs: 1,
    stdoutSha256: 'A'.repeat(64),
    stderrSha256: 'B'.repeat(64),
  })
  return {
    schemaVersion: 2,
    status: 'passed',
    authoritative: true,
    claimScope: 'local-physical-feasibility',
    // Synthetic validator input only; never persist it as physical evidence.
    acquiredAt: '2000-01-01T00:00:00.000Z',
    subject: {
      commit: 'a'.repeat(40),
      worktree: { clean: true, trackedClean: true, untrackedClean: true },
    },
    upstream: {
      releasePage: manifest.upstream.releasePage,
      assetUrl: manifest.releaseAsset.sourceAssetUrl,
    },
    legal: {
      spdx: manifest.license.spdx,
      licenseTextSha256: manifest.license.textSha256,
      upstreamNoticeStatus: manifest.license.upstreamNoticeStatus,
      redistributionReviewStatus: manifest.license.redistributionReviewStatus,
    },
    binary: {
      version: manifest.version,
      sha256: manifest.releaseAsset.sha256,
      byteLength: manifest.releaseAsset.byteLength,
    },
    processPolicy: {
      stdoutBounded: true,
      stderrBounded: true,
      shellDisabled: true,
      runtimeDownload: false,
      pathLookup: false,
      memoryLimitEnforced: false,
      descendantProcessLimitEnforced: false,
      limitations: ['memory-limit-unproven', 'descendant-containment-unproven'],
    },
    executionContext: {
      account: 'invoking-account',
      accountIsolationClaim: false,
      egressDenialClaim: false,
      containmentClaim: false,
      riskCode: 'invoking-account-file-and-network-access',
    },
    processes: [
      processEvidence('version'),
      processEvidence('version'),
      processEvidence('version'),
      processEvidence('validate'),
    ],
    host: { platform: 'win32', release: '10.0', arch: 'x64', identityHash: 'C'.repeat(64) },
    fixtures: fixtures.map((fixture) => ({ ...fixture })),
    durationMs: 1,
  }
}

describe('OfficeCLI fixture receipt integrity', () => {
  it('accepts the new pinned positive plus both malformed fixture identities', () => {
    expect(() =>
      assertAuthoritativeReceipt(authoritativeReceipt(), manifest, 'a'.repeat(40))
    ).not.toThrow()
    const failedPositive = authoritativeReceipt()
    failedPositive.fixtures[0].exitCode = 1
    expect(() => assertAuthoritativeReceipt(failedPositive, manifest, 'a'.repeat(40))).toThrow()
  })
  it('requires independent clean source identity before accepting physical evidence', () => {
    const receipt = authoritativeReceipt()
    receipt.subject = {
      commit: 'a'.repeat(40),
      worktree: { clean: true, trackedClean: true, untrackedClean: true },
    }
    expect(() => assertAuthoritativeReceipt(receipt, manifest)).toThrow(/expected source/i)
    expect(() => assertAuthoritativeReceipt(receipt, manifest, 'b'.repeat(40))).toThrow(
      /source subject/i
    )
    delete receipt.subject
    expect(() => assertAuthoritativeReceipt(receipt, manifest, 'a'.repeat(40))).toThrow(
      /source subject/i
    )
  })

  it('rejects legacy or release-wide authority claims from local feasibility', () => {
    const legacy = authoritativeReceipt()
    legacy.schemaVersion = 1
    expect(() => assertAuthoritativeReceipt(legacy, manifest, 'a'.repeat(40))).toThrow(
      /authoritative/i
    )

    const overclaim = authoritativeReceipt()
    overclaim.claimScope = 'release'
    expect(() => assertAuthoritativeReceipt(overclaim, manifest, 'a'.repeat(40))).toThrow(/scope/i)
  })

  it('rejects a physical receipt that hides or falsely claims account and network isolation', () => {
    const missing = authoritativeReceipt()
    delete missing.executionContext
    expect(() => assertAuthoritativeReceipt(missing, manifest, 'a'.repeat(40))).toThrow(
      /execution context/i
    )

    const falseClaim = authoritativeReceipt()
    falseClaim.executionContext.egressDenialClaim = true
    expect(() => assertAuthoritativeReceipt(falseClaim, manifest, 'a'.repeat(40))).toThrow(
      /execution context/i
    )
  })

  it('rejects three copies of the pinned positive fixture instead of duplicate coverage', () => {
    const positive = RECEIPT_FIXTURES[0]
    const repeated = authoritativeReceipt([positive, positive, positive])
    expect(() => assertAuthoritativeReceipt(repeated, manifest, 'a'.repeat(40))).toThrow(
      /duplicated/i
    )
  })

  it('keeps the synthetic good-package outside physical positive prerequisites', () => {
    expect(() =>
      assertPrerequisites({
        binary: 'C:\\admin\\officecli.exe',
        valid: path.join(ROOT, 'server/data/test-corpus/adversarial/good-package.pptx'),
        malformed: [
          path.join(ROOT, 'server/data/test-corpus/adversarial/bad-crc.pptx'),
          path.join(ROOT, 'server/data/test-corpus/adversarial/malformed-xml.pptx'),
        ],
        acquiredAt: '2000-01-01T00:00:00.000Z',
      })
    ).toThrow(/Pinned feasibility fixtures/)
  })

  it('rejects a configured alternate data stream before inspecting or staging it', async () => {
    await expect(
      inspectPinnedBinary('C:\\admin\\officecli.exe:payload', manifest)
    ).rejects.toMatchObject({ code: 'BINARY_PATH_INVALID' })
  })

  it('rejects positive gateway success with a nonzero process exit code', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'officecli-positive-exit-'))
    const snapshots = path.join(root, 'snapshots')
    fs.mkdirSync(snapshots)
    try {
      await expect(
        validateFixture(
          path.join(
            ROOT,
            'server/data/test-corpus/officecli/officecli-positive-powerpoint-16.pptx'
          ),
          'accept',
          {
            validatePptxPackage: async () => {},
            createRevisionDescriptor: (revision) => revision,
            gateway: { validatePackage: async () => ({ ok: true, metrics: { exitCode: 7 } }) },
          },
          snapshots
        )
      ).rejects.toMatchObject({ code: 'VALID_FIXTURE_REJECTED' })
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('redacts local paths from physical runner stderr before source qualification', async () => {
    const privateBinary = `C:\\__officecli-path-redaction-${process.pid}\\missing.exe`
    try {
      await execFileAsync(process.execPath, [SCRIPT, `--invalid-${privateBinary}`], { cwd: ROOT })
      throw new Error('Physical runner unexpectedly succeeded')
    } catch (error) {
      expect(error.code).toBe(1)
      expect(error.stderr).toContain('[local path]')
      expect(error.stderr).not.toContain('__officecli-path-redaction')
    }
  })
})

describe('OfficeCLI physical feasibility gate', () => {
  it('the real CLI exits non-zero when required arguments are absent', async () => {
    await expect(execFileAsync(process.execPath, [SCRIPT], { cwd: ROOT })).rejects.toMatchObject({
      code: 1,
    })
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
    expect(() =>
      assertAuthoritativeReceipt(
        receipt,
        manifest,
        governance.officeCliPreG0Decision.expectedSourceCommit
      )
    ).not.toThrow()
    expect(governance.officeCliPreG0Decision).toMatchObject({
      status: 'approved',
      receiptPath: expect.stringMatching(/officecli-physical-feasibility\.json$/),
    })
  })

  it('rejects a shallow hand-written authoritative receipt', () => {
    expect(() =>
      assertAuthoritativeReceipt(
        {
          schemaVersion: 1,
          status: 'passed',
          authoritative: true,
          binary: {
            version: manifest.version,
            sha256: manifest.releaseAsset.sha256,
            byteLength: manifest.releaseAsset.byteLength,
          },
        },
        manifest,
        'a'.repeat(40)
      )
    ).toThrow(/receipt|evidence|provenance/i)
  })

  it('records attribution without claiming OfficeCLI redistribution', () => {
    for (const noticePath of ['NOTICE', 'website/NOTICE.md']) {
      const notice = fs.readFileSync(path.join(ROOT, noticePath), 'utf8')
      expect(notice).toContain('OfficeCLI')
      expect(notice).toMatch(/does not bundle or redistribute OfficeCLI/i)
    }
  })
})

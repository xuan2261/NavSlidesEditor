import { describe, expect, it } from 'vitest'
import {
  createGreenShaRoot,
  createHostReceipt,
  createNotSelectedReceipt,
  createQualificationId,
  hashReceipt,
} from './release-receipts.mjs'

const sha = (character) => character.repeat(64)
const subjectSha = 'a'.repeat(40)
const common = {
  schemaVersion: '1',
  policyVersion: 'release-targets-v1',
  subjectSha,
  clientDigest: sha('c'),
  lockHashes: { workspace: sha('d'), electron: sha('e') },
}

const policy = {
  schemaVersion: '1',
  policyVersion: 'release-targets-v1',
  targets: {
    windows: { selected: true, requiredGates: ['runtime', 'officecli', 'fidelity'] },
    'linux-desktop': { selected: false },
    'macos-desktop': { selected: false },
  },
}

describe('release receipt DAG', () => {
  it('uses a deterministic non-circular qualification identity', () => {
    expect(createQualificationId(common)).toBe(createQualificationId({ ...common }))
  })

  it('joins Linux, Windows, and explicit not-selected receipts', () => {
    const qualificationId = createQualificationId(common)
    const linux = createHostReceipt({
      ...common,
      qualificationId,
      host: 'linux-ci',
      status: 'passed',
      gates: { build: sha('1'), docker: sha('2') },
    })
    const windows = createHostReceipt({
      ...common,
      qualificationId,
      host: 'windows',
      status: 'passed',
      parentReceiptHash: hashReceipt(linux),
      gates: { runtime: sha('3'), officecli: sha('4'), fidelity: sha('5') },
    })
    const linuxDesktop = createNotSelectedReceipt({
      ...common,
      qualificationId,
      host: 'linux-desktop',
      parentReceiptHash: hashReceipt(linux),
    })
    const macosDesktop = createNotSelectedReceipt({
      ...common,
      qualificationId,
      host: 'macos-desktop',
      parentReceiptHash: hashReceipt(linux),
    })

    const root = createGreenShaRoot({
      policy,
      linuxReceipt: linux,
      windowsReceipt: windows,
      linuxDesktopReceipt: linuxDesktop,
      macosDesktopReceipt: macosDesktop,
    })
    expect(root.status).toBe('passed')
    expect(root.children['linux-desktop'].status).toBe('not-selected')
    expect(root.children.windows.hash).toBe(hashReceipt(windows))
  })

  it('fails closed for selected Windows gates and selected optional hosts', () => {
    const qualificationId = createQualificationId(common)
    const linux = createHostReceipt({
      ...common,
      qualificationId,
      host: 'linux-ci',
      status: 'passed',
      gates: { build: sha('1') },
    })
    const windows = createHostReceipt({
      ...common,
      qualificationId,
      host: 'windows',
      status: 'passed',
      parentReceiptHash: hashReceipt(linux),
      gates: { runtime: sha('2') },
    })
    expect(() =>
      createGreenShaRoot({
        policy,
        linuxReceipt: linux,
        windowsReceipt: windows,
        linuxDesktopReceipt: createNotSelectedReceipt({
          ...common,
          qualificationId,
          host: 'linux-desktop',
          parentReceiptHash: hashReceipt(linux),
        }),
        macosDesktopReceipt: createNotSelectedReceipt({
          ...common,
          qualificationId,
          host: 'macos-desktop',
          parentReceiptHash: hashReceipt(linux),
        }),
      })
    ).toThrow(/officecli|fidelity/i)
    expect(() =>
      createGreenShaRoot({
        policy: {
          ...policy,
          targets: {
            ...policy.targets,
            'linux-desktop': { selected: true, requiredGates: ['runtime'] },
          },
        },
        linuxReceipt: linux,
        windowsReceipt: createHostReceipt({
          ...common,
          qualificationId,
          host: 'windows',
          status: 'passed',
          parentReceiptHash: hashReceipt(linux),
          gates: { runtime: sha('2'), officecli: sha('3'), fidelity: sha('4') },
        }),
        linuxDesktopReceipt: createNotSelectedReceipt({
          ...common,
          qualificationId,
          host: 'linux-desktop',
          parentReceiptHash: hashReceipt(linux),
        }),
        macosDesktopReceipt: createNotSelectedReceipt({
          ...common,
          qualificationId,
          host: 'macos-desktop',
          parentReceiptHash: hashReceipt(linux),
        }),
      })
    ).toThrow(/linux-desktop must be passed/i)
  })

  it('fails closed when the Linux root is missing a policy-required gate', () => {
    const qualificationId = createQualificationId(common)
    const linux = createHostReceipt({
      ...common,
      qualificationId,
      host: 'linux-ci',
      status: 'passed',
      gates: { build: sha('1') },
    })
    const linuxHash = hashReceipt(linux)
    expect(() =>
      createGreenShaRoot({
        policy: {
          ...policy,
          targets: {
            ...policy.targets,
            'linux-ci': { selected: true, requiredGates: ['build', 'attestation'] },
          },
        },
        linuxReceipt: linux,
        windowsReceipt: createHostReceipt({
          ...common,
          qualificationId,
          host: 'windows',
          status: 'passed',
          parentReceiptHash: linuxHash,
          gates: { runtime: sha('2'), officecli: sha('3'), fidelity: sha('4') },
        }),
        linuxDesktopReceipt: createNotSelectedReceipt({
          ...common,
          qualificationId,
          host: 'linux-desktop',
          parentReceiptHash: linuxHash,
        }),
        macosDesktopReceipt: createNotSelectedReceipt({
          ...common,
          qualificationId,
          host: 'macos-desktop',
          parentReceiptHash: linuxHash,
        }),
      })
    ).toThrow(/linux-ci missing required gate attestation/i)
  })
})

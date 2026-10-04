import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseReleaseTag } from '../../scripts/ci/release-subject.mjs'
import workspaceLockTools from '../../scripts/workspace-lock.js'
import electronLockTools from '../../scripts/electron-server-dependencies.js'
import { compareCoreVersions, semanticLockHash } from './release-version-governance-helpers'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const readText = (...parts) => readFileSync(resolve(root, ...parts), 'utf8').replace(/\r\n/g, '\n')
const readJson = (...parts) => JSON.parse(readText(...parts))

const manifestPaths = [
  'package.json',
  'client/package.json',
  'server/package.json',
  'shared/package.json',
  'website/package.json',
]
const workspaceLockPaths = ['', 'client', 'server', 'shared', 'website']
const dependencyInputPaths = [
  ...manifestPaths,
  'package-lock.json',
  'electron/server-package-lock.json',
].sort()
const scopeManifestPath = [
  'plans',
  '260925-0631-single-user-powerpoint-native-fidelity-release-deep-tdd',
  'reports',
  'release-scope-manifest.json',
]
const dependencyEvidencePath = [
  'plans',
  '261001-0639-interactive-html-education-deep-tdd',
  'reports',
  'dependency-change-evidence.json',
]

describe('release version governance contract', () => {
  it('records one justified next version newer than immutable v1.16.2', () => {
    const rootVersion = readJson('package.json').version
    const scopeManifest = readJson(...scopeManifestPath)
    const decision = scopeManifest.releaseVersionDecision

    expect(compareCoreVersions(rootVersion, '1.16.2')).toBeGreaterThan(0)
    expect(scopeManifest.subject.commit).toBe('f4211075a5bb8bf4c9b125afa3e1ace2306f409a')
    expect(decision).toMatchObject({
      latestPublishedVersion: '1.16.2',
      nextVersion: rootVersion,
      semverImpact: 'minor',
      implementationEvidence: null,
      publishable: false,
      baseline: {
        subject: 'f4211075a5bb8bf4c9b125afa3e1ace2306f409a',
        range: 'v1.16.2..f4211075a5bb8bf4c9b125afa3e1ace2306f409a',
        deltaCommitCount: 0,
      },
      prospectiveScope: {
        sourcePath:
          'plans/260925-0631-single-user-powerpoint-native-fidelity-release-deep-tdd/plan.md',
        approvalStatus: 'approved-prospective-scope',
        publishable: false,
      },
    })
  })

  it('aligns every product manifest and checked-in lock to the root version', () => {
    const rootVersion = readJson('package.json').version
    for (const path of manifestPaths) expect(readJson(path).version, path).toBe(rootVersion)

    const workspaceLock = readJson('package-lock.json')
    expect(workspaceLock.lockfileVersion).toBe(3)
    expect(workspaceLock.version).toBe(rootVersion)
    for (const path of workspaceLockPaths) {
      expect(workspaceLock.packages[path].version, `package-lock.json packages[${path}]`).toBe(
        rootVersion
      )
    }

    const electronLock = readJson('electron/server-package-lock.json')
    expect(electronLock.lockfileVersion).toBe(3)
    expect(electronLock.version).toBe(rootVersion)
    expect(electronLock.packages[''].version).toBe(rootVersion)

    const evidence = readJson(...dependencyEvidencePath)
    expect(evidence.publishable).toBe(false)
    expect(evidence.qualification).toBe('unqualified-pending')
    expect(evidence.subject.inputs.map((input) => input.path).sort()).toEqual(dependencyInputPaths)
    const inputs = dependencyInputPaths
      .map((path) => {
        const sha256 = createHash('sha256')
          .update(readFileSync(resolve(root, path)))
          .digest('hex')
        expect(evidence.subject.inputs.find((input) => input.path === path).sha256, path).toBe(
          sha256
        )
        return { path, sha256 }
      })
      .sort((left, right) => left.path.localeCompare(right.path))
    expect(createHash('sha256').update(JSON.stringify(inputs)).digest('hex')).toBe(
      evidence.subject.dependencyInputHash
    )
    expect(
      workspaceLockTools.validateWorkspaceLock(
        workspaceLockTools.readWorkspaceManifests(root),
        workspaceLock
      )
    ).toBe(true)
    expect(
      electronLockTools.validateIsolatedLock(
        electronLockTools.createIsolatedManifest(readJson('server/package.json')),
        electronLock
      )
    ).toBe(true)
    expect(semanticLockHash(workspaceLock, workspaceLockPaths)).toBe(
      evidence.locks['package-lock.json'].currentSemanticHash
    )
    expect(semanticLockHash(electronLock, [''])).toBe(
      evidence.locks['electron/server-package-lock.json'].currentSemanticHash
    )
  })

  it('accepts only matching final and positive non-zero RC release tags', () => {
    const version = readJson('package.json').version
    expect(parseReleaseTag(`v${version}`, version)).toEqual({
      coreVersion: version,
      kind: 'final',
    })
    expect(parseReleaseTag(`v${version}-rc.1`, version)).toEqual({
      coreVersion: version,
      kind: 'rc',
      rcNumber: 1,
    })
    expect(parseReleaseTag(`v${version}-rc.20`, version)?.rcNumber).toBe(20)

    for (const tag of [
      'v1.16.0',
      'v1.16.1',
      'v1.16.2',
      `v${version}-rc.0`,
      `v${version}-rc.01`,
      `v${version}-beta.1`,
      `v${version}-rc`,
      `${version}`,
      `vv${version}`,
      'v01.17.0',
      'v1.017.0',
      'v9.9.9-rc.1',
    ]) {
      expect(parseReleaseTag(tag, version), tag).toBeNull()
    }
  })
})

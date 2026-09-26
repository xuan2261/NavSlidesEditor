import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  compareCoreVersions,
  parseReleaseTag,
  semanticLockHash,
} from './release-version-governance-helpers'

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
const releaseDocs = [
  'README.md',
  'docs/project-overview-pdr.md',
  'docs/project-roadmap.md',
  'docs/codebase-summary.md',
]
const scopeManifestPath = [
  'plans',
  '260925-0631-single-user-powerpoint-native-fidelity-release-deep-tdd',
  'reports',
  'release-scope-manifest.json',
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
    expect(decision.rationale).toMatch(/compatible user-visible capability/i)
    expect(decision.nonPublishableReason).toMatch(/not implementation evidence/i)
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

    const evidence = readJson(...scopeManifestPath).releaseVersionDecision.lockUpdateEvidence
    expect(semanticLockHash(workspaceLock, workspaceLockPaths)).toBe(
      evidence['package-lock.json semanticHashExcludingVersionFields']
    )
    expect(semanticLockHash(electronLock, [''])).toBe(
      evidence['electron/server-package-lock.json semanticHashExcludingVersionFields']
    )
  })

  it('distinguishes the candidate from the current published release in docs', () => {
    const version = readJson('package.json').version
    for (const path of releaseDocs) {
      const doc = readText(path)
      expect(doc, path).toMatch(/current published release/i)
      expect(doc, path).toContain('v1.16.0')
      expect(doc, path).toContain('v1.16.1')
      expect(doc, path).toContain('v1.16.2')
      expect(doc, path).toMatch(/next release candidate/i)
      expect(doc, path).toContain(`v${version}`)
      expect(doc, path).not.toMatch(/upstream parity.{0,80}(required|release gate|block)/i)
    }
  })

  it('separates immutable release history from pending Unreleased work', () => {
    const version = readJson('package.json').version
    const changelog = readText('docs/project-changelog.md')

    const publishedSections = [
      ['1.16.2', '2026-09-22'],
      ['1.16.1', '2026-09-21'],
      ['1.16.0', '2026-09-17'],
    ]
    for (const [publishedVersion, date] of publishedSections) {
      expect(changelog.match(new RegExp(`^## v${publishedVersion} — ${date}$`, 'gm'))).toHaveLength(
        1
      )
    }
    expect(changelog.match(new RegExp(`^## Unreleased \\(v${version}\\)$`, 'gm'))).toHaveLength(1)
    expect(changelog.indexOf(`## Unreleased (v${version})`)).toBeLessThan(
      changelog.indexOf('## v1.16.2')
    )
    const unreleasedStart = changelog.indexOf(`## Unreleased (v${version})`)
    const unreleased = changelog
      .slice(unreleasedStart, changelog.indexOf('\n## ', unreleasedStart))
      .trim()
    expect(unreleased).toMatch(/pending/i)
    expect(unreleased).not.toMatch(/^- /m)
    expect(changelog.indexOf('## v1.16.2')).toBeLessThan(changelog.indexOf('## v1.16.1'))
    expect(changelog.indexOf('## v1.16.1')).toBeLessThan(changelog.indexOf('## v1.16.0'))
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

  it('keeps upstream parity evidence historical and non-blocking', () => {
    const plan = readText('plans/archive/260523-0500-upstream-parity-verification-tdd/plan.md')
    const matrix = readText('docs/upstream-parity-matrix.md')
    const metadataIndex = matrix.indexOf('## Metadata')
    const banner = matrix.slice(0, metadataIndex)

    expect(plan).toMatch(/^status: (historical|superseded)$/m)
    expect(plan).toContain(
      'plans/260925-0631-single-user-powerpoint-native-fidelity-release-deep-tdd/phase-02-release-state-and-documentation-governance.md'
    )
    expect(plan).toContain('ce548c535abc7701ac45cc3164560caba121adce')
    expect(banner).toMatch(/historical/i)
    expect(banner).toMatch(/non-blocking/i)
  })
})

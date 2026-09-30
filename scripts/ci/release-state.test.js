import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const cli = fileURLToPath(new URL('./release-state.mjs', import.meta.url))
const roots = []
const version = '1.17.0'
const workspaces = ['client', 'server', 'shared', 'website']

function writeJson(root, path, value) {
  const file = resolve(root, path)
  mkdirSync(resolve(file, '..'), { recursive: true })
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

function fixture({ packageVersion = version, manifestVersions = {}, lockVersions = {} } = {}) {
  const root = mkdtempSync(resolve(tmpdir(), 'release-state-'))
  roots.push(root)
  writeJson(root, 'package.json', {
    name: 'fixture',
    version: packageVersion,
    workspaces: ['server', 'client', 'shared', 'website'],
  })
  for (const workspace of workspaces) {
    writeJson(root, `${workspace}/package.json`, {
      name: workspace,
      version: manifestVersions[workspace] ?? packageVersion,
    })
  }
  const workspacePackages = Object.fromEntries(
    ['', ...workspaces].map((workspace) => [
      workspace,
      { version: lockVersions[workspace] ?? packageVersion },
    ])
  )
  writeJson(root, 'package-lock.json', {
    name: 'fixture',
    version: lockVersions.root ?? packageVersion,
    lockfileVersion: 3,
    packages: workspacePackages,
  })
  writeJson(root, 'electron/server-package-lock.json', {
    name: 'fixture-electron',
    version: lockVersions.electron ?? packageVersion,
    lockfileVersion: 3,
    packages: { '': { version: lockVersions.electron ?? packageVersion } },
  })
  git(root, 'init', '--quiet')
  git(root, 'config', 'core.autocrlf', 'false')
  git(root, 'config', 'user.name', 'Release State Test')
  git(root, 'config', 'user.email', 'release-state@example.invalid')
  git(root, 'add', '.')
  git(root, 'commit', '--quiet', '-m', 'release fixture')
  return root
}

function tag(root, name) {
  git(root, 'tag', '-a', name, '-m', name)
}

function run(root) {
  return spawnSync(process.execPath, [cli], { cwd: root, encoding: 'utf8' })
}

function runOk(root) {
  const result = run(root)
  expect(result.status, result.stderr).toBe(0)
  return JSON.parse(result.stdout)
}
function expectFailure(root, pattern) {
  const result = run(root)
  expect(result.status).not.toBe(0)
  expect(result.stderr, result.stdout).toMatch(pattern)
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('release-state CLI', () => {
  it('records a clean RC candidate and its peeled full commit', () => {
    const root = fixture()
    tag(root, `v${version}-rc.2`)
    const head = git(root, 'rev-parse', 'HEAD')

    const evidence = runOk(root)

    expect(evidence).toMatchObject({
      subject: {
        commit: head,
        worktree: { clean: true, trackedClean: true, untrackedClean: true },
      },
      versions: {
        package: version,
        workspaces: Object.fromEntries(workspaces.map((workspace) => [workspace, version])),
        locks: {
          'package-lock.json': {
            lockfileVersion: 3,
            root: version,
            workspaces: Object.fromEntries(workspaces.map((workspace) => [workspace, version])),
          },
          'electron/server-package-lock.json': { lockfileVersion: 3, root: version },
        },
      },
      release: {
        tag: `v${version}-rc.2`,
        kind: 'rc',
        classification: 'candidate',
        tagCommitSha: head,
        publicationStatus: 'not-verified',
      },
    })
    expect(evidence.release.tagObjectSha).toMatch(/^[0-9a-f]{40}$/)
    expect(evidence.release.tagObjectSha).not.toBe(head)
  })

  it('classifies the matching final tag separately from an RC candidate', () => {
    const root = fixture()
    tag(root, `v${version}`)

    expect(runOk(root).release).toMatchObject({
      tag: `v${version}`,
      kind: 'final',
      classification: 'final-release',
      publicationStatus: 'not-verified',
    })
  })

  it('fails closed when no matching release tag exists', () => {
    const root = fixture()
    expectFailure(root, /tag/i)
  })

  it('rejects a noncanonical RC tag', () => {
    const root = fixture()
    tag(root, `v${version}-rc.0`)

    expectFailure(root, /tag/i)
  })

  it('rejects a release tag peeled to a different commit', () => {
    const root = fixture()
    tag(root, `v${version}-rc.1`)
    writeFileSync(resolve(root, 'later.txt'), 'new commit\n')
    git(root, 'add', 'later.txt')
    git(root, 'commit', '--quiet', '-m', 'advance head')

    expectFailure(root, /tag|head|commit/i)
  })

  it.each([
    [
      'invalid SemVer',
      { packageVersion: '1.17.0-rc.01' },
      'v1.17.0-rc.01',
      /invalid|version|semver/i,
    ],
    ['published version reuse', { packageVersion: '1.16.2' }, 'v1.16.2', /newer than published/i],
    [
      'manifest drift',
      { manifestVersions: { client: '1.18.0' } },
      `v${version}-rc.1`,
      /version|drift/i,
    ],
    [
      'workspace lock drift',
      { lockVersions: { server: '1.18.0' } },
      `v${version}-rc.1`,
      /version|drift/i,
    ],
    ['root lock drift', { lockVersions: { root: '1.18.0' } }, `v${version}-rc.1`, /version|drift/i],
    [
      'Electron lock drift',
      { lockVersions: { electron: '1.18.0' } },
      `v${version}-rc.1`,
      /version|drift/i,
    ],
  ])('rejects %s', (_case, options, releaseTag, error) => {
    const root = fixture(options)
    tag(root, releaseTag)
    expectFailure(root, error)
  })

  it('rejects tracked and untracked dirty worktrees', () => {
    const tracked = fixture()
    tag(tracked, `v${version}-rc.1`)
    writeFileSync(resolve(tracked, 'package.json'), 'dirty\n')
    expectFailure(tracked, /clean|dirty|worktree/i)

    const untracked = fixture()
    tag(untracked, `v${version}-rc.1`)
    writeFileSync(resolve(untracked, 'untracked.txt'), 'untracked\n')
    expectFailure(untracked, /clean|dirty|worktree/i)
  })

  it.each(['--assume-unchanged', '--skip-worktree'])(
    'rejects tracked changes hidden by %s',
    (flag) => {
      const root = fixture()
      tag(root, `v${version}-rc.1`)
      const packageFile = resolve(root, 'package.json')
      const manifest = JSON.parse(readFileSync(packageFile, 'utf8'))
      writeFileSync(
        packageFile,
        `${JSON.stringify({ ...manifest, description: 'dirty after tag' })}\n`
      )
      git(root, 'update-index', flag, 'package.json')

      expectFailure(root, /index flag|clean|dirty/i)
    }
  )
})

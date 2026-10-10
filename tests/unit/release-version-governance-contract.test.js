import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseReleaseTag } from '../../scripts/ci/release-subject.mjs'


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

describe('release version governance contract', () => {

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

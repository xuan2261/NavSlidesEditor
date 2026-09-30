import { createRequire } from 'node:module'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const {
  resolveWorkspaceLock,
  syncWorkspaceLock,
  validateWorkspaceLock,
} = require('./workspace-lock')

const workspaceNames = {
  '': 'navslides-editor',
  client: 'revealjs-editor-client',
  server: 'revealjs-editor-server',
  shared: 'revealjs-shared',
  website: 'navslides-website',
}

const manifestFor = (name, extra = {}) => ({
  name,
  version: '1.17.0',
  private: true,
  ...extra,
})

function createFixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), 'navslides-workspace-lock-'))
  const manifests = {
    '': manifestFor(workspaceNames[''], {
      workspaces: ['server', 'client', 'shared', 'website'],
      dependencies: { alpha: '^1.0.0', local: 'file:vendor-overrides/local' },
    }),
    client: manifestFor(workspaceNames.client, { dependencies: { alpha: '^1.0.0' } }),
    server: manifestFor(workspaceNames.server, {
      dependencies: { local: 'file:../vendor-overrides/local' },
    }),
    shared: manifestFor(workspaceNames.shared),
    website: manifestFor(workspaceNames.website, {
      devDependencies: { vitepress: '2.0.0-alpha.20' },
    }),
  }
  for (const [packagePath, manifest] of Object.entries(manifests)) {
    const directory = packagePath ? join(root, packagePath) : root
    mkdirSync(directory, { recursive: true })
    writeFileSync(join(directory, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  }
  const vendor = join(root, 'vendor-overrides', 'local')
  mkdirSync(vendor, { recursive: true })
  writeFileSync(join(vendor, 'package.json'), '{"name":"local","version":"1.0.0"}\n')
  return { root, manifests }
}

function lockFor(manifests, version = '1.16.2') {
  const packages = {}
  for (const [packagePath, manifest] of Object.entries(manifests)) {
    const { name, dependencies, devDependencies } = manifest
    packages[packagePath] = { name, version, dependencies, devDependencies }
    for (const key of Object.keys(packages[packagePath])) {
      if (packages[packagePath][key] === undefined) delete packages[packagePath][key]
    }
  }
  return {
    name: manifests[''].name,
    version,
    lockfileVersion: 3,
    packages,
  }
}

describe('workspace lock governance', () => {
  it('synchronizes versions only after dependency maps validate', () => {
    const { root, manifests } = createFixtureRoot()
    const lockPath = join(root, 'package-lock.json')
    writeFileSync(lockPath, `${JSON.stringify(lockFor(manifests), null, 2)}\n`)
    try {
      const result = syncWorkspaceLock(root)
      const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
      expect(result.changedFields).toHaveLength(6)
      expect(lock.version).toBe('1.17.0')
      expect(lock.packages.website.devDependencies).toEqual(manifests.website.devDependencies)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it.each([
    ['', 'dependencies', 'alpha', '^9.0.0'],
    ['website', 'devDependencies', 'vitepress', '^2.0.0-alpha.20'],
  ])('rejects %s dependency-map drift without writing', (packagePath, field, name, value) => {
    const { root, manifests } = createFixtureRoot()
    const lockPath = join(root, 'package-lock.json')
    const lock = lockFor(manifests)
    lock.packages[packagePath][field][name] = value
    const original = `${JSON.stringify(lock, null, 2)}\n`
    writeFileSync(lockPath, original)
    try {
      expect(() => syncWorkspaceLock(root)).toThrow(
        new RegExp(`${packagePath || '<root>'}.*${field}`, 'i')
      )
      expect(readFileSync(lockPath, 'utf8')).toBe(original)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('resolves from a complete temporary workspace with vendor overrides', () => {
    const { root, manifests } = createFixtureRoot()
    writeFileSync(join(root, 'package-lock.json'), '{}\n')
    try {
      resolveWorkspaceLock(root, {
        runInstall: (temporaryRoot) => {
          expect(
            readFileSync(join(temporaryRoot, 'vendor-overrides', 'local', 'package.json'), 'utf8')
          ).toContain('"local"')
          for (const packagePath of Object.keys(workspaceNames)) {
            const directory = packagePath ? join(temporaryRoot, packagePath) : temporaryRoot
            expect(JSON.parse(readFileSync(join(directory, 'package.json'))).name).toBe(
              workspaceNames[packagePath]
            )
          }
          writeFileSync(
            join(temporaryRoot, 'package-lock.json'),
            `${JSON.stringify(lockFor(manifests, '1.17.0'), null, 2)}\n`
          )
        },
      })
      expect(() =>
        validateWorkspaceLock(manifests, JSON.parse(readFileSync(join(root, 'package-lock.json'))))
      ).not.toThrow()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

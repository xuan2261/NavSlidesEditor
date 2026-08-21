import { describe, expect, it } from 'vitest'
import dependencyModule from './electron-server-dependencies.js'

const { canonicalDependencyTree, createIsolatedManifest, validateIsolatedLock } = dependencyModule

describe('Electron server dependency preparation', () => {
  const serverPackage = {
    name: 'server',
    version: '1.2.3',
    dependencies: { express: '4.22.2', 'revealjs-shared': '*' },
    overrides: { 'image-size': '$image-size' },
  }

  it('derives the isolated manifest from the server production owner', () => {
    expect(createIsolatedManifest(serverPackage)).toEqual({
      name: 'electron-server-deps',
      version: '1.2.3',
      private: true,
      dependencies: { express: '4.22.2' },
      overrides: { 'image-size': '$image-size' },
    })
  })

  it('rejects an isolated lock that drifts from the derived manifest', () => {
    const manifest = createIsolatedManifest(serverPackage)
    expect(() =>
      validateIsolatedLock(manifest, {
        lockfileVersion: 3,
        packages: { '': { dependencies: { express: '4.21.0' } } },
      })
    ).toThrow('Electron server lock dependencies do not match server/package.json')
  })

  it('hashes dependency trees independently of package-lock key order', () => {
    const left = {
      packages: {
        'node_modules/b': { version: '2.0.0', integrity: 'sha-b' },
        'node_modules/a': { version: '1.0.0', integrity: 'sha-a' },
      },
    }
    const right = {
      packages: {
        'node_modules/a': { integrity: 'sha-a', version: '1.0.0' },
        'node_modules/b': { integrity: 'sha-b', version: '2.0.0' },
      },
    }

    expect(canonicalDependencyTree(left)).toEqual(canonicalDependencyTree(right))
    expect(canonicalDependencyTree(left).sha256).toMatch(/^[a-f0-9]{64}$/)
  })

  it('hashes linked local packages by their installed node_modules path', () => {
    const lock = {
      packages: {
        '../vendor-overrides/image-size-disabled': { version: '3.0.0-security.1' },
        'node_modules/image-size': {
          resolved: '../vendor-overrides/image-size-disabled',
          link: true,
        },
      },
    }

    expect(canonicalDependencyTree(lock).entries).toEqual([
      { path: 'node_modules/image-size', version: '3.0.0-security.1' },
    ])
  })

  it('excludes lock entries that npm omits for the target platform', () => {
    const lock = {
      packages: {
        'node_modules/express': { version: '4.22.2' },
        'node_modules/fsevents': { version: '2.3.2', optional: true, os: ['darwin'] },
      },
    }

    expect(canonicalDependencyTree(lock, { platform: 'win32', arch: 'x64' }).entries).toEqual([
      { path: 'node_modules/express', version: '4.22.2' },
    ])
  })
})

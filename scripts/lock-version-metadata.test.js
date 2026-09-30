import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { syncLockVersionMetadata, writeLockVersionMetadata } = require('./lock-version-metadata')

const createLock = () => ({
  name: 'navslides-editor',
  version: '1.16.2',
  lockfileVersion: 3,
  packages: {
    '': {
      name: 'navslides-editor',
      version: '1.16.2',
      dependencies: { alpha: '^1.0.0' },
    },
    client: {
      name: 'revealjs-editor-client',
      version: '1.16.2',
      dependencies: { alpha: '^1.0.0' },
    },
    'node_modules/alpha': {
      version: '1.2.3',
      resolved: 'https://registry.npmjs.org/alpha/-/alpha-1.2.3.tgz',
      integrity: 'sha512-example',
    },
  },
})

describe('lock version metadata synchronizer', () => {
  it('changes only declared project version fields', () => {
    const input = createLock()
    const before = JSON.stringify(input)
    const result = syncLockVersionMetadata(input, {
      version: '1.17.0',
      identities: {
        '': 'navslides-editor',
        client: 'revealjs-editor-client',
      },
    })

    expect(result.changedFields).toEqual([
      'version',
      'packages[""].version',
      'packages["client"].version',
    ])
    expect(result.lock).toEqual({
      ...input,
      version: '1.17.0',
      packages: {
        ...input.packages,
        '': { ...input.packages[''], version: '1.17.0' },
        client: { ...input.packages.client, version: '1.17.0' },
      },
    })
    expect(JSON.stringify(input)).toBe(before)
    expect(result.lock.packages['node_modules/alpha']).toEqual(input.packages['node_modules/alpha'])
  })

  it('is idempotent once metadata is synchronized', () => {
    const options = {
      version: '1.17.0',
      identities: { '': 'navslides-editor', client: 'revealjs-editor-client' },
    }
    const first = syncLockVersionMetadata(createLock(), options)
    const second = syncLockVersionMetadata(first.lock, options)

    expect(second.changedFields).toEqual([])
    expect(second.lock).toEqual(first.lock)
  })

  it('validates the synchronized lock before writing', () => {
    const directory = mkdtempSync(join(tmpdir(), 'navslides-lock-version-'))
    const lockPath = join(directory, 'package-lock.json')
    const original = `${JSON.stringify(createLock(), null, 2)}\n`
    writeFileSync(lockPath, original)

    try {
      expect(() =>
        writeLockVersionMetadata({
          lockPath,
          version: '1.17.0',
          identities: { '': 'navslides-editor', client: 'revealjs-editor-client' },
          validate: () => {
            throw new Error('validation stopped write')
          },
        })
      ).toThrow('validation stopped write')
      expect(readFileSync(lockPath, 'utf8')).toBe(original)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it.each([
    [{ ...createLock(), lockfileVersion: 2 }, /package-lock v3/i],
    [{ ...createLock(), packages: {} }, /missing package entry/i],
    [
      {
        ...createLock(),
        packages: {
          ...createLock().packages,
          client: { ...createLock().packages.client, name: 'wrong-client' },
        },
      },
      /identity mismatch/i,
    ],
  ])('rejects unsafe lock structure %#', (lock, expectedError) => {
    expect(() =>
      syncLockVersionMetadata(lock, {
        version: '1.17.0',
        identities: { '': 'navslides-editor', client: 'revealjs-editor-client' },
      })
    ).toThrow(expectedError)
  })
})

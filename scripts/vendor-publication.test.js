import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import publication from './vendor-publication.js'

const { publishVendorAssets } = publication

const roots = []

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'navslides-vendor-'))
  roots.push(root)
  fs.mkdirSync(path.join(root, 'server', 'vendor'), { recursive: true })
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { force: true, recursive: true })
})

describe('vendor publication', () => {
  it('preserves the live tree when a required source is missing', async () => {
    const root = makeRoot()
    const vendorDir = path.join(root, 'server', 'vendor')
    const sourceDir = path.join(root, 'source')
    fs.mkdirSync(sourceDir)
    fs.writeFileSync(path.join(sourceDir, 'asset.js'), 'new asset')
    fs.writeFileSync(path.join(vendorDir, 'old.txt'), 'old asset')

    await expect(
      publishVendorAssets({
        rootDir: root,
        localItems: [
          { source: sourceDir, destination: 'present' },
          { source: null, sourceLabel: 'missing/dist', destination: 'missing' },
        ],
        remoteItems: [],
        logger: { log() {}, warn() {}, error() {} },
      })
    ).rejects.toThrow('Required vendor source not found: missing/dist')

    expect(fs.readFileSync(path.join(vendorDir, 'old.txt'), 'utf8')).toBe('old asset')
    expect(fs.existsSync(path.join(vendorDir, 'present'))).toBe(false)
    expect(
      fs.readdirSync(path.dirname(vendorDir)).filter((name) => name.includes('vendor-'))
    ).toEqual([])
  })

  it('preserves the live tree when a required staged asset is absent', async () => {
    const root = makeRoot()
    const vendorDir = path.join(root, 'server', 'vendor')
    const sourceDir = path.join(root, 'source')
    fs.mkdirSync(sourceDir)
    fs.writeFileSync(path.join(sourceDir, 'asset.js'), 'new asset')
    fs.writeFileSync(path.join(vendorDir, 'old.txt'), 'old asset')

    await expect(
      publishVendorAssets({
        rootDir: root,
        localItems: [{ source: sourceDir, destination: 'present' }],
        remoteItems: [],
        requiredPaths: ['present/missing.js'],
        logger: { log() {}, warn() {}, error() {} },
      })
    ).rejects.toThrow('Required staged vendor asset missing: present/missing.js')

    expect(fs.readFileSync(path.join(vendorDir, 'old.txt'), 'utf8')).toBe('old asset')
  })
  it('publishes a complete hashed manifest atomically', async () => {
    const root = makeRoot()
    const vendorDir = path.join(root, 'server', 'vendor')
    const sourceDir = path.join(root, 'source')
    fs.mkdirSync(sourceDir)
    fs.writeFileSync(path.join(sourceDir, 'asset.js'), 'new asset')
    fs.writeFileSync(path.join(vendorDir, 'old.txt'), 'old asset')

    const manifest = await publishVendorAssets({
      rootDir: root,
      localItems: [{ source: sourceDir, destination: 'present' }],
      remoteItems: [],
      metadata: { runtimes: { revealJs: '6.0.1' } },
      logger: { log() {}, warn() {}, error() {} },
    })

    expect(fs.existsSync(path.join(vendorDir, 'old.txt'))).toBe(false)
    expect(fs.readFileSync(path.join(vendorDir, 'present', 'asset.js'), 'utf8')).toBe('new asset')
    expect(manifest.files).toEqual([
      expect.objectContaining({ path: 'present/asset.js', bytes: 9, sha256: expect.any(String) }),
    ])
    expect(manifest.runtimes).toEqual({ revealJs: '6.0.1' })
    expect(
      JSON.parse(fs.readFileSync(path.join(vendorDir, 'vendor-manifest.json'), 'utf8'))
    ).toEqual(manifest)
    expect(
      fs.readdirSync(path.dirname(vendorDir)).filter((name) => name.includes('vendor-'))
    ).toEqual([])
  })
})

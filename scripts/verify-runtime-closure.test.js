import fs from 'node:fs'
import crypto from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import verifier from './verify-runtime-closure.js'

const { verifyRuntimeClosure } = verifier
const roots = []

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'navslides-runtime-'))
  roots.push(root)
  fs.mkdirSync(path.join(root, 'server', 'vendor'), { recursive: true })
  return root
}

function writeClientManifest(root, subject = 'a'.repeat(40)) {
  const dist = path.join(root, 'client', 'dist')
  fs.mkdirSync(dist, { recursive: true })
  fs.writeFileSync(path.join(dist, 'index.html'), 'client')
  const files = [
    {
      path: 'index.html',
      bytes: 6,
      sha256: crypto.createHash('sha256').update('client').digest('hex'),
    },
  ]
  const payload = {
    schemaVersion: 1,
    subject: { sha: subject, dirty: false },
    build: { command: 'npm run build', node: '22.22.0', npm: '10.9.3', vite: '8.2.2' },
    locks: [{ name: 'workspace', path: 'package-lock.json', bytes: 2, sha256: 'b'.repeat(64) }],
    files,
    artifact: { files: 1, bytes: 6 },
  }
  payload.artifact.identity = crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')
  const manifestPath = path.join(root, 'client-dist-manifest.json')
  fs.writeFileSync(manifestPath, JSON.stringify(payload))
  return manifestPath
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { force: true, recursive: true })
})

describe('runtime closure verifier', () => {
  it('rejects a vendor manifest whose asset is missing', () => {
    const root = makeRoot()
    fs.writeFileSync(
      path.join(root, 'server', 'vendor', 'vendor-manifest.json'),
      JSON.stringify({
        schemaVersion: 1,
        files: [{ path: 'socket.io/socket.io.min.js', bytes: 1, sha256: '0'.repeat(64) }],
      })
    )

    expect(() =>
      verifyRuntimeClosure({
        rootDir: root,
        requiredServerModules: [],
        requireClientDist: false,
        requiredVendorPaths: [],
        expectedRevealVersion: null,
      })
    ).toThrow('Vendor asset missing: socket.io/socket.io.min.js')
  })

  it('accepts a complete vendor manifest with matching hashes', () => {
    const root = makeRoot()
    const vendorDir = path.join(root, 'server', 'vendor')
    fs.mkdirSync(path.join(vendorDir, 'socket.io'), { recursive: true })
    fs.writeFileSync(path.join(vendorDir, 'socket.io', 'socket.io.min.js'), 'x')
    fs.writeFileSync(
      path.join(vendorDir, 'vendor-manifest.json'),
      JSON.stringify({
        schemaVersion: 1,
        files: [
          {
            path: 'socket.io/socket.io.min.js',
            bytes: 1,
            sha256: '2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881',
          },
        ],
      })
    )

    expect(
      verifyRuntimeClosure({
        rootDir: root,
        requiredServerModules: [],
        requireClientDist: false,
        requiredVendorPaths: [],
        expectedRevealVersion: null,
      })
    ).toEqual({ vendorFiles: 1, revealJs: null, serverModules: 0, clientDist: false })
  })

  it('rejects stale Reveal versions and legacy plugin paths', () => {
    const root = makeRoot()
    const vendorDir = path.join(root, 'server', 'vendor')
    const legacyPath = 'reveal.js/plugin/notes/notes.js'
    fs.mkdirSync(path.dirname(path.join(vendorDir, legacyPath)), { recursive: true })
    fs.writeFileSync(path.join(vendorDir, legacyPath), 'x')
    fs.writeFileSync(
      path.join(vendorDir, 'vendor-manifest.json'),
      JSON.stringify({
        schemaVersion: 1,
        runtimes: { revealJs: '5.2.1' },
        files: [
          {
            path: legacyPath,
            bytes: 1,
            sha256: '2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881',
          },
        ],
      })
    )

    expect(() =>
      verifyRuntimeClosure({
        rootDir: root,
        requiredServerModules: [],
        requireClientDist: false,
        requiredVendorPaths: [],
        expectedRevealVersion: '6.0.1',
      })
    ).toThrow('Reveal runtime version mismatch')

    expect(() =>
      verifyRuntimeClosure({
        rootDir: root,
        requiredServerModules: [],
        requireClientDist: false,
        requiredVendorPaths: [],
        expectedRevealVersion: '5.2.1',
      })
    ).toThrow('Legacy Reveal vendor asset is not allowed')
  })

  it('verifies complete client manifest identity in an assembled runtime', () => {
    const root = makeRoot()
    const manifestPath = writeClientManifest(root)
    const vendorDir = path.join(root, 'server', 'vendor')
    fs.writeFileSync(
      path.join(vendorDir, 'vendor-manifest.json'),
      JSON.stringify({ schemaVersion: 1, files: [] })
    )

    expect(
      verifyRuntimeClosure({
        rootDir: root,
        requiredServerModules: [],
        requireClientDist: true,
        clientManifestPath: manifestPath,
        clientSubject: 'a'.repeat(40),
        requiredVendorPaths: [],
        expectedRevealVersion: null,
      })
    ).toMatchObject({ clientDist: true, clientArtifactIdentity: expect.stringMatching(/^[a-f0-9]{64}$/) })

    fs.writeFileSync(path.join(root, 'client', 'dist', 'index.html'), 'changed')
    expect(() =>
      verifyRuntimeClosure({
        rootDir: root,
        requiredServerModules: [],
        requireClientDist: true,
        clientManifestPath: manifestPath,
        clientSubject: 'a'.repeat(40),
        requiredVendorPaths: [],
        expectedRevealVersion: null,
      })
    ).toThrow(/Client artifact (?:size|hash) mismatch/)
  })
})

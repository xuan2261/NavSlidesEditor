import fs from 'node:fs'
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

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { force: true, recursive: true })
})

describe('runtime closure verifier', () => {
  it('rejects a vendor manifest whose asset is missing', () => {
    const root = makeRoot()
    fs.writeFileSync(
      path.join(root, 'server', 'vendor', 'vendor-manifest.json'),
      JSON.stringify({ schemaVersion: 1, files: [{ path: 'socket.io/socket.io.min.js', bytes: 1, sha256: '0'.repeat(64) }] })
    )

    expect(() =>
      verifyRuntimeClosure({ rootDir: root, requiredServerModules: [], requireClientDist: false })
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
      verifyRuntimeClosure({ rootDir: root, requiredServerModules: [], requireClientDist: false })
    ).toEqual({ vendorFiles: 1, serverModules: 0, clientDist: false })
  })
})

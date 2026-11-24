import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import builder from './build-education-runtime.js'
import publication from './vendor-publication.js'
import closure from './verify-runtime-closure.js'

const roots = []
const required = ['navslides-education/runtime.js', 'navslides-education/runtime.css']
const logger = { log() {}, warn() {}, error() {} }
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})
async function assets() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'education-assets-'))
  roots.push(root)
  const items = await builder.buildEducationRuntime(path.join(root, 'build'))
  return { root, items, vendor: path.join(root, 'server', 'vendor') }
}
const publish = (root, items) =>
  publication.publishVendorAssets({
    rootDir: root,
    localItems: items,
    remoteItems: [],
    requiredPaths: required,
    logger,
  })
const verify = (root) =>
  closure.verifyRuntimeClosure({
    rootDir: root,
    requiredServerModules: [],
    requireClientDist: false,
    requiredVendorPaths: required,
    expectedRevealVersion: null,
  })

describe('education runtime asset closure', () => {
  it.each(required)('rejects tampered %s rather than shipping a stale runtime', async (asset) => {
    const { root, items, vendor } = await assets()
    await publish(root, items)
    verify(root)
    const file = path.join(vendor, asset)
    const original = fs.readFileSync(file)
    const changed = Buffer.from(original)
    changed[0] ^= 1
    fs.writeFileSync(file, changed)
    expect(() => verify(root)).toThrow(`Vendor asset hash mismatch: ${asset}`)
    fs.writeFileSync(file, original)
    fs.unlinkSync(file)
    expect(() => verify(root)).toThrow(`Vendor asset missing: ${asset}`)
  })
  it('keeps the usable published runtime intact when a replacement omits its stylesheet', async () => {
    const { root, items, vendor } = await assets()
    await publish(root, items)
    verify(root)
    const beforeAssets = required.map((asset) => fs.readFileSync(path.join(vendor, asset)))
    fs.appendFileSync(
      items.find((item) => item.destination.endsWith('.js')).source,
      '\n/* replacement */'
    )
    const before = fs.readFileSync(path.join(vendor, 'vendor-manifest.json'), 'utf8')
    await expect(
      publish(
        root,
        items.filter((item) => !item.destination.endsWith('.css'))
      )
    ).rejects.toThrow('Required staged vendor asset missing: navslides-education/runtime.css')
    expect(fs.readFileSync(path.join(vendor, 'vendor-manifest.json'), 'utf8')).toBe(before)
    expect(required.map((asset) => fs.readFileSync(path.join(vendor, asset)))).toEqual(beforeAssets)
    verify(root)
  })
})

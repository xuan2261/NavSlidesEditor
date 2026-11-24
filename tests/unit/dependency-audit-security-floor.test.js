import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'

const root = resolve(__dirname, '..', '..')
const readJson = (...parts) => JSON.parse(readFileSync(resolve(root, ...parts), 'utf8'))
const require = createRequire(import.meta.url)

function normalizeVersion(range) {
  return String(range || '')
    .replace(/^[~^<>=\s]+/, '')
    .replace(/-alpha\./, '.')
    .replace(/-beta\./, '.')
    .replace(/-rc\./, '.')
    .split(' ')[0]
}

function compareVersions(left, right) {
  const a = normalizeVersion(left).split('.').map(Number)
  const b = normalizeVersion(right).split('.').map(Number)
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const delta = (a[i] || 0) - (b[i] || 0)
    if (delta !== 0) return delta
  }
  return 0
}

function expectAtLeast(actual, minimum) {
  expect(compareVersions(actual, minimum)).toBeGreaterThanOrEqual(0)
}

describe('dependency audit security floor', () => {
  it('keeps direct dependencies above audited vulnerable ranges', () => {
    const rootPkg = readJson('package.json')
    const serverPkg = readJson('server', 'package.json')
    const clientPkg = readJson('client', 'package.json')
    const websitePkg = readJson('website', 'package.json')

    expectAtLeast(rootPkg.devDependencies.electron, '44.11.5')
    expectAtLeast(rootPkg.devDependencies['electron-builder'], '26.15.3')
    expectAtLeast(rootPkg.devDependencies['@modelcontextprotocol/sdk'], '1.32.2')
    expectAtLeast(rootPkg.devDependencies.concurrently, '10.0.7')
    expectAtLeast(rootPkg.devDependencies.zod, '4.6.7')
    expectAtLeast(serverPkg.dependencies.express, '4.22.3')
    expectAtLeast(serverPkg.dependencies['express-rate-limit'], '8.5.1')
    expectAtLeast(serverPkg.dependencies.multer, '2.5.0')
    expectAtLeast(serverPkg.dependencies['socket.io'], '4.8.4')
    expectAtLeast(serverPkg.dependencies.undici, '7.30.2')
    expectAtLeast(serverPkg.dependencies.zod, '4.6.7')
    expectAtLeast(serverPkg.dependencies.marked, '18.0.4')
    expectAtLeast(clientPkg.dependencies.marked, '18.0.4')
    expectAtLeast(clientPkg.dependencies['socket.io-client'], '4.8.4')
    expectAtLeast(clientPkg.dependencies['pdfjs-dist'], '6.2.108')
    expectAtLeast(clientPkg.devDependencies.vite, '8.3.8')
    expectAtLeast(websitePkg.devDependencies.vitepress, '2.0.0-alpha.21')
  })

  it('keeps transitive audit overrides for packages without safe workspace ranges', () => {
    const rootPkg = readJson('package.json')

    expectAtLeast(rootPkg.overrides.tar, '7.5.11')
    expectAtLeast(rootPkg.overrides.ws, '8.20.1')
    expectAtLeast(rootPkg.overrides['engine.io']?.['.'], '6.6.13')
    expectAtLeast(rootPkg.overrides['engine.io-client']?.['.'], '6.6.5')
    expectAtLeast(rootPkg.overrides['socket.io-adapter']?.['.'], '2.5.7')
    expectAtLeast(rootPkg.overrides.tmp, '0.2.6')
    expectAtLeast(rootPkg.overrides['minimatch@3.1.5']?.['brace-expansion'], '1.1.22')
    expectAtLeast(rootPkg.overrides['minimatch@5.1.9']?.['brace-expansion'], '2.1.8')
    expectAtLeast(rootPkg.overrides.qs, '6.17.1')
    expectAtLeast(rootPkg.overrides['source-map-js'], '1.2.4')
    expectAtLeast(rootPkg.overrides['@tootallnate/once'], '2.0.1')
    expectAtLeast(rootPkg.overrides.esbuild, '0.25.0')
    expectAtLeast(rootPkg.overrides.vite, '8.3.8')
    expect(rootPkg.overrides['@electron/get']?.undici).toBe('7.30.2')
    expect(rootPkg.overrides['image-size']).toBe('$image-size')
    expect(rootPkg.dependencies['image-size']).toBe('file:vendor-overrides/image-size-disabled')
    const disabledPackage = readJson('vendor-overrides', 'image-size-disabled', 'package.json')
    expect(disabledPackage.name).toBe('image-size')
    expectAtLeast(disabledPackage.version, '3.0.0')
    const disabledImageSize = require(resolve(root, 'vendor-overrides', 'image-size-disabled'))
    expect(() => disabledImageSize(Buffer.from('image'))).toThrow(
      'Automatic image dimension parsing is disabled'
    )
  })
})

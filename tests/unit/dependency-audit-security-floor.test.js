import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '..', '..')
const readJson = (...parts) => JSON.parse(readFileSync(resolve(root, ...parts), 'utf8'))

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

    expectAtLeast(rootPkg.devDependencies.electron, '42.3.0')
    expectAtLeast(rootPkg.devDependencies['electron-builder'], '26.8.1')
    expectAtLeast(serverPkg.dependencies.express, '4.22.2')
    expectAtLeast(serverPkg.dependencies['express-rate-limit'], '8.5.1')
    expectAtLeast(serverPkg.dependencies['socket.io'], '4.8.3')
    expectAtLeast(serverPkg.devDependencies.marked, '18.0.4')
    expectAtLeast(clientPkg.dependencies.marked, '18.0.4')
    expectAtLeast(clientPkg.dependencies['socket.io-client'], '4.8.3')
    expectAtLeast(clientPkg.devDependencies.vite, '7.0.0')
    expectAtLeast(websitePkg.devDependencies.vitepress, '2.0.0-alpha.17')
  })

  it('keeps transitive audit overrides for packages without safe workspace ranges', () => {
    const rootPkg = readJson('package.json')

    expectAtLeast(rootPkg.overrides.tar, '7.5.11')
    expectAtLeast(rootPkg.overrides.ws, '8.20.1')
    expectAtLeast(rootPkg.overrides['engine.io']?.['.'], '6.6.8')
    expectAtLeast(rootPkg.overrides['engine.io-client']?.['.'], '6.6.5')
    expectAtLeast(rootPkg.overrides['socket.io-adapter']?.['.'], '2.5.7')
    expectAtLeast(rootPkg.overrides.tmp, '0.2.6')
    expectAtLeast(rootPkg.overrides['minimatch@3.1.5']?.['brace-expansion'], '1.1.12')
    expectAtLeast(rootPkg.overrides['minimatch@5.1.9']?.['brace-expansion'], '2.0.2')
    expectAtLeast(rootPkg.overrides.qs, '6.15.2')
    expectAtLeast(rootPkg.overrides['@tootallnate/once'], '2.0.1')
    expectAtLeast(rootPkg.overrides.esbuild, '0.25.0')
    expectAtLeast(rootPkg.overrides.vite, '7.0.0')
  })
})

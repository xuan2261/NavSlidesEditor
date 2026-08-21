import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'

const root = resolve(__dirname, '..', '..')
const readJson = (...parts) => JSON.parse(readFileSync(resolve(root, ...parts), 'utf8'))
const readText = (...parts) => readFileSync(resolve(root, ...parts), 'utf8')
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

    expectAtLeast(rootPkg.devDependencies.electron, '42.9.3')
    expectAtLeast(rootPkg.devDependencies['electron-builder'], '26.15.3')
    expectAtLeast(serverPkg.dependencies.express, '4.22.2')
    expectAtLeast(serverPkg.dependencies['express-rate-limit'], '8.5.1')
    expectAtLeast(serverPkg.dependencies['socket.io'], '4.8.3')
    expectAtLeast(serverPkg.dependencies.undici, '7.29.0')
    expectAtLeast(serverPkg.devDependencies.marked, '18.0.4')
    expectAtLeast(clientPkg.dependencies.marked, '18.0.4')
    expectAtLeast(clientPkg.dependencies['socket.io-client'], '4.8.3')
    expectAtLeast(clientPkg.dependencies['pdfjs-dist'], '6.2.108')
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
    expect(rootPkg.overrides['@electron/get']?.undici).toBe('7.29.0')
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

  it('keeps the public Node floor and build runtime aligned', () => {
    expect(readJson('package.json').engines.node).toBe('>=22.13.0')

    const dockerVersions = [...readText('Dockerfile').matchAll(/FROM node:([^\s@-]+)/g)].map(
      (match) => match[1]
    )
    expect(dockerVersions).toEqual(['22.22.0', '22.22.0'])

    const workflowFiles = [
      'github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml',
      'manual-update-playwright-visual-baselines.yml',
      'nightly-ribbon-layout-768px-soft-warning-no-pr-gate.yml',
      'release.yml',
      'website-deploy-github-pages.yml',
    ]
    for (const file of workflowFiles) {
      const source = readText('.github', 'workflows', file)
      const versions = [...source.matchAll(/node-version:\s*['"]?([^'"\s},]+)/g)].map(
        (match) => match[1]
      )
      expect(versions.length, file).toBeGreaterThan(0)
      expect(new Set(versions), file).toEqual(new Set(['22.22.0']))
    }

    const publicDocs = [
      ['README.md'],
      ['docs', 'code-standards.md'],
      ['docs', 'codebase-summary.md'],
      ['docs', 'deployment-guide.md'],
      ['website', 'develop', 'building-from-source.md'],
      ['website', 'guide', 'installation.md'],
      ['website', 'vi', 'develop', 'building-from-source.md'],
      ['website', 'vi', 'guide', 'installation.md'],
    ]
    for (const pathParts of publicDocs) {
      const source = readText(...pathParts)
      expect(source, pathParts.join('/')).toContain('>=22.13.0')
      expect(source, pathParts.join('/')).toContain('22.22.0')
    }
  })
})

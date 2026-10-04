import { afterEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  symlinkSync,
  lstatSync,
  realpathSync,
} from 'node:fs'
import materialization from './electron-local-image-size.js'
import artifactRuntime from './ci/artifact-manifest-runtime.cjs'

const { materializeImageSize } = materialization
const { collectFiles } = artifactRuntime
const require = createRequire(import.meta.url),
  roots = []
const declaredSource = join(
  dirname(fileURLToPath(import.meta.url)),
  '../vendor-overrides/image-size-disabled'
)
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'electron-local-package-'))
  roots.push(root)
  const source = join(root, 'vendor-overrides/image-size-disabled')
  const nodeModules = join(root, '.electron-tmp/node_modules'),
    target = join(nodeModules, 'image-size')
  cpSync(declaredSource, source, { recursive: true })
  mkdirSync(nodeModules, { recursive: true })
  symlinkSync(source, target, 'junction')
  const pkg = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'))
  const dependencies = { 'image-size': 'file:../vendor-overrides/image-size-disabled' }
  const manifest = { dependencies }
  const lock = {
    packages: {
      '': { dependencies },
      '../vendor-overrides/image-size-disabled': { version: pkg.version },
      'node_modules/image-size': {
        resolved: '../vendor-overrides/image-size-disabled',
        link: true,
      },
    },
  }
  return { root, source, nodeModules, target, pkg, manifest, lock }
}

describe('declared local Electron dependency ownership', () => {
  it('turns the admitted local-file junction into exact self-contained fail-closed parser bytes', () => {
    const data = fixture(),
      expected = collectFiles(data.source)
    expect(() => collectFiles(data.nodeModules)).toThrow(/link|reparse/)
    expect(materializeImageSize(data.root, data.manifest, data.lock)).toEqual(expected)
    expect(lstatSync(data.target).isSymbolicLink()).toBe(false)
    expect(collectFiles(data.target)).toEqual(expected)
    expect(collectFiles(data.source)).toEqual(expected)
    rmSync(data.source, { recursive: true })
    expect(() => require(join(data.target, 'index.js'))(Buffer.from('not an image'))).toThrow(
      /disabled/
    )
  })
  it('refuses an installed junction to undeclared bytes without touching its target', () => {
    const data = fixture(),
      foreign = join(data.root, 'foreign-package')
    cpSync(data.source, foreign, { recursive: true })
    writeFileSync(join(foreign, 'foreign.txt'), 'foreign bytes')
    const expected = collectFiles(foreign)
    rmSync(data.target, { recursive: true })
    symlinkSync(foreign, data.target, 'junction')
    expect(() => materializeImageSize(data.root, data.manifest, data.lock)).toThrow(
      /declared local source/
    )
    expect(realpathSync(data.target)).toBe(realpathSync(foreign))
    expect(collectFiles(foreign)).toEqual(expected)
  })
  it('refuses a linked descendant in the declared source before removing the installed junction', () => {
    const data = fixture(),
      foreign = join(data.root, 'foreign-package')
    mkdirSync(foreign)
    writeFileSync(join(foreign, 'payload.txt'), 'foreign bytes')
    symlinkSync(foreign, join(data.source, 'linked'), 'junction')
    expect(() => materializeImageSize(data.root, data.manifest, data.lock)).toThrow(/link|reparse/)
    expect(realpathSync(data.target)).toBe(realpathSync(data.source))
    expect(readFileSync(join(foreign, 'payload.txt'), 'utf8')).toBe('foreign bytes')
  })
  it.each(['manifest', 'lock', 'source'])(
    'rejects %s identity drift before publication',
    (kind) => {
      const data = fixture()
      if (kind === 'manifest')
        data.manifest = { dependencies: { 'image-size': 'file:../foreign-package' } }
      if (kind === 'lock')
        data.lock.packages['node_modules/image-size'].resolved = '../foreign-package'
      if (kind === 'source')
        writeFileSync(
          join(data.source, 'package.json'),
          JSON.stringify({ ...data.pkg, version: 'wrong-version' })
        )
      expect(() => materializeImageSize(data.root, data.manifest, data.lock)).toThrow(
        /lock|identity/
      )
      expect(realpathSync(data.target)).toBe(realpathSync(data.source))
    }
  )
  it('does not silently accept an ordinary same-version package with altered bytes', () => {
    const data = fixture()
    rmSync(data.target, { recursive: true })
    cpSync(data.source, data.target, { recursive: true })
    writeFileSync(join(data.target, 'index.js'), 'module.exports = () => 100')
    expect(() => materializeImageSize(data.root, data.manifest, data.lock)).toThrow(/link only/)
    expect(readFileSync(join(data.target, 'index.js'), 'utf8')).toBe('module.exports = () => 100')
  })
})

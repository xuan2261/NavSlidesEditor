import { afterEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { verifyInstallerPayload } from './education-installer-payload.mjs'
import { digest, fileHash } from './education-evidence-files.mjs'

const require = createRequire(import.meta.url)
const { materializeImageSize } = require('../electron-local-image-size.js')
const { collectFiles } = require('../ci/artifact-manifest-runtime.cjs')
const { copyFiles, FileMatcher } = require('app-builder-lib/out/fileMatcher.js')
const { getPath7za } = require('app-builder-lib/out/toolsets/7zip.js')
const { getMakeNsisPath } = require('app-builder-lib/out/toolsets/windows.js')
const source = fileURLToPath(
  new URL('../../vendor-overrides/image-size-disabled/', import.meta.url)
)
const roots = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function invoke(command, args, options = {}) {
  return execFileSync(command, args, {
    stdio: 'pipe',
    timeout: 120000,
    windowsHide: true,
    ...options,
  })
}

function npm(cwd, args) {
  const flags = [
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--offline',
    '--install-links=false',
  ]
  if (process.platform === 'win32') {
    invoke(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm', ...args, ...flags], { cwd })
  } else invoke('npm', [...args, ...flags], { cwd })
}

function assertPackagedParser(server, missing = false) {
  // Fresh native Node processes prevent Vitest mocks or the pre-removal require cache masking a link.
  const code = `
    const assert = require('node:assert/strict')
    const { createRequire } = require('node:module')
    const { realpathSync } = require('node:fs')
    const { join } = require('node:path')
    const consumer = createRequire(join(process.cwd(), 'consumer.cjs'))
    if (process.argv[1] === 'missing') {
      assert.throws(() => consumer.resolve('image-size'), { code: 'MODULE_NOT_FOUND' })
    } else {
      const expected = join(process.cwd(), 'node_modules', 'image-size', 'index.js')
      const resolved = consumer.resolve('image-size')
      assert.equal(resolved, expected)
      assert.equal(realpathSync(resolved), expected)
      const parser = consumer('image-size')
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMc8AAAAASUVORK5CYII=', 'base64')
      for (const readSize of [parser, parser.default, parser.imageSize, parser.sizeOf]) {
        assert.throws(() => readSize(png), /Automatic image dimension parsing is disabled/)
      }
    }
  `
  invoke(process.execPath, ['-e', code, missing ? 'missing' : 'present'], {
    cwd: server,
    env: { ...process.env, NODE_PATH: '', NODE_OPTIONS: '' },
  })
}

async function wrapPayload(root, unpacked) {
  const exe = join(unpacked, 'Fixture.exe'),
    resources = join(unpacked, 'resources')
  // These are fixture shell bytes, not a shipping or runnable Electron executable.
  writeFileSync(exe, 'consumer-boundary fixture executable bytes')
  writeFileSync(join(resources, 'app.asar'), 'consumer-boundary fixture shell bytes')
  const archive = join(root, 'app-64.7z'),
    installer = join(root, 'Setup.exe')
  invoke(await getPath7za(), ['a', '-t7z', archive, '.'], { cwd: unpacked })
  const bootstrap = join(root, 'bootstrap.dat'),
    script = join(root, 'fixture.nsi')
  writeFileSync(bootstrap, 'compressed bootstrap bytes\n'.repeat(1000))
  writeFileSync(
    script,
    [
      'Unicode true',
      'Name "Local parser consumer fixture"',
      `OutFile "${installer}"`,
      // Without /SOLID, zlib gives the bootstrap its own Deflate stream.
      'SetCompressor zlib',
      'SilentInstall silent',
      'Section',
      'InitPluginsDir',
      'SetOutPath "$PLUGINSDIR"',
      'SetCompress off',
      `File /oname=app-64.7z "${archive}"`,
      'SetCompress force',
      `File /oname=bootstrap.dat "${bootstrap}"`,
      'SectionEnd',
    ].join('\n')
  )
  const compiler = await getMakeNsisPath()
  invoke(compiler.path, ['-V2', script], { env: { ...process.env, ...compiler.env } })
  return { installer, exe, resources, unpacked }
}

async function publishParserFixture() {
  const root = mkdtempSync(join(tmpdir(), 'navslides-local-parser-'))
  roots.push(root)
  const vendor = join(root, 'vendor-overrides', 'image-size-disabled')
  const temporary = join(root, '.electron-tmp')
  cpSync(source, vendor, { recursive: true })
  const inventory = collectFiles(source)
  expect(collectFiles(vendor)).toEqual(inventory)
  mkdirSync(temporary)
  const manifest = {
    name: 'local-parser-consumer-fixture',
    version: '1.0.0',
    private: true,
    dependencies: { 'image-size': 'file:../vendor-overrides/image-size-disabled' },
  }
  writeFileSync(join(temporary, 'package.json'), `${JSON.stringify(manifest)}\n`)
  npm(temporary, ['install', '--package-lock-only', '--package-lock=true', '--lockfile-version=3'])
  const lock = JSON.parse(readFileSync(join(temporary, 'package-lock.json'), 'utf8'))
  npm(temporary, ['ci'])
  const installed = join(temporary, 'node_modules', 'image-size')
  expect(lstatSync(installed).isSymbolicLink()).toBe(true)
  expect(() => collectFiles(installed)).toThrow(/symbolic link|reparse point/i)
  materializeImageSize(root, manifest, lock)
  expect(lstatSync(installed).isSymbolicLink()).toBe(false)
  expect(collectFiles(installed)).toEqual(inventory)

  const unpacked = join(root, 'win-unpacked'),
    server = join(unpacked, 'resources', 'server')
  await copyFiles(
    [
      new FileMatcher(
        join(temporary, 'node_modules'),
        join(server, 'node_modules'),
        (pattern) => pattern,
        ['**/*']
      ),
    ],
    null,
    false
  )
  const packaged = join(server, 'node_modules', 'image-size')
  expect(collectFiles(packaged)).toEqual(inventory)
  expect(collectFiles(vendor)).toEqual(inventory)
  rmSync(join(root, 'vendor-overrides'), { recursive: true })
  rmSync(temporary, { recursive: true })
  expect(existsSync(vendor)).toBe(false)
  expect(existsSync(temporary)).toBe(false)
  return { root, unpacked, server, packaged }
}

describe('local disabled parser through real extraResources and NSIS boundaries', () => {
  it('packages ordinary complete bytes that resolve locally and fail closed without build sources', async () => {
    const { server, packaged } = await publishParserFixture()
    assertPackagedParser(server)
    const unavailable = join(dirname(packaged), 'parser-unavailable')
    renameSync(packaged, unavailable)
    try {
      assertPackagedParser(server, true)
    } finally {
      renameSync(unavailable, packaged)
    }
  }, 120000)
  it.runIf(process.platform === 'win32' && process.arch === 'x64')(
    'attests actual Windows NSIS payload bytes after ordinary parser publication',
    async () => {
      const { root, unpacked, server } = await publishParserFixture()
      assertPackagedParser(server)
      const data = await wrapPayload(root, unpacked)
      await expect(verifyInstallerPayload(data)).resolves.toEqual({
        installerHash: fileHash(data.installer),
        payloadHash: digest(collectFiles(unpacked)),
      })
    },
    120000
  )
})

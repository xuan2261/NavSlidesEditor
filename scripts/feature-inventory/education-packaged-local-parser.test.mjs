import { afterEach, describe, expect, it } from 'vitest'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  renameSync,
  symlinkSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { createSubject } from './education-qualification-stage.mjs'
import { verifyPackagedSources } from './education-package-sources.mjs'
import { createManifest } from '../ci/create-client-dist-manifest.mjs'
import manifestRuntime from '../ci/artifact-manifest-runtime.cjs'

const directory = dirname(fileURLToPath(import.meta.url))
const repository = resolve(directory, '../..')
const { createPackage } = createRequire(import.meta.url)('@electron/asar')
const prefix = 'vendor-overrides/image-size-disabled/'
const roots = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})
function put(root, path, content) {
  const target = join(root, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content)
}
async function fixture({ declareParser = true } = {}) {
  // Keep require resolution on the real repository ancestry without dependency links or mocks.
  const root = mkdtempSync(join(directory, '.packaged-local-parser-'))
  roots.push(root)
  put(root, 'package.json', '{"name":"packaged-parser-fixture","private":true}')
  put(root, 'package-lock.json', '{}')
  const sources = {
    'server/index.js': 'module.exports = { qualification: true }\n',
    'shared/src/policy.js': 'module.exports = { disabled: true }\n',
    'electron/main.js': 'module.exports = { desktop: true }\n',
  }
  for (const [path, content] of Object.entries(sources)) put(root, path, content)
  for (const file of manifestRuntime.collectFiles(join(repository, prefix))) {
    put(root, prefix + file.path, readFileSync(join(repository, prefix, file.path)))
  }
  put(root, prefix + 'assets/policy.bin', Buffer.from([0, 1, 255, 128]))
  put(root, prefix + 'assets/empty', '')
  const resources = join(root, 'resources'),
    installed = join(resources, 'server/node_modules/image-size')
  for (const file of manifestRuntime.collectFiles(join(root, prefix))) {
    put(installed, file.path, readFileSync(join(root, prefix, file.path)))
  }
  put(resources, 'server/index.js', sources['server/index.js'])
  put(
    resources,
    'server/node_modules/revealjs-shared/src/policy.js',
    sources['shared/src/policy.js']
  )
  put(root, 'shell-input/electron/main.js', sources['electron/main.js'])
  await createPackage(join(root, 'shell-input'), join(resources, 'app.asar'))
  if (!declareParser) rmSync(join(root, prefix), { recursive: true })
  const context = createSubject(root)
  put(resources, 'client/dist/index.html', '<!doctype html><title>Qualification fixture</title>')
  const manifest = createManifest({
    baseDir: root,
    root: join(resources, 'client/dist'),
    subject: 'a'.repeat(40),
    dirty: false,
    inputHash: context.subjectHash,
    buildCommand: 'npm run build',
    viteVersion: '8.2.2',
  })
  put(resources, 'client-dist-manifest.json', JSON.stringify(manifest))
  return { root, context, resources, installed }
}
const verify = (data) => verifyPackagedSources(data.root, data.context, data.resources)
function linkDirectory(data, target) {
  const external = join(data.root, 'linked-target')
  renameSync(target, external)
  symlinkSync(external, target, 'junction')
}

describe('frozen packaged local parser byte attestation', () => {
  it('accepts every exact package file while preserving existing source counts and client identity', async () => {
    const data = await fixture()
    expect(verify(data)).toEqual({
      server: 1,
      shared: 1,
      shell: 1,
      clientInputHash: data.context.subjectHash,
    })
  })
  it.each(['same-size bytes', 'size'])(
    'rejects same-version installed parser %s drift',
    async (drift) => {
      const data = await fixture(),
        path = join(data.installed, 'index.js')
      const bytes = readFileSync(path)
      if (drift === 'same-size bytes') bytes[0] ^= 1
      writeFileSync(path, drift === 'size' ? Buffer.concat([bytes, Buffer.from('\n')]) : bytes)
      expect(() => verify(data)).toThrow(/image-size.*differs.*frozen/i)
    }
  )
  it.each(['.unexpected', 'assets/extra.bin'])(
    'rejects an undeclared installed file at %s',
    async (path) => {
      const data = await fixture()
      put(data.installed, path, 'extra package content')
      expect(() => verify(data)).toThrow(/image-size.*differs.*frozen/i)
    }
  )
  it.each(['index.js', 'assets/empty'])(
    'rejects a missing declared installed file at %s',
    async (path) => {
      const data = await fixture()
      rmSync(join(data.installed, path))
      expect(() => verify(data)).toThrow(/image-size.*differs.*frozen/i)
    }
  )
  it('rejects an installed package when no local parser source files were declared', async () => {
    const data = await fixture({ declareParser: false })
    expect(() => verify(data)).toThrow(Error)
  })
  it.each([
    'server/node_modules/image-size',
    'server/node_modules',
    'server/node_modules/image-size/assets',
  ])('rejects byte-identical installed links at %s', async (path) => {
    const data = await fixture()
    linkDirectory(data, join(data.resources, path))
    expect(() => verify(data)).toThrow(/symbolic|reparse|link/i)
  })
  it('rejects a missing installed package', async () => {
    const data = await fixture()
    rmSync(data.installed, { recursive: true })
    expect(() => verify(data)).toThrow(/ENOENT/i)
  })
  it('rejects changed declared source even when installed bytes still match the frozen hashes', async () => {
    const data = await fixture()
    put(data.root, prefix + 'index.js', 'changed source')
    expect(() => verify(data)).toThrow(/image-size.*source.*frozen/i)
  })
  it('rejects undeclared source files rather than ignoring them when mapping the package', async () => {
    const data = await fixture()
    put(data.root, prefix + 'extra.bin', 'undeclared source')
    expect(() => verify(data)).toThrow(/image-size.*source.*frozen/i)
  })
  it('rejects linked declared source even when its complete file inventory is byte-identical', async () => {
    const data = await fixture()
    linkDirectory(data, join(data.root, prefix))
    expect(() => verify(data)).toThrow(/symbolic|reparse|link/i)
  })
})

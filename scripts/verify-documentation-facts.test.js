// @vitest-environment node
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import reveal from '../shared/src/reveal-runtime-assets.js'

const cli = fileURLToPath(new URL('./verify-documentation-facts.mjs', import.meta.url))
const roots = []
const facts = {
  version: '2.3.4', workspaces: 'server,client,shared,website',
  'node.minimum': '22.13.0', reveal: reveal.REVEAL_RUNTIME_VERSION,
  tiptap: '3.31.3', elements: '2',
}
const document = (values = facts) => `Unrelated prose: historical version 1.0.0.\n\n<!-- navslides-facts:start -->\n| Fact | Value |\n| --- | --- |\n${Object.entries(values).map(([key, value]) => `| ${key} | ${value} |`).join('\n')}\n<!-- navslides-facts:end -->\n`
async function put(root, file, value) {
  const target = path.join(root, file)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, typeof value === 'object' ? JSON.stringify(value) : value)
}
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-documentation-facts-'))
  roots.push(root)
  await put(root, 'package.json', { version: facts.version, workspaces: facts.workspaces.split(','), engines: { node: `>=${facts['node.minimum']}` } })
  await put(root, 'runtime-versions.json', { nodeFloor: `>=${facts['node.minimum']}`, tiptap: facts.tiptap })
  await put(root, 'server/package.json', { version: facts.version, devDependencies: { 'reveal.js': facts.reveal } })
  await put(root, 'client/package.json', { version: facts.version, type: 'module', dependencies: { '@tiptap/core': facts.tiptap, '@tiptap/starter-kit': facts.tiptap } })
  await put(root, 'client/src/data/element-defaults.js', 'export const ELEMENT_DEFAULTS = { text: {}, image: {} }\n')
  await put(root, 'shared/src/reveal-runtime-assets.js', `module.exports = { REVEAL_RUNTIME_VERSION: ${JSON.stringify(facts.reveal)} }\n`)
  const bytes = Buffer.from('fixture vendor bytes; not a qualified runtime')
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const files = reveal.REVEAL_REQUIRED_VENDOR_PATHS.map((file) => ({ path: file, bytes: bytes.length, sha256 }))
  for (const file of files) await put(root, `server/vendor/${file.path}`, bytes.toString())
  await put(root, 'server/vendor/vendor-manifest.json', { schemaVersion: 1, runtimes: { revealJs: facts.reveal }, files })
  await put(root, 'README.md', document())
  await put(root, 'README_vi.md', document())
  return root
}
function run(root) {
  try {
    return { code: 0, output: execFileSync(process.execPath, [cli, '--root', root], { encoding: 'utf8', stdio: 'pipe' }) }
  } catch (error) {
    return { code: error.status, output: `${error.stdout || ''}${error.stderr || ''}` }
  }
}
afterEach(async () => { for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true }) })

describe('Documentation facts CLI semantic drift', () => {
  it('accepts actual owners and ignores unrelated prose and historical example numbers', async () => {
    const root = await fixture()
    await put(root, 'README_vi.md', `${document()}\nMột ví dụ dùng Node 18 và version 0.1.0; không phải fact.\n`)
    const result = run(root)
    expect(result.code).toBe(0)
    expect(JSON.parse(result.output)).toMatchObject({ facts, documents: ['README.md', 'README_vi.md'] })
  })
  it.each([
    ['version', '9.9.9'], ['workspaces', 'server,client,shared,electron'],
    ['node.minimum', '18.0.0'], ['reveal', '6.0.1'], ['tiptap', '2.0.0'], ['elements', '19'],
  ])('rejects stale %s in the Vietnamese document', async (key, value) => {
    const root = await fixture()
    await put(root, 'README_vi.md', document({ ...facts, [key]: value }))
    const result = run(root)
    expect(result.code).toBe(1)
    expect(result.output).toContain(`README_vi.md: ${key}`)
  })
  it.each(['missing', 'duplicate'])('rejects %s semantic catalog rather than accepting prose', async (mode) => {
    const root = await fixture()
    await put(root, 'README.md', mode === 'missing' ? 'Version 2.3.4 and 2 element types.' : document() + document())
    const result = run(root)
    expect(result.code).toBe(1)
    expect(result.output).toContain('README.md:')
  })
  it('detects canonical element additions without re-pinning the documented count', async () => {
    const root = await fixture()
    await put(root, 'client/src/data/element-defaults.js', 'export const ELEMENT_DEFAULTS = { text: {}, image: {}, chart: {} }\n')
    const result = run(root)
    expect(result.code).toBe(1)
    expect(result.output).toContain('README.md: elements')
  })
  it('rejects runtime owners disagreeing even when both documentation tables agree', async () => {
    const root = await fixture()
    await put(root, 'server/package.json', { devDependencies: { 'reveal.js': '6.0.1' } })
    const result = run(root)
    expect(result.code).toBe(1)
    expect(result.output).toContain('Reveal owner mismatch')
  })
  it.each(['missing', 'modified'])('rejects %s runtime asset bytes through the existing closure verifier', async (mode) => {
    const root = await fixture()
    const asset = path.join(root, 'server/vendor', reveal.REVEAL_REQUIRED_VENDOR_PATHS[0])
    if (mode === 'missing') await fs.rm(asset)
    else await fs.writeFile(asset, 'wrong bytes')
    const result = run(root)
    expect(result.code).toBe(1)
    expect(result.output).toContain('Vendor asset')
  })
})

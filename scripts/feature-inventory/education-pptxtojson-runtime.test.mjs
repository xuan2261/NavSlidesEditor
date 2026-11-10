import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createSubject, stageQualification } from './education-qualification-stage.mjs'
import fixtures from '../../server/services/pptx-import/nonnumeric-fixture.js'

const require = createRequire(import.meta.url)
const execute = promisify(execFile)
const roots = []
const prefix = 'server/services/pptx-import/'
const sources = ['pptxtojson-runtime.js', 'parser-part-names.js', 'pptxtojson-chart-data.js']
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})
function put(root, name, content) {
  const target = join(root, name)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content)
}
async function packaged() {
  // OS temp ancestry, a separate Node process, and --no-global-search-paths
  // prevent workspace, NODE_PATH, and globally installed dependency fallback.
  const root = mkdtempSync(join(tmpdir(), 'isolated-pptxtojson-'))
  roots.push(root)
  put(root, 'source/package-lock.json', '{}')
  for (const name of sources) {
    put(root, `source/${prefix}${name}`, readFileSync(resolve(prefix, name)))
  }
  for (const ignored of ['server/vendor/private.js', 'server/node_modules/private.js', 'server/data/private.json', 'server/dist/generated.js']) {
    put(root, `source/${ignored}`, 'excluded')
  }
  const source = join(root, 'source')
  const subject = createSubject(source)
  const stage = join(root, 'resources')
  stageQualification(source, stage, subject)
  const entry = require.resolve('pptxtojson/dist/index.cjs')
  const installed = join(stage, 'server/node_modules/pptxtojson')
  put(installed, 'dist/index.cjs', readFileSync(entry))
  put(installed, 'package.json', readFileSync(resolve(dirname(entry), '../package.json')))
  const data = await fixtures.createNonnumericFixture(root)
  return { root, source, subject, stage, installed, file: data.file }
}
const script = `
const fs = require('node:fs');
const { createRequire } = require('node:module');
const loader = process.argv[1];
const local = createRequire(loader);
const entry = local.resolve('pptxtojson/dist/index.cjs');
const bytes = fs.readFileSync(process.argv[2]);
local(loader).loadPptxtojson().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), { imageMode: 'base64' })
  .then(output => process.stdout.write(JSON.stringify({ entry, output })))
  .catch(error => { console.error(error); process.exitCode = 1; });
`
function run(data) {
  const env = { ...process.env }
  delete env.NODE_PATH
  delete env.NODE_OPTIONS
  return execute(process.execPath, ['--no-global-search-paths', '-e', script,
    join(data.stage, prefix, sources[0]), data.file], { cwd: data.root, env, timeout: 10000 })
}

describe('frozen installed pptxtojson runtime in isolated resources', () => {
  it('freezes, stages and executes the loader/helper with only the real pinned package', async () => {
    const data = await packaged()
    expect(data.subject.files.map((file) => file.path)).toEqual([
      'package-lock.json', ...sources.map((name) => prefix + name).sort(),
    ])
    for (const name of sources) {
      expect(readFileSync(join(data.stage, prefix, name))).toEqual(readFileSync(join(data.source, prefix, name)))
      const before = data.subject.subjectHash
      put(data.source, prefix + name, Buffer.concat([readFileSync(join(data.source, prefix, name)), Buffer.from('\n')]))
      expect(createSubject(data.source).subjectHash).not.toBe(before)
      copyFileSync(join(data.stage, prefix, name), join(data.source, prefix, name))
    }
    const { stdout } = await run(data)
    const result = JSON.parse(stdout)
    expect(result.entry).toBe(join(data.installed, 'dist/index.cjs'))
    expect(result.output.slides).toHaveLength(2)
    const content = JSON.stringify(result.output).replaceAll('&nbsp;', ' ')
    for (const marker of ['FIRST', 'SECOND', 'LAYOUT FIRST', 'LAYOUT SECOND', 'MASTER FOUNDATION', 'Notes FIRST', 'Notes SECOND']) {
      expect(content).toContain(marker)
    }
  })
  it('rejects a missing staged helper rather than using source ancestry', async () => {
    const data = await packaged()
    rmSync(join(data.stage, prefix, 'parser-part-names.js'))
    await expect(run(data)).rejects.toThrow(/parser-part-names/)
  })
  it('rejects altered installed bytes in the isolated package', async () => {
    const data = await packaged()
    put(data.installed, 'dist/index.cjs', Buffer.concat([readFileSync(join(data.installed, 'dist/index.cjs')), Buffer.from('\n')]))
    await expect(run(data)).rejects.toThrow(/digest/)
  })
})

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const roots = []
const entry = require.resolve('pptxtojson/dist/index.cjs')
const original = fs.readFileSync(entry)
const anchors = [
  String.raw`function(t,e){return+/(\d+)\.xml/.exec(t)[1]-+/(\d+)\.xml/.exec(e)[1]}`,
  'a.replace("slides/slide","slides/_rels/slide")+".rels"',
  'p.replace("slideLayouts/slideLayout","slideLayouts/_rels/slideLayout")+".rels"',
  'b.replace("slideMasters/slideMaster","slideMasters/_rels/slideMaster")+".rels"',
  'function mu(t){',
  'function yu(t,e){',
]
afterEach(() => {
  vi.restoreAllMocks()
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})

function isolated({ version = '2.0.2', bytes = original, missing = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pptxtojson-runtime-'))
  roots.push(root)
  for (const name of ['pptxtojson-runtime.js', 'parser-part-names.js', 'pptxtojson-chart-data.js']) {
    fs.copyFileSync(path.resolve('server/services/pptx-import', name), path.join(root, name))
  }
  const installed = path.join(root, 'node_modules/pptxtojson')
  if (!missing) {
    fs.mkdirSync(path.join(installed, 'dist'), { recursive: true })
    fs.writeFileSync(path.join(installed, 'package.json'), JSON.stringify({ version }))
    fs.writeFileSync(path.join(installed, 'dist/index.cjs'), bytes)
  }
  return require(path.join(root, 'pptxtojson-runtime.js'))
}

describe('verified pinned installed pptxtojson runtime', () => {
  it('compiles the real byte-locked compatibility bundle once without changing installed bytes', () => {
    for (const anchor of anchors) expect(original.toString().split(anchor)).toHaveLength(2)
    const runtime = isolated()
    const first = runtime.loadPptxtojson()
    expect(first.packageVersion).toBe('2.0.2')
    expect(first.parse).toBeTypeOf('function')
    expect(runtime.loadPptxtojson()).toBe(first)
    expect(fs.readFileSync(entry)).toEqual(original)
  })
  it('rejects a missing isolated dependency without an ancestor fallback', () => {
    expect(() => isolated({ missing: true }).loadPptxtojson()).toThrow(/Cannot find module/)
  })
  it('rejects wrong-version bytes before compilation', () => {
    const compile = vi.spyOn(require('node:vm'), 'compileFunction')
    expect(() => isolated({ version: '2.0.3' }).loadPptxtojson()).toThrow(/version/)
    expect(compile).not.toHaveBeenCalled()
  })
  it('rejects same-version byte drift before compilation', () => {
    const compile = vi.spyOn(require('node:vm'), 'compileFunction')
    expect(() => isolated({ bytes: Buffer.concat([original, Buffer.from('\n')]) }).loadPptxtojson()).toThrow(/digest/)
    expect(compile).not.toHaveBeenCalled()
  })
  it('fails closed on compilation failure and does not cache failure', () => {
    const runtime = isolated()
    const compile = vi.spyOn(require('node:vm'), 'compileFunction').mockImplementationOnce(() => {
      throw new SyntaxError('compilation rejected')
    })
    expect(() => runtime.loadPptxtojson()).toThrow('compilation rejected')
    compile.mockRestore()
    expect(runtime.loadPptxtojson().parse).toBeTypeOf('function')
  })
  it('rejects a compiled module without a parse function', () => {
    vi.spyOn(require('node:vm'), 'compileFunction').mockReturnValue(() => {})
    expect(() => isolated().loadPptxtojson()).toThrow(/export/)
  })
})

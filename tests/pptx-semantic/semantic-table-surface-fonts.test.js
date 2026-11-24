import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let browser, page, bytes, hash
beforeAll(async () => {
  bytes = [...await readFile('server/vendor/katex/dist/fonts/KaTeX_Main-Regular.ttf')]
  hash = createHash('sha256').update(Buffer.from(bytes)).digest('hex')
  const names = ['pptx-text-document', 'pptx-text-layout-font',
    'pptx-text-layout-browser-line', 'pptx-text-layout-browser', 'pptx-table-runtime-fonts']
  const factories = (await Promise.all(names.map(async (name) =>
    `factories['${name}']=(module,require)=>{${await readFile(`shared/src/${name}.js`, 'utf8')}\n};`))).join('\n')
  browser = await chromium.launch({ headless: true })
  page = await browser.newPage()
  await page.route('http://127.0.0.1/table-font-runtime', (route) => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><body></body>',
  }))
  await page.goto('http://127.0.0.1/table-font-runtime')
  await page.addScriptTag({ content: `const factories={},loaded={}; ${factories}
    globalThis.load=(name)=>{name=name.replace(/^\\.\\//,'').replace(/\\.js$/,'');
    if(!loaded[name]){const m={exports:{}};loaded[name]=m;factories[name](m,load)}return loaded[name].exports};` })
})
afterAll(async () => { await page?.close(); await browser?.close() })

describe('table output font registration', () => {
  it('registers identical verified bytes in the output document and disposes only its own faces', async () => {
    const result = await page.evaluate(async ({ bytes, hash }) => {
      const { createTableFontRuntime } = globalThis.load('pptx-table-runtime-fonts')
      const input = { document, fontProfile: { schemaVersion: 1, faces: [
        { id: 'main', typeface: 'KaTeX Main', assetHash: hash },
      ] }, assets: [{ faceId: 'main', bytes: new Uint8Array(bytes).buffer }] }
      const baseline = document.fonts.size
      const first = await createTableFontRuntime(input)
      const second = await createTableFontRuntime(input)
      const aliasesDiffer = first.fontFamilies.main !== second.fontFamilies.main
      const valid = first.measurement.validate(first.fontProfile, first.rendererProfile)
      const asset = first.getFontAsset('main')
      const assetMatches = [...new Uint8Array(asset.bytes)].every((v, i) => v === bytes[i])
      const loaded = [...document.fonts].find((face) => face.family === first.fontFamilies.main)
      first.dispose()
      const stale = first.measurement.validate(first.fontProfile, first.rendererProfile)
      const remaining = document.fonts.size - baseline
      second.dispose()
      return { aliasesDiffer, valid, assetMatches, loaded: loaded.status, stale, remaining,
        final: document.fonts.size - baseline, frames: document.querySelectorAll('iframe').length }
    }, { bytes, hash })
    expect(result).toEqual({ aliasesDiffer: true, valid: null, assetMatches: true,
      loaded: 'loaded', stale: 'stale-table-output-fonts', remaining: 1, final: 0, frames: 0 })
  })

  it('rejects mismatched bytes without leaving an output face or private measurement frame', async () => {
    const result = await page.evaluate(async ({ bytes }) => {
      const { createTableFontRuntime } = globalThis.load('pptx-table-runtime-fonts')
      const baseline = document.fonts.size
      try {
        await createTableFontRuntime({ document, fontProfile: { schemaVersion: 1, faces: [
          { id: 'main', typeface: 'KaTeX Main', assetHash: '0'.repeat(64) },
        ] }, assets: [{ faceId: 'main', bytes: new Uint8Array(bytes).buffer }] })
        return { accepted: true }
      } catch (error) {
        return { accepted: false, code: error.code, faces: document.fonts.size - baseline,
          frames: document.querySelectorAll('iframe').length }
      }
    }, { bytes })
    expect(result).toEqual({ accepted: false, code: 'PPTX_TABLE_FONT_UNAVAILABLE', faces: 0, frames: 0 })
  })

  it('invalidates measurement when a registered output alias is changed', async () => {
    const result = await page.evaluate(async ({ bytes, hash }) => {
      const { createTableFontRuntime } = globalThis.load('pptx-table-runtime-fonts')
      const runtime = await createTableFontRuntime({ document,
        fontProfile: { schemaVersion: 1, faces: [{ id: 'main', typeface: 'KaTeX Main', assetHash: hash }] },
        assets: [{ faceId: 'main', bytes: new Uint8Array(bytes).buffer }],
      })
      const output = [...document.fonts].find((face) => face.family === runtime.fontFamilies.main)
      output.family = 'changed_output_alias'
      const validity = runtime.measurement.validate(runtime.fontProfile, runtime.rendererProfile)
      runtime.dispose()
      return validity
    }, { bytes, hash })
    expect(result).toBe('stale-table-output-fonts')
  })
})

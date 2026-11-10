// @vitest-environment node
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { build } from 'esbuild'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { importTableFixture, tableFrame, tablePart } from './table-import-fixture'
import { normalizeSemanticPresentation } from '../../shared/src/pptx-semantic-presentation'
const { PNG } = createRequire(import.meta.url)('pngjs')
let browser, page, bytes, hash
beforeAll(async () => {
  bytes = [...await readFile('server/vendor/katex/dist/fonts/KaTeX_Main-Regular.ttf')]
  hash = createHash('sha256').update(Buffer.from(bytes)).digest('hex')
  const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: `globalThis.tableApi = {
    ...require('./shared/src/pptx-table-render-text'), ...require('./shared/src/pptx-table-runtime-fonts') };` },
    bundle: true, platform: 'browser', format: 'iife', write: false })
  browser = await chromium.launch({ headless: true })
  page = await browser.newPage({ viewport: { width: 360, height: 220 } })
  await page.route('http://127.0.0.1/table-overflow', (route) => route.fulfill({ contentType: 'text/html',
    body: '<!doctype html><body style="margin:0;background:white"><main></main></body>' }))
  await page.goto('http://127.0.0.1/table-overflow')
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
}, 30000)
afterAll(async () => { await page?.close(); await browser?.close() })

async function painted(mode) {
  const result = await page.evaluate(async ({ mode, bytes, hash }) => {
    const api = globalThis.tableApi, runtime = await api.createTableFontRuntime({ document,
      fontProfile: { schemaVersion: 1, faces: [{ id: 'main', typeface: 'Overflow Fixture', assetHash: hash }] },
      assets: [{ faceId: 'main', bytes: new Uint8Array(bytes).buffer }] })
    try {
      const source = { properties: mode === null ? {} : { horzOverflow: mode }, textDocument: {
        schemaVersion: 1, componentId: 'body', body: { wrap: false, verticalText: 'horz', verticalAlign: 't',
          autofit: { mode: 'none' }, insetLeftEmu: -190500, insetRightEmu: 0,
          insetTopEmu: -95250, insetBottomEmu: 0 }, paragraphs: [{ componentId: 'p',
          defaultRunProperties: { fontSizePt: 40, fontLatin: { typeface: 'Overflow Fixture' },
            color: { kind: 'srgb', value: '000000' },
            outline: { width: 38100, color: { kind: 'srgb', value: '000000' } } },
          runs: [{ componentId: 'r', kind: 'text', text: 'MMMMM' }] }] } }
      const before = JSON.stringify(source)
      document.querySelector('main').innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="220">' +
        '<g transform="translate(80 80)">' + api.cellText(source, 381000, 95250, runtime) + '</g></svg>'
      await document.fonts.ready
      return { intact: before === JSON.stringify(source), text: document.querySelector('[data-pptx-text-run]').textContent }
    } finally { runtime.dispose() }
  }, { mode, bytes, hash })
  return { ...result, png: PNG.sync.read(await page.screenshot()) }
}
function ink(png, accepts) {
  let count = 0
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    const at = (y * png.width + x) * 4
    if (accepts(x, y) && png.data[at] < 240) count++
  }
  return count
}

describe('authored table-cell horizontal overflow', () => {
  it.each(['overflow', 'clip', null])('preserves authored %s and absent sibling declarations across project reopen', async (mode) => {
    const graphic = mode === null ? tableFrame() : tableFrame().replace('<a:tcPr/>', `<a:tcPr horzOverflow="${mode}"/>`)
    const { presentation } = await importTableFixture({ graphic })
    const restored = normalizeSemanticPresentation(JSON.parse(JSON.stringify(presentation)))
    const table = Object.values(restored.pptxSemantic.definitions).find((definition) => definition.kind === 'table').content.tableDocument
    if (mode === null) expect(table.rows[0].cells[0].properties).not.toHaveProperty('horzOverflow')
    else expect(table.rows[0].cells[0].properties.horzOverflow).toBe(mode)
    expect(table.rows[0].cells[1].properties).not.toHaveProperty('horzOverflow')
    expect(restored.pptxSemantic).toEqual(presentation.pptxSemantic)
  })
  it.each(['bad', '', 'CLIP', '1'])('rejects invalid authored horizontal overflow %s at tcPr', async (value) => {
    await expect(importTableFixture({ graphic: tableFrame().replace('<a:tcPr/>', `<a:tcPr horzOverflow="${value}"/>`) }))
      .rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED', sourceLocation: { partUri: tablePart, localName: 'tcPr' } })
  })
  it('rejects a cell-only declaration on table properties', async () => {
    await expect(importTableFixture({ graphic: tableFrame().replace('<a:tblPr ', '<a:tblPr horzOverflow="clip" ') }))
      .rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED', sourceLocation: { localName: 'tblPr' } })
  })
  it('clips horizontal ink by default and explicitly, without cutting vertical overflow or outline ink', async () => {
    const overflow = await painted('overflow')
    expect(overflow).toMatchObject({ intact: true, text: 'MMMMM' })
    expect(ink(overflow.png, (x) => x < 80)).toBeGreaterThan(0)
    expect(ink(overflow.png, (x) => x >= 120)).toBeGreaterThan(0)
    expect(ink(overflow.png, (x, y) => x >= 80 && x < 120 && (y < 80 || y >= 90))).toBeGreaterThan(0)
    for (const mode of ['clip', null]) {
      const clipped = await painted(mode)
      expect(clipped).toMatchObject({ intact: true, text: 'MMMMM' })
      expect(ink(clipped.png, (x) => x < 80 || x >= 120)).toBe(0)
      for (let y = 0; y < overflow.png.height; y++) {
        const start = (y * overflow.png.width + 80) * 4
        expect(clipped.png.data.subarray(start, start + 40 * 4)).toEqual(overflow.png.data.subarray(start, start + 40 * 4))
      }
    }
  })
})

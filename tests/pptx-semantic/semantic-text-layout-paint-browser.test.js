// @vitest-environment node
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { build } from 'esbuild'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let browser, page, fontBytes
const hash = 'd0332f52868370fd83ae7fa46470f90c8f2eab2fcf12bc4f88080b340c95a830'
beforeAll(async () => {
  fontBytes = [...await readFile('server/vendor/katex/dist/fonts/KaTeX_Main-Regular.ttf')]
  expect(createHash('sha256').update(Buffer.from(fontBytes)).digest('hex')).toBe(hash)
  const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: `
    globalThis.textPaint = {
      ...require('./shared/src/pptx-text-layout'),
      ...require('./shared/src/pptx-textbox-svg'),
      ...require('./shared/src/pptx-table-runtime-fonts'),
    };` }, bundle: true, platform: 'browser', format: 'iife', write: false })
  browser = await chromium.launch({ headless: true })
  page = await browser.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 2 })
  await page.route('http://127.0.0.1/text-paint', (route) => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><body style="margin:0"><main id="output"></main></body>',
  }))
  await page.goto('http://127.0.0.1/text-paint')
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
}, 30000)
afterAll(async () => { await page?.close(); await browser?.close() })

async function paint(change = {}) {
  return page.evaluate(async ({ fontBytes, hash, change }) => {
    const api = globalThis.textPaint
    const runtime = await api.createTableFontRuntime({ document,
      fontProfile: { schemaVersion: 1, faces: [{ id: 'main', typeface: 'Fixture Main', assetHash: hash }] },
      assets: [{ faceId: 'main', bytes: new Uint8Array(fontBytes).buffer }],
    })
    const source = { schemaVersion: 1, componentId: 'body', body: {
      insetLeftEmu: 9525, insetRightEmu: 0, insetTopEmu: 19050, insetBottomEmu: 0,
      wrap: false, verticalText: 'horz', verticalAlign: 't', autofit: { mode: 'none' }, ...change.body,
    }, paragraphs: [{ componentId: 'p', properties: change.properties ?? {
      lineSpacing: { unit: 'points', value: 40 },
    }, defaultRunProperties: { fontSizePt: 12, fontLatin: { typeface: 'Fixture Main' }, kerningPt: 0 },
    endRunProperties: change.endRunProperties ?? { fontSizePt: 36 },
    runs: change.runs ?? [
      { componentId: 'small', kind: 'text', text: 'M', properties: { baseline: 0 } },
      { componentId: 'large', kind: 'text', text: 'M', properties: { fontSizePt: 24 } },
      { componentId: 'br', kind: 'break' },
      { componentId: 'last', kind: 'text', text: 'M' },
    ] }] }
    const element = { id: 'text', type: 'text', width: 400, height: 300, pptxTextDocument: source }
    const input = { document: source,
      shape: { widthEmu: 3810000, heightEmu: 2857500, textRectEmu: { l: 0, t: 0, r: 3810000, b: 2857500 } },
      fontProfile: runtime.fontProfile, rendererProfile: runtime.rendererProfile }
    const before = JSON.stringify(source), output = document.getElementById('output')
    try {
      const layout = api.layoutTextDocument(input, runtime.measurement)
      const markup = api.textBoxSvgString(element, { fontRuntime: runtime })
      output.style.cssText = 'position:relative;width:400px;height:300px;font-weight:bold;font-style:italic;letter-spacing:9px;'
      output.innerHTML = markup
      const frame = output.querySelector('svg').getBoundingClientRect()
      const boxes = [...output.querySelectorAll('[data-pptx-text-run]')].map((span) => {
        const range = document.createRange()
        range.selectNodeContents(span)
        const box = range.getBoundingClientRect()
        return { id: span.getAttribute('data-pptx-text-run'), x: box.x - frame.x, y: box.y - frame.y,
          width: box.width, height: box.height, align: span.style.verticalAlign,
          direction: span.style.direction, color: span.style.color }
      })
      let decimalX
      const decimal = [...output.querySelectorAll('[data-pptx-text-run]')]
        .find((node) => node.textContent.includes('.'))
      if (decimal?.firstChild?.nodeType === 3) {
        const range = document.createRange(), index = decimal.textContent.indexOf('.')
        range.setStart(decimal.firstChild, index); range.setEnd(decimal.firstChild, index + 1)
        decimalX = range.getBoundingClientRect().x - frame.x
      }
      const struts = [...output.querySelectorAll('[data-pptx-text-strut]')]
        .map((node) => ({ id: node.getAttribute('data-pptx-text-strut'), size: node.style.fontSize }))
      if (change.foreignAlias) {
        const alias = Object.values(runtime.fontFamilies)[0]
        const foreign = new document.defaultView.FontFace(alias, new Uint8Array(fontBytes).buffer, { style: 'normal', weight: '700' })
        document.fonts.add(foreign)
        const invalidated = api.layoutTextDocument(input, runtime.measurement)
        return { layout, boxes, struts, markup, decimalX, stale: invalidated, intact: before === JSON.stringify(source) }
      }
      runtime.dispose()
      const stale = api.layoutTextDocument(input, runtime.measurement)
      return { layout, boxes, struts, markup, decimalX, stale, intact: before === JSON.stringify(source) }
    } finally { runtime.dispose(); output.replaceChildren() }
  }, { fontBytes, hash, change })
}

describe('shared source-font measured line paint at declared DPR', () => {
  it('paints source-derived 12/24pt M runs and point-spaced lines at measured boxes, retaining end-run struts', async () => {
    const { layout, boxes, struts, intact, stale } = await paint()
    expect(layout).toMatchObject({ status: 'measured', qualified: false, issues: [] })
    expect(layout.rendererProfile.devicePixelRatio).toBe(2)
    expect(layout.lines[0].width).toBeCloseTo(917 / 1000 * (16 + 32), 1)
    expect(layout.lines[1].baseline - layout.lines[0].baseline).not.toBe(0)
    expect(layout.lines[1].y - layout.lines[0].y).toBeCloseTo(40 * 4 / 3, 5)
    for (const line of layout.lines) for (const run of line.runs) {
      const painted = boxes.find((box) => box.id === run.componentId)
      expect(painted).toBeDefined()
      for (const key of ['x', 'y', 'width', 'height']) expect(painted[key]).toBeCloseTo(run.rects[0][key], 2)
    }
    expect(boxes.find((box) => box.id === 'small').align).toBe('baseline')
    expect(struts).toContainEqual({ id: 'p', size: '36pt' })
    expect(intact).toBe(true)
    expect(stale).toMatchObject({ status: 'unsupported', qualified: false, lines: [],
      issues: [expect.objectContaining({ code: 'stale-table-output-fonts' })] })
  })

  it('aligns the declared decimal glyph from the actual shaped prefix, not string-length estimates', async () => {
    const { layout, decimalX } = await paint({ properties: {
      tabs: [{ positionEmu: 914400, alignment: 'dec' }],
    }, endRunProperties: {}, runs: [{ componentId: 'r', kind: 'text', text: 'M\t12.5' }] })
    expect(layout).toMatchObject({ status: 'measured', qualified: false, issues: [] })
    expect(decimalX).toBeCloseTo(1 + 96, 1)
  })

  it('paints authored bullet color/size and normal-autofit factors without an 8pt floor', async () => {
    const { layout, boxes, intact } = await paint({
      body: { autofit: { mode: 'normal', fontScale: 50000, lineSpaceReduction: 25000 } },
      properties: { marginLeftEmu: 190500, indentEmu: -190500,
        bullet: { kind: 'character', character: '+' },
        bulletColor: { kind: 'srgb', value: '123456' }, bulletSize: { unit: 'points', value: 5 } },
      endRunProperties: {}, runs: [{ componentId: 'tiny', kind: 'text', text: 'M', properties: { fontSizePt: 5.125 } }],
    })
    expect(layout).toMatchObject({ status: 'measured', qualified: false, issues: [] })
    expect(layout.lines[0].runs[0]).toMatchObject({ sourceFontSizePt: 5.125, fontSizePt: 2.5625 })
    expect(layout.lines[0].bullet).toMatchObject({ sourceFontSizePt: 5, fontSizePt: 2.5 })
    expect(boxes.find((box) => box.id === 'p').color).toBe('rgb(18, 52, 86)')
    const bullet = layout.lines[0].bullet
    const painted = boxes.find((box) => box.id === 'p')
    for (const key of ['x', 'y', 'width', 'height']) expect(painted[key]).toBeCloseTo(bullet.rects[0][key], 2)
    expect(intact).toBe(true)
  })
  it('retains canonical field identity when the measured fragment is a shaped text run', async () => {
    const { layout, markup } = await paint({ endRunProperties: {},
      runs: [{ componentId: 'field', kind: 'field', text: 'M', field: { id: 'native-field', type: 'slidenum' } }],
    })
    expect(layout.status).toBe('measured')
    expect(markup).toContain('data-pptx-field-id="native-field"')
    expect(markup).toContain('data-pptx-field-type="slidenum"')
    expect(markup).toContain('data-pptx-text-offset="0:1"')
  })

  it('invalidates runtime validation when a foreign FontFace claims an owned family alias', async () => {
    const { layout, stale } = await paint({ foreignAlias: true })
    expect(layout.status).toBe('measured')
    expect(stale).toMatchObject({
      status: 'unsupported',
      qualified: false,
      lines: [],
      issues: [expect.objectContaining({ code: 'stale-table-output-fonts' })],
    })
  })
})

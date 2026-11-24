// @vitest-environment node
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { renderSlideElements } = require('../../shared/src/element-renderers')
const { generateRevealHTML, generatePrintHTML } = require('../../shared/src/htmlGenerator')
const { collectSemanticFontRequests } = require('../../shared/src/pptx-source-font-request')
let browser, page, bytes
const hash = 'd0332f52868370fd83ae7fa46470f90c8f2eab2fcf12bc4f88080b340c95a830'
function fixture() {
  const text = { schemaVersion: 1, componentId: 'body', body: {
    insetLeftEmu: 9525, insetTopEmu: 19050, insetRightEmu: 0, insetBottomEmu: 0,
    wrap: false, verticalText: 'horz', verticalAlign: 't', autofit: { mode: 'none' },
  }, paragraphs: [{ componentId: 'p', properties: { lineSpacing: { unit: 'points', value: 40 } },
    defaultRunProperties: { fontLatin: { typeface: 'Fixture Main' }, fontSizePt: 12 },
    runs: [{ componentId: 'r1', kind: 'text', text: 'M', properties: { baseline: 0 } },
      { componentId: 'r2', kind: 'text', text: 'M', properties: { fontSizePt: 24 } }] }] }
  const semantic = { schemaVersion: 1, styles: {}, fonts: {}, definitions: { d: {
    id: 'd', kind: 'text', source: { partUri: 'ppt/slides/slide1.xml', nativeId: '2', preconditionHash: 'a'.repeat(64) },
    components: [{ id: 'body', kind: 'property', locator: { path: [0, 2], preconditionHash: 'a'.repeat(64) } }],
    content: { textDocument: text, extent: { cx: 3810000, cy: 2857500 } },
  } }, instances: { i: { id: 'i', definitionId: 'd', slideId: 's', parentInstanceId: null,
    localTransform: [1, 0, 0, 1, 0, 0], paintIndex: 0, overrides: {} } } }
  const element = { id: 't', pptxInstanceId: 'i', type: 'text', x: 0, y: 0, width: 400, height: 300,
    content: '<p>Wrong cached text must never become layout authority</p>' }
  return { id: 'deck', title: 'Text layout', width: 400, height: 300, pptxSemantic: semantic,
    slides: [{ id: 's', elements: [element] }] }
}
function resources(semantic) {
  const request = collectSemanticFontRequests(semantic)
  expect(request.issues).toEqual([])
  return { schemaVersion: 1, sourceIdentity: createHash('sha256').update(request.identity).digest('hex'),
    fontProfile: { schemaVersion: 1, faces: request.faces.map(({ faceId, ...face }) => ({ id: faceId, ...face, assetHash: hash })) },
    assets: request.faces.map(({ faceId }) => ({ faceId, bytesBase64: Buffer.from(bytes).toString('base64') })) }
}
beforeAll(async () => {
  bytes = [...await readFile('server/vendor/katex/dist/fonts/KaTeX_Main-Regular.ttf')]
  expect(createHash('sha256').update(Buffer.from(bytes)).digest('hex')).toBe(hash)
  const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: `globalThis.textOutput = {
    ...require('./shared/src/pptx-semantic-output-browser'),
    ...require('./shared/src/pptx-table-runtime-fonts'),
    ...require('./shared/src/pptx-textbox-svg'),
  }` }, platform: 'browser', format: 'iife', bundle: true, write: false })
  browser = await chromium.launch({ headless: true })
  page = await browser.newPage({ viewport: { width: 900, height: 650 }, deviceScaleFactor: 1 })
  await page.route('http://127.0.0.1/text-output', (route) => route.fulfill({ contentType: 'text/html',
    body: '<!doctype html><body style="margin:0"><main id="output" style="position:relative;width:400px;height:300px"></main><main id="canvas" style="position:relative;width:400px;height:300px"></main></body>' }))
  await page.goto('http://127.0.0.1/text-output')
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
}, 30000)
afterAll(async () => { await page?.close(); await browser?.close() })

describe('canonical generated-text mounts using the existing output lifecycle', () => {
  it('hydrates the same authored 12/24pt layout as canvas and rebuilds stale output fonts', async () => {
    const deck = fixture(), before = structuredClone(deck), mounts = []
    const html = renderSlideElements(deck.slides[0], { pptxSemantic: deck.pptxSemantic, semanticOutputMounts: mounts })
    expect(html).not.toContain('Wrong cached text')
    expect(mounts).toEqual([{ instanceId: 'i', slideId: 's', kind: 'text', type: 'text' }])
    const resource = resources(deck.pptxSemantic)
    for (const generate of [generateRevealHTML, generatePrintHTML]) {
      const document = generate(deck, { autoPrint: false, semanticOutputResources: resource })
      expect(document).toContain('data-pptx-semantic-mount="i"')
      expect(document).toContain('"kind":"text"')
      expect(document).not.toContain('overflow-wrap:anywhere')
    }
    const result = await page.evaluate(async ({ html, semantic, mounts, resource, bytes }) => {
      const api = globalThis.textOutput, output = document.getElementById('output'), canvas = document.getElementById('canvas')
      output.innerHTML = html
      const payload = { semantic, mounts, resources: resource }
      const handle = api.startSemanticOutput(document, payload)
      let runtime
      try {
        await handle.ready
        runtime = await api.createTableFontRuntime({ document, fontProfile: resource.fontProfile,
          assets: [{ faceId: 'source-0', bytes: new Uint8Array(bytes).buffer }] })
        canvas.innerHTML = api.textBoxSvgString({ width: 400, height: 300,
          pptxTextDocument: semantic.definitions.d.content.textDocument }, { fontRuntime: runtime })
        const boxes = (root) => {
          const origin = root.getBoundingClientRect()
          return [...root.querySelectorAll('[data-pptx-text-run]')].map((node) => {
            const range = document.createRange(); range.selectNodeContents(node)
            const box = range.getBoundingClientRect()
            return { id: node.getAttribute('data-pptx-text-run'), x: box.x - origin.x, y: box.y - origin.y,
              width: box.width, height: box.height }
          })
        }
        const outputBoxes = boxes(output), canvasBoxes = boxes(canvas)
        const beforeFamily = output.querySelector('[data-pptx-text-run]').style.fontFamily
        const state = handle.state
        document.querySelector('iframe[data-pptx-text-measurement]').contentDocument.fonts.clear()
        await handle.ensureReady()
        return { state, outputBoxes, canvasBoxes, rebuilt: beforeFamily !== output.querySelector('[data-pptx-text-run]').style.fontFamily,
          layout: output.querySelector('[data-pptx-text-layout]').getAttribute('data-pptx-text-layout') }
      } finally { handle.dispose(); runtime?.dispose(); output.replaceChildren(); canvas.replaceChildren() }
    }, { html, semantic: deck.pptxSemantic, mounts, resource, bytes })
    expect(result.state).toBe('ready')
    expect(result.layout).toBe('measured')
    expect(result.rebuilt).toBe(true)
    expect(result.outputBoxes.map((box) => box.id)).toEqual(['r1', 'r2'])
    for (let i = 0; i < result.outputBoxes.length; i++) for (const key of ['x', 'y', 'width', 'height'])
      expect(result.outputBoxes[i][key]).toBeCloseTo(result.canvasBoxes[i][key], 3)
    expect(result.outputBoxes[0].width).toBeCloseTo(917 / 1000 * 16, 1)
    expect(deck).toEqual(before)
  })

  it('rejects missing exact font resources and clears preview rather than claiming a ready layout', async () => {
    const deck = fixture(), mounts = []
    const html = renderSlideElements(deck.slides[0], { pptxSemantic: deck.pptxSemantic, semanticOutputMounts: mounts })
    const result = await page.evaluate(async ({ html, semantic, mounts }) => {
      const output = document.getElementById('output'); output.innerHTML = html
      const handle = globalThis.textOutput.startSemanticOutput(document, { semantic, mounts, resources: null })
      try {
        let code
        try { await handle.ready } catch (error) { code = error.code }
        return { state: handle.state, code, painted: output.querySelector('[data-pptx-text-layout-line]') !== null,
          alert: output.querySelector('[role="alert"]')?.textContent }
      } finally { handle.dispose(); output.replaceChildren() }
    }, { html, semantic: deck.pptxSemantic, mounts })
    expect(result).toMatchObject({ state: 'error', code: 'semantic-output-fonts', painted: false })
    expect(result.alert).toContain('Canonical output unavailable')
  })
})

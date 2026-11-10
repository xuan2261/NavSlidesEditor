// @vitest-environment node
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
const { PNG } = createRequire(import.meta.url)('pngjs')
let browser, page, bytes, hash
beforeAll(async () => {
  bytes = [...await readFile('server/vendor/katex/dist/fonts/KaTeX_Main-Regular.ttf')]
  hash = createHash('sha256').update(Buffer.from(bytes)).digest('hex')
  const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: `globalThis.highlightApi = {
    ...require('./shared/src/pptx-textbox-svg'), ...require('./shared/src/pptx-shape-label'),
    ...require('./shared/src/pptx-table-runtime-fonts'),
    Editor: require('./client/node_modules/@tiptap/core/dist/index.js').Editor,
    ...require('./client/src/hooks/editor-controller/editor-rich-text-extensions'),
    ...require('./client/src/utils/pptx-semantic-text-bridge') };` }, bundle: true, platform: 'browser', format: 'iife', write: false,
    define: { 'process.env.NODE_ENV': '"test"' } })
  browser = await chromium.launch({ headless: true })
  page = await browser.newPage({ viewport: { width: 400, height: 200 } })
  await page.route('http://127.0.0.1/highlight-paint', (route) => route.fulfill({ contentType: 'text/html',
    body: '<!doctype html><body style="margin:0;background:white"><main style="width:400px;height:200px"></main></body>' }))
  await page.goto('http://127.0.0.1/highlight-paint')
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
}, 30000)
afterAll(async () => {
  if (page) await page.evaluate(() => globalThis.highlightRuntime?.dispose())
  await page?.close(); await browser?.close()
})
async function paint(sink, clear) {
  return page.evaluate(async ({ bytes, hash, sink, clear }) => {
    globalThis.highlightRuntime?.dispose()
    const api = globalThis.highlightApi, runtime = await api.createTableFontRuntime({ document,
      fontProfile: { schemaVersion: 1, faces: [{ id: 'main', typeface: 'Highlight Fixture', assetHash: hash }] },
      assets: [{ faceId: 'main', bytes: new Uint8Array(bytes).buffer }] })
    globalThis.highlightRuntime = runtime
    try {
      const source = { schemaVersion: 1, componentId: 'body', body: {
        wrap: false, verticalText: 'horz', verticalAlign: 't', autofit: { mode: 'none' },
        insetLeftEmu: 95250, insetTopEmu: 95250, insetRightEmu: 0, insetBottomEmu: 0,
      }, paragraphs: [{ componentId: 'p', defaultRunProperties: {
        fontSizePt: 60, fontLatin: { typeface: 'Highlight Fixture' }, color: { kind: 'srgb', value: '000000' },
        highlight: { kind: 'preset', value: 'red', transforms: [{ kind: 'alpha', value: 50000 }] },
      }, runs: [{ componentId: 'r', kind: 'text', text: 'M M', ...(clear ? { properties: { highlight: { kind: 'none' } } } : {}) }] }] }
      const before = JSON.stringify(source), options = { fontRuntime: runtime, requireMeasuredText: true }
      const element = { width: 400, height: 200, pptxTextDocument: source }
      const markup = sink === 'textbox' ? api.textBoxSvgString(element, options) :
        `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200">${api.shapeLabelSvgString(element, options)}</svg>`
      document.querySelector('main').innerHTML = markup
      await document.fonts.ready
      const run = document.querySelector('[data-pptx-text-run="r"]')
      return { markup, text: run.textContent, tag: run.tagName, background: getComputedStyle(run).backgroundColor,
        intact: before === JSON.stringify(source), foreignObject: !!run.closest('foreignObject'),
        layout: document.querySelector('[data-pptx-text-layout]')?.getAttribute('data-pptx-text-layout') }
    } catch (error) { runtime.dispose(); throw error }
  }, { bytes, hash, sink, clear })
}
function redPixels(png) {
  let count = 0
  for (let i = 0; i < png.data.length; i += 4)
    if (png.data[i] > 240 && png.data[i + 1] > 100 && png.data[i + 1] < 160 && png.data[i + 2] > 100 && png.data[i + 2] < 160) count++
  return count
}
describe('real Chromium typed highlight editor and measured paint (not native qualification)', () => {
  it('selects and edits inherited scheme highlight, clears it explicitly, types, undoes and reopens without mutating source', async () => {
    const result = await page.evaluate(() => {
      const api = globalThis.highlightApi, host = document.querySelector('main')
      host.replaceChildren()
      const source = { schemaVersion: 1, componentId: 'edit-body', paragraphs: [{ componentId: 'p',
        defaultRunProperties: { fontSizePt: 40, highlight: { kind: 'scheme', value: 'accent1' } }, runs: [
          { componentId: 'r', kind: 'text', text: 'MN' },
        ] }] }
      const before = JSON.stringify(source), paint = structuredClone(source)
      paint.paragraphs[0].defaultRunProperties.highlight = { kind: 'srgb', value: 'FF0000', transforms: [{ kind: 'alpha', value: 50000 }] }
      const editor = new api.Editor({ element: host, extensions: api.createEditorRichTextExtensions(),
        content: api.semanticTextToTipTap(source, paint) })
      try {
        const background = getComputedStyle(host.querySelector('mark')).backgroundColor
        const noOp = api.semanticTextFromTipTap(editor.getJSON())
        editor.commands.setTextSelection({ from: 1, to: 3 }); editor.view.focus()
        const selected = window.getSelection().toString()
        editor.commands.unsetHighlight()
        const cleared = api.semanticTextFromTipTap(editor.getJSON())
        editor.commands.undo()
        const undone = api.semanticTextFromTipTap(editor.getJSON())
        editor.commands.redo()
        editor.chain().setTextSelection(2).insertContent('X').run()
        const edited = api.semanticTextFromTipTap(editor.getJSON()), html = api.preserveBlockColors(editor.getHTML())
        editor.commands.setContent(html, { emitUpdate: false })
        const reopened = api.semanticTextFromTipTap(editor.getJSON()), htmlHasHighlight = !!host.querySelector('mark')
        editor.commands.setContent(api.semanticTextToTipTap(reopened, paint), { emitUpdate: false })
        return { background, noOp, selected, cleared, undone, edited, reopened, htmlHasHighlight,
          projectedHasHighlight: !!host.querySelector('mark'), intact: before === JSON.stringify(source), source }
      } finally { editor.destroy(); host.replaceChildren() }
    })
    expect(result.background).toBe('rgba(255, 0, 0, 0.5)')
    expect(result.selected).toBe('MN')
    expect(result.noOp).toEqual(result.source)
    expect(result.undone).toEqual(result.source)
    expect(result.cleared.paragraphs[0].runs[0].properties.highlight).toEqual({ kind: 'none' })
    expect(result.edited.paragraphs[0].runs.map((run) => run.text).join('')).toBe('MXN')
    expect(result.edited.paragraphs[0].runs.every((run) => run.properties.highlight.kind === 'none')).toBe(true)
    expect(result.reopened).toEqual(result.edited)
    expect(result.htmlHasHighlight).toBe(false)
    expect(result.projectedHasHighlight).toBe(false)
    expect(result.intact).toBe(true)
  })
  it.each(['textbox', 'shape'])('paints alpha highlight pixels on retained measured %s HTML spans and removes inherited paint with none', async (sink) => {
    const ink = await paint(sink, false)
    expect(ink).toMatchObject({ text: 'M M', background: 'rgba(255, 0, 0, 0.5)', intact: true, foreignObject: true, layout: 'measured' })
    expect(ink.tag.toLowerCase()).toBe('span')
    expect(ink.markup).not.toMatch(/<image|<path/)
    expect(redPixels(PNG.sync.read(await page.screenshot()))).toBeGreaterThan(100)
    const none = await paint(sink, true)
    expect(none).toMatchObject({ background: 'rgba(0, 0, 0, 0)', intact: true })
    expect(redPixels(PNG.sync.read(await page.screenshot()))).toBe(0)
  })
})

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
  const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: `globalThis.outlineApi = {
    ...require('./shared/src/pptx-textbox-svg'), ...require('./shared/src/pptx-table-render-text'),
    ...require('./shared/src/pptx-table-runtime-fonts'),
    Editor: require('./client/node_modules/@tiptap/core/dist/index.js').Editor,
    ...require('./client/src/hooks/editor-controller/editor-rich-text-extensions'),
    ...require('./client/src/utils/pptx-semantic-text-bridge'),
    ...require('./shared/src/content-safety') };` }, bundle: true, platform: 'browser', format: 'iife', write: false,
    define: { 'process.env.NODE_ENV': '"test"' } })
  browser = await chromium.launch({ headless: true })
  page = await browser.newPage({ viewport: { width: 400, height: 200 } })
  await page.route('http://127.0.0.1/outline-paint', (route) => route.fulfill({ contentType: 'text/html',
    body: '<!doctype html><body style="margin:0;background:white"><main style="width:400px;height:200px"></main></body>' }))
  await page.goto('http://127.0.0.1/outline-paint')
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
}, 30000)
afterAll(async () => {
  if (page) await page.evaluate(() => globalThis.outlineRuntime?.dispose())
  await page?.close(); await browser?.close()
})

async function paint(sink, noFill) {
  return page.evaluate(async ({ bytes, hash, sink, noFill }) => {
    globalThis.outlineRuntime?.dispose()
    const api = globalThis.outlineApi, runtime = await api.createTableFontRuntime({ document,
      fontProfile: { schemaVersion: 1, faces: [{ id: 'main', typeface: 'Outline Fixture', assetHash: hash }] },
      assets: [{ faceId: 'main', bytes: new Uint8Array(bytes).buffer }] })
    globalThis.outlineRuntime = runtime
    try {
      const source = { schemaVersion: 1, componentId: 'body', body: {
        wrap: false, verticalText: 'horz', verticalAlign: 't', autofit: { mode: 'none' },
        insetLeftEmu: 95250, insetTopEmu: 95250, insetRightEmu: 0, insetBottomEmu: 0,
      }, paragraphs: [{ componentId: 'p', defaultRunProperties: {
        fontSizePt: 60, fontLatin: { typeface: 'Outline Fixture' }, color: { kind: 'srgb', value: '0000FF' },
        outline: { width: 38100, color: { kind: 'srgb', value: 'FF0000', transforms: [{ kind: 'alpha', value: 50000 }] } },
      }, runs: [{ componentId: 'r', kind: 'text', text: 'M', ...(noFill ? { properties: {
        outline: { fill: 'none', color: { kind: 'none' } },
      } } : {}) }] }] }
      const before = JSON.stringify(source)
      const markup = sink === 'textbox' ? api.textBoxSvgString({ width: 400, height: 200,
        pptxTextDocument: source }, { fontRuntime: runtime, requireMeasuredText: true }) :
        `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200">${api.cellText({
          properties: {}, textDocument: source }, 3810000, 1905000, runtime)}</svg>`
      document.querySelector('main').innerHTML = markup
      await document.fonts.ready
      const run = document.querySelector('[data-pptx-text-run="r"]'), css = getComputedStyle(run)
      return { markup, text: run.textContent, tag: run.tagName, stroke: css.stroke,
        width: sink === 'textbox' ? css.webkitTextStrokeWidth : css.strokeWidth,
        color: css.webkitTextStrokeColor, intact: before === JSON.stringify(source),
        layout: document.querySelector('[data-pptx-text-layout]')?.getAttribute('data-pptx-text-layout') }
    } catch (error) { runtime.dispose(); throw error }
  }, { bytes, hash, sink, noFill })
}
function redPixels(png) {
  let count = 0
  for (let i = 0; i < png.data.length; i += 4)
    if (png.data[i] > 200 && png.data[i + 1] < 200 && png.data[i + 2] < 200) count++
  return count
}
describe('real Chromium editable outline paint (not native qualification)', () => {
  it('mounts the real editable editor, computes visible stroke, selects text, edits and preserves canonical/HTML roundtrips', async () => {
    const result = await page.evaluate(() => {
      const api = globalThis.outlineApi, host = document.querySelector('main')
      host.replaceChildren()
      const outline = { width: 19050, color: { kind: 'srgb', value: 'FF0000' } }
      const none = { fill: 'none', color: { kind: 'none' } }
      const source = { schemaVersion: 1, componentId: 'edit-body', paragraphs: [{ componentId: 'p',
        defaultRunProperties: { fontSizePt: 40 }, runs: [
          { componentId: 'r', kind: 'text', text: 'M' },
          { componentId: 's', kind: 'text', text: 'N', properties: { outline: none } },
        ] }] }
      // Occurrence paint is materialized separately; never freeze inherited ink
      // into the authored document merely because the user starts typing.
      const paintDocument = structuredClone(source)
      paintDocument.paragraphs[0].defaultRunProperties.outline = outline
      const editor = new api.Editor({ element: host, extensions: api.createEditorRichTextExtensions(),
        content: api.semanticTextToTipTap(source, paintDocument) })
      try {
        const strokes = [...host.querySelectorAll('span[data-pptxrun]')].map((span) => ({
          text: span.textContent, width: getComputedStyle(span).webkitTextStrokeWidth,
          color: getComputedStyle(span).webkitTextStrokeColor,
        }))
        editor.commands.setTextSelection({ from: 1, to: 2 })
        editor.view.focus()
        const selected = window.getSelection().toString()
        editor.commands.insertContent('X')
        const edited = api.semanticTextFromTipTap(editor.getJSON())
        const html = api.preserveBlockColors(editor.getHTML())
        editor.commands.undo()
        const undone = api.semanticTextFromTipTap(editor.getJSON())
        editor.commands.setContent(html, { emitUpdate: false })
        const reopened = api.semanticTextFromTipTap(editor.getJSON())
        const reopenedWidth = getComputedStyle(host.querySelector('span[data-pptxrun]')).webkitTextStrokeWidth
        const compatibility = document.createElement('div')
        compatibility.innerHTML = api.sanitizeRichTextHtml(html)
        document.body.append(compatibility)
        const compatibilityWidth = getComputedStyle(compatibility.querySelector('span')).webkitTextStrokeWidth
        compatibility.remove()
        return { strokes, selected, edited, undone, reopened, reopenedWidth, compatibilityWidth, source }
      } finally { editor.destroy(); host.replaceChildren() }
    })
    expect(result.strokes).toEqual([{ text: 'M', width: '2px', color: 'rgb(255, 0, 0)' },
      { text: 'N', width: '0px', color: 'rgba(0, 0, 0, 0)' }])
    expect(result.selected).toBe('M')
    expect(result.edited.paragraphs[0].runs.map((run) => run.text).join('')).toBe('XN')
    expect(result.edited.paragraphs[0].defaultRunProperties.outline).toEqual(result.source.paragraphs[0].defaultRunProperties.outline)
    expect(result.edited.paragraphs[0].runs[0].properties?.outline).toBeUndefined()
    expect(result.undone).toEqual(result.source)
    expect(result.reopened).toEqual(result.edited)
    expect(result.reopenedWidth).toBe('2px')
    expect(result.compatibilityWidth).toBe('2px')
  })
  it.each(['textbox', 'table'])('paints alpha outline pixels in actual generated %s SVG and removes them for direct noFill', async (sink) => {
    const ink = await paint(sink, false)
    expect(ink).toMatchObject({ text: 'M', width: '4px', intact: true })
    expect(ink.tag.toLowerCase()).toBe(sink === 'textbox' ? 'span' : 'text')
    if (sink === 'textbox') expect(ink.layout).toBe('measured')
    expect(ink.markup).not.toMatch(/<image|<path/)
    const outlined = redPixels(PNG.sync.read(await page.screenshot()))
    expect(outlined).toBeGreaterThan(100)
    const none = await paint(sink, true)
    expect(none).toMatchObject({ text: 'M', width: '0px', intact: true })
    expect(redPixels(PNG.sync.read(await page.screenshot()))).toBe(0)
  })
})

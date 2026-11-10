// @vitest-environment node
import { readFile, readdir, mkdtemp, copyFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import path from 'node:path'
import { build } from 'esbuild'
import { chromium } from 'playwright'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { prepareTextLayout, textLayoutIdentity } from '../../shared/src/pptx-text-layout'

const require = createRequire(import.meta.url)
const M = 'http://schemas.openxmlformats.org/officeDocument/2006/math'
const node = (id, type, children = [], text) => ({ componentId: id, namespaceUri: M,
  type, attributes: [], children, ...(text === undefined ? {} : { text }) })
const equation = { schemaVersion: 1, root: node('math-root', 'oMath', [
  node('fraction', 'f', [node('numerator', 'num', [node('n-run', 'r', [node('n-text', 't', [], '1')])]),
    node('denominator', 'den', [node('d-run', 'r', [node('d-text', 't', [], '2')])])]),
]) }
const face = { id: 'main', typeface: 'Fixture Main', assetHash: 'a'.repeat(64) }
function source(typeface = face.typeface) {
  return { schemaVersion: 1, componentId: 'body', body: {
    insetLeftEmu: 0, insetRightEmu: 0, insetTopEmu: 0, insetBottomEmu: 0,
    wrap: true, verticalText: 'horz', verticalAlign: 't', autofit: { mode: 'none' },
  }, paragraphs: [{ componentId: 'p', defaultRunProperties: { fontSizePt: 18,
    fontLatin: { typeface }, color: { kind: 'srgb', value: '123456' }, italic: false }, runs: [
    { componentId: 'before', kind: 'text', text: 'Let ' },
    { componentId: 'equation', kind: 'equation', ommlDocument: structuredClone(equation) },
    { componentId: 'after', kind: 'text', text: ' be defined.' },
  ] }] }
}
const input = (document = source()) => ({ document,
  shape: { widthEmu: 3810000, heightEmu: 1905000, textRectEmu: { l: 0, t: 0, r: 3810000, b: 1905000 } },
  fontProfile: { schemaVersion: 1, faces: [face] }, rendererProfile: {
    id: 'pptx-explicit-lines-v1', sessionId: 'planning', userAgent: 'fixture', platform: 'fixture',
    language: 'en-US', devicePixelRatio: 1,
  } })

it('plans a typed atomic fraction between text with no synthetic text and preserves the editable AST', () => {
  const request = input(), before = structuredClone(request), plan = prepareTextLayout(request)
  expect(plan.issues).toEqual([])
  const items = plan.paragraphs[0].lines[0].items
  expect(items.map(item => item.kind)).toEqual(['text', 'equation', 'text'])
  expect(items[1]).toMatchObject({ componentId: 'equation', ommlDocument: equation,
    properties: { fontSizePt: 18, fontLatin: { typeface: face.typeface } } })
  expect(items[1]).not.toHaveProperty('text')
  expect(items[1]).not.toHaveProperty('field')
  expect(request).toEqual(before)
  const changed = structuredClone(request)
  changed.document.paragraphs[0].runs[1].ommlDocument.root.children[0].children[0].children[0].children[0].text = '3'
  expect(textLayoutIdentity(changed)).not.toBe(textLayoutIdentity(request))
  items[1].ommlDocument.root.componentId = 'changed'
  expect(request).toEqual(before)
})

let browser, page, plain, math, mathDirectory
// Positive physical-font cases require a genuine local MATH font; never construct
// a fake MATH table or replace it with KaTeX glyph metrics. CI may supply its root.
const mathRoot = process.env.NAVSLIDES_TEST_MATH_FONT_ROOT ??
  (process.platform === 'win32' ? path.join(process.env.WINDIR ?? 'C:/Windows', 'Fonts') : null)
beforeAll(async () => {
  const raw = await readFile('server/vendor/katex/dist/fonts/KaTeX_Main-Regular.ttf')
  plain = { fontProfile: { schemaVersion: 1, faces: [{ ...face,
    assetHash: createHash('sha256').update(raw).digest('hex') }] },
  assets: [{ faceId: 'main', base64: raw.toString('base64') }] }
  if (mathRoot) {
    const { resolveSourceFontAssets } = require('../../server/services/pptx-import/source-font-assets')
    mathDirectory = await mkdtemp(path.join(tmpdir(), 'navslides-inline-math-'))
    const names = await readdir(mathRoot)
    const collection = names.find((name) => /^(?:cambria\.ttc|cambrmath\.ttf)$/i.test(name))
    if (!collection) throw new Error('Provision genuine cambria.ttc or cambrmath.ttf in NAVSLIDES_TEST_MATH_FONT_ROOT')
    await copyFile(path.join(mathRoot, collection), path.join(mathDirectory, collection))
    const resolved = await resolveSourceFontAssets({ roots: [mathDirectory], faces: [{
      faceId: 'main', typeface: 'Cambria Math', bold: false, italic: false,
    }] })
    expect(resolved.unresolved).toEqual([])
    math = { fontProfile: resolved.fontProfile,
      assets: resolved.assets.map(asset => ({ faceId: asset.faceId, base64: Buffer.from(asset.bytes).toString('base64') })) }
  }
  const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: `
    globalThis.inlineLayout={...require('./shared/src/pptx-text-layout'),
      ...require('./shared/src/pptx-textbox-svg'),...require('./shared/src/pptx-table-runtime-fonts'),
      ...require('./shared/src/pptx-text-layout-browser')};` },
  bundle: true, platform: 'browser', format: 'iife', write: false })
  browser = await chromium.launch({ headless: true })
  page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 })
  await page.route('http://127.0.0.1/inline-equation', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><body style="margin:0"><main></main></body>',
  }))
  await page.goto('http://127.0.0.1/inline-equation')
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
}, 30000)
afterAll(async () => {
  await browser?.close()
  if (mathDirectory) await rm(mathDirectory, { recursive: true, force: true })
})

async function paint(fonts, document, width = 400, missingAsset = false) {
  return page.evaluate(async ({ fonts, source, width, missingAsset }) => {
    const api = globalThis.inlineLayout
    const assets = missingAsset ? [] : fonts.assets.map(({ faceId, base64 }) => ({ faceId,
      bytes: Uint8Array.from(atob(base64), char => char.charCodeAt(0)).buffer }))
    const runtime = missingAsset ? null : await api.createTableFontRuntime({ document, ...fonts, assets })
    const boundary = runtime?.measurement ?? await api.createBrowserTextMeasurer({ document, ...fonts, assets })
    const request = { document: source, fontProfile: fonts.fontProfile,
      rendererProfile: runtime?.rendererProfile ?? boundary.profile,
      shape: { widthEmu: width * 9525, heightEmu: 1905000,
        textRectEmu: { l: 0, t: 0, r: width * 9525, b: 1905000 } } }
    const before = JSON.stringify(source), target = document.querySelector('main')
    target.style.cssText = `position:relative;width:${width}px;height:200px;`
    try {
      const layout = api.layoutTextDocument(request, boundary)
      let markup, error
      try { markup = api.textBoxSvgString({ id: 'text', type: 'text', width, height: 200,
        pptxTextDocument: source }, { fontRuntime: runtime }) }
      catch (caught) { error = { code: caught.code, message: caught.message } }
      target.innerHTML = markup ?? ''
      const frame = target.querySelector('svg')?.getBoundingClientRect()
      const boxes = [...target.querySelectorAll('[data-pptx-text-run]')].map(span => {
        const range = document.createRange(); range.selectNodeContents(span)
        const rect = span.dataset.pptxInlineEquation ? span.getBoundingClientRect() : range.getBoundingClientRect()
        return { id: span.dataset.pptxTextRun, x: rect.x - frame.x, y: rect.y - frame.y,
          width: rect.width, height: rect.height, svg: span.querySelector('svg')?.outerHTML }
      })
      return { layout, markup, boxes, error, intact: before === JSON.stringify(source) }
    } finally { (runtime ?? boundary).dispose(); target.replaceChildren() }
  }, { fonts, source: document, width, missingAsset })
}

describe('inline OMML browser layout and shared HTML-in-SVG paint', () => {
  it.skipIf(!mathRoot)('measures a genuine fraction advance/ascent/descent and paints its exact SVG at the shared baseline', async () => {
    const result = await paint(math, source('Cambria Math'))
    expect(result.layout).toMatchObject({ status: 'measured', issues: [] })
    const [before, fraction, after] = result.layout.lines[0].runs
    expect(fraction).toMatchObject({ kind: 'equation', componentId: 'equation', ommlDocument: equation })
    expect(fraction).not.toHaveProperty('text')
    expect(fraction.equation.advance).toBeGreaterThan(0)
    expect(fraction.equation.ascent).toBeGreaterThan(0)
    expect(fraction.equation.descent).toBeGreaterThan(0)
    expect(fraction.baseline).toBeCloseTo(before.baseline, 5)
    expect(after.baseline).toBeCloseTo(fraction.baseline, 5)
    expect(after.rects[0].x).toBeCloseTo(fraction.rects[0].x + fraction.equation.advance, 1)
    expect(fraction.rects[0].y + fraction.equation.ascent).toBeCloseTo(fraction.baseline, 1)
    const painted = result.boxes.find(box => box.id === 'equation')
    for (const key of ['x', 'y', 'width', 'height']) expect(painted[key]).toBeCloseTo(fraction.rects[0][key], 2)
    expect(result.markup).toContain(fraction.equation.svg)
    expect(result.markup).toContain('data-component-id="fraction"')
    expect(result.intact).toBe(true)
  })

  it.skipIf(!mathRoot)('wraps the equation atom without splitting or dropping its AST and advances following text', async () => {
    const full = await paint(math, source('Cambria Math'))
    const fraction = full.layout.lines[0].runs.find(run => run.kind === 'equation')
    const width = Math.ceil(fraction.equation.advance + 2)
    const result = await paint(math, source('Cambria Math'), width)
    expect(result.layout.status).toBe('measured')
    expect(result.layout.lines.length).toBeGreaterThan(1)
    const atoms = result.layout.lines.flatMap(line => line.runs).filter(run => run.kind === 'equation')
    expect(atoms).toHaveLength(1)
    expect(atoms[0].ommlDocument).toEqual(equation)
    expect(result.layout.lines.flatMap(line => line.runs).filter(run => run.kind === 'text').map(run => run.text).join(''))
      .toBe('Let  be defined.')
    expect(result.intact).toBe(true)
  })

  it('refuses a fraction when a verified face has no genuine MATH table, without an empty equation fallback', async () => {
    const result = await paint(plain, source())
    expect(result.layout).toMatchObject({ status: 'unsupported', lines: [],
      issues: [expect.objectContaining({ code: 'inline-equation-measurement-failed', componentId: 'equation' })] })
    expect(result.error.message).toMatch(/inline-equation-measurement-failed/)
    expect(result.markup).toBeUndefined()
  })

  it('reports a missing verified font asset explicitly before any math placeholder can be painted', async () => {
    const document = source()
    document.paragraphs[0].runs = [document.paragraphs[0].runs[1]]
    const result = await paint(plain, document, 400, true)
    expect(result.layout).toMatchObject({ status: 'unsupported', lines: [] })
    expect(result.layout.issues).toContainEqual(expect.objectContaining({ code: 'font-asset-required', componentId: 'equation' }))
    expect(result.error).toMatchObject({ code: 'browser-measurement-required' })
    expect(result.markup).toBeUndefined()
  })
})

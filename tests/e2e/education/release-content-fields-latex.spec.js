import { test, expect } from '../fixtures/test-fixtures.js'
import {
  contentFixture,
  setupContent,
  fillControl,
  sourceControl,
  reloadContent,
  fieldEvidence,
  withPresent,
  withPortable,
} from './release-content-fields.js'
import { findFrame } from './release-surfaces.js'

const formula = '\\frac{19}{2}+x^2'
const tikz =
  '\\begin{tikzpicture}\n\\draw[very thick,blue] (0,0) -- (3,0) -- (0,2) -- cycle;\n\\end{tikzpicture}'
function forbidChildIndexedDb() {
  if (window === window.top) return
  window.__tikzIndexedDbAccesses = 0
  Object.defineProperty(window, 'indexedDB', {
    configurable: false,
    get() {
      window.__tikzIndexedDbAccesses++
      throw new Error('Disabled TikZ cache must never access IndexedDB')
    },
  })
}
async function inspectFormula(root) {
  const math = root.locator('.katex')
  await expect(math.locator('annotation')).toHaveText(formula)
  await expect(math.locator('mfrac mn')).toHaveText(['19', '2'])
  await expect(math.locator('msup')).toHaveText('x2')
  await expect(math.locator('.katex-html')).toBeVisible()
  await math.evaluate(() => document.fonts.ready)
  const style = await math.evaluate((node) => {
    const parent = node.closest('[style*="font-size"]') || document.body
    const glyph = node.querySelector('.katex-html').getBoundingClientRect()
    return {
      authoredFont: getComputedStyle(parent).fontSize,
      color: getComputedStyle(node).color,
      glyphWidth: glyph.width,
      glyphHeight: glyph.height,
      loadedFonts: [...document.fonts]
        .filter((font) => font.status === 'loaded')
        .map((font) => font.family),
    }
  })
  expect(style.authoredFont).toBe('28px')
  expect(style.color).toBe('rgb(22, 50, 79)')
  expect(style.glyphWidth).toBeGreaterThan(50)
  expect(style.glyphHeight).toBeGreaterThan(28)
  expect(style.loadedFonts.some((family) => family.includes('KaTeX_Main'))).toBe(true)
  expect(style.loadedFonts.some((family) => family.includes('KaTeX_Math'))).toBe(true)
  return {
    fraction: await math.locator('mfrac').textContent(),
    exponent: await math.locator('msup').textContent(),
    style,
  }
}
async function inspectTriangle(page) {
  let frame
  await expect
    .poll(
      async () => {
        for (const child of page.frames().filter((candidate) => candidate.parentFrame())) {
          if (await child.locator('svg path').count()) {
            frame = child
            return true
          }
        }
        return false
      },
      { timeout: 90000 }
    )
    .toBe(true)
  await expect
    .poll(async () =>
      frame.locator('svg path').evaluateAll((paths) =>
        paths
          .map((path) => {
            const b = path.getBBox(),
              style = getComputedStyle(path)
            return {
              width: b.width,
              height: b.height,
              stroke: style.stroke,
              fill: style.fill,
              closed: /z\s*$/i.test(path.getAttribute('d')),
            }
          })
          .filter((path) => path.width > 60 && path.height > 40 && path.closed)
      )
    )
    .not.toEqual([])
  const triangle = await frame.locator('svg path').evaluateAll((paths) =>
    paths
      .map((path) => {
        const b = path.getBBox(),
          style = getComputedStyle(path)
        return {
          width: b.width,
          height: b.height,
          stroke: style.stroke,
          fill: style.fill,
          closed: /z\s*$/i.test(path.getAttribute('d')),
        }
      })
      .find((path) => path.width > 60 && path.height > 40 && path.closed)
  )
  expect(triangle.width / triangle.height).toBeCloseTo(1.5, 1)
  expect(triangle.stroke).toBe('rgb(0, 0, 255)')
  expect(triangle.fill).toBe('none')
  await expect(frame.locator('svg')).toBeVisible()
  const indexedDbAccesses = await frame.evaluate(() => window.__tikzIndexedDbAccesses)
  expect(indexedDbAccesses).toBe(0)
  return { ...triangle, indexedDbAccesses }
}

test('LaTeX formula size color and offline assets qualify actual MathML and drawn glyphs [cap:element.latex.editor]', async ({
  page,
  request,
  browser,
  testPresentation,
}, testInfo) => {
  test.setTimeout(120000)
  const element = contentFixture('latex', { content: 'x', width: 700, height: 330 })
  await setupContent(page, request, testPresentation.id, element)
  await sourceControl(page, 'latex', formula)
  await fillControl(page, 'LaTeX font size', 28)
  await fillControl(page, 'LaTeX text color', '#16324f')
  const patch = { content: formula, fontSize: 28, textColor: '#16324f' }
  const { persisted } = await reloadContent(page, request, testPresentation.id, element.id, patch)
  const canvas = await inspectFormula(await findFrame(page, '.katex'))
  const generated = await withPresent(page, (present) =>
    inspectFormula(present.locator('.reveal .slides section.present'))
  )
  const portable = await withPortable(
    page,
    browser,
    testInfo,
    'latex-formula-offline.html',
    async (offline) => {
      const rendered = await inspectFormula(offline.locator('.reveal .slides section.present'))
      await expect
        .poll(() =>
          offline.evaluate(() =>
            [...document.fonts].some(
              (font) => font.status === 'loaded' && /KaTeX/.test(font.family)
            )
          )
        )
        .toBe(true)
      const screenshot = testInfo.outputPath('latex-formula-offline.png')
      await offline.screenshot({ path: screenshot })
      return { rendered, screenshot }
    }
  )
  await fieldEvidence(
    testInfo,
    page,
    'latex',
    ['content', 'fontSize', 'textColor', 'formula', 'font', 'color', 'offlineAssets'],
    patch,
    {
      persisted,
      canvas,
      generated,
      portable: portable.observed.rendered,
      network: portable.network,
    },
    [portable.file, portable.observed.screenshot]
  )
})

test('TikZ author source compiles the authored triangle in the canvas and genuine offline sandbox [cap:element.latex.editor]', async ({
  page,
  request,
  browser,
  testPresentation,
}, testInfo) => {
  test.setTimeout(180000)
  await page.addInitScript(forbidChildIndexedDb)
  const element = contentFixture('latex', { content: 'x', width: 700, height: 330 })
  await setupContent(page, request, testPresentation.id, element)
  await sourceControl(page, 'latex', tikz)
  const { persisted } = await reloadContent(page, request, testPresentation.id, element.id, {
    content: tikz,
  })
  const canvas = await inspectTriangle(page)
  const portable = await withPortable(
    page,
    browser,
    testInfo,
    'latex-tikz-offline.html',
    async (offline) => {
      const triangle = await inspectTriangle(offline)
      const screenshot = testInfo.outputPath('latex-tikz-offline.png')
      await offline.screenshot({ path: screenshot })
      return { triangle, screenshot }
    },
    { initScripts: [forbidChildIndexedDb] }
  )
  await fieldEvidence(
    testInfo,
    page,
    'latex',
    ['tikz'],
    { triangleAspect: 1.5, stroke: 'blue', closed: true },
    { persisted, canvas, portable: portable.observed.triangle, network: portable.network },
    [portable.file, portable.observed.screenshot]
  )
})

import { test, expect } from '../fixtures/test-fixtures.js'
import { contentFixture, setupContent, sourceControl, reloadContent, fieldEvidence, withPortable } from './release-content-fields.js'
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

import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { build } from 'esbuild'
import { beforeAll, afterAll } from 'vitest'

let browser, page, fontBytes
beforeAll(async () => {
  fontBytes = (await readFile('server/vendor/katex/dist/fonts/KaTeX_Main-Regular.ttf')).toString(
    'base64'
  )
  const bundle = await build({
    stdin: {
      contents: `
        import browser from './shared/src/pptx-text-layout-browser.js';
        import layout from './shared/src/pptx-text-layout.js';
        globalThis.textLayoutFixture = { ...browser, ...layout };
      `,
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
  })
  browser = await chromium.launch({ headless: true })
  page = await browser.newPage()
  await page.route('http://127.0.0.1/wrap-unit', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' })
  )
  await page.goto('http://127.0.0.1/wrap-unit')
  await page.addScriptTag({
    content: bundle.outputFiles[0].text,
  })
}, 30000)
afterAll(async () => {
  await browser?.close()
})

export async function layout(change = {}) {
  return page.evaluate(
    async ({ fontBytes, change }) => {
      const fontProfile = {
        schemaVersion: 1,
        faces: [
          {
            id: 'main',
            typeface: 'Main',
            assetHash: 'd0332f52868370fd83ae7fa46470f90c8f2eab2fcf12bc4f88080b340c95a830',
          },
        ],
      }
      const boundary = await globalThis.textLayoutFixture.createBrowserTextMeasurer({
        document,
        fontProfile,
        assets: [
          {
            faceId: 'main',
            bytes: Uint8Array.from(atob(fontBytes), (c) => c.charCodeAt(0)).buffer,
          },
        ],
      })
      const input = {
        document: {
          schemaVersion: 1,
          componentId: 'body',
          body: {
            insetLeftEmu: 0,
            insetRightEmu: 0,
            insetTopEmu: 0,
            insetBottomEmu: 0,
            verticalText: 'horz',
            verticalAlign: 't',
            wrap: true,
            autofit: { mode: 'none' },
            ...change.body,
          },
          paragraphs: change.paragraphs ?? [
            {
              componentId: 'p',
              properties: change.properties ?? {},
              defaultRunProperties: {
                fontSizePt: 12,
                fontLatin: { typeface: 'Main' },
                ...change.defaults,
              },
              runs: change.runs ?? [{ componentId: 'r', kind: 'text', text: 'MM MM MM' }],
            },
          ],
        },
        shape: {
          widthEmu: 952500,
          heightEmu: 952500,
          textRectEmu: { l: 0, t: 0, r: Math.round((change.width ?? 65) * 9525), b: 952500 },
        },
        fontProfile,
        rendererProfile: boundary.profile,
      }
      const before = JSON.stringify(input)
      try {
        const engine = globalThis.textLayoutFixture,
          result = engine.layoutTextDocument(input, boundary)
        let reference
        if (change.reference) {
          const doc = document.querySelector('iframe').contentDocument,
            div = doc.createElement('div')
          div.style.cssText = `font:16px pptx_measured_0;width:${change.width ?? 65}px;white-space:pre-wrap;word-break:normal;overflow-wrap:normal`
          div.textContent = input.document.paragraphs[0].runs.map((run) => run.text ?? '').join('')
          doc.body.append(div)
          reference = []
          let top
          for (let i = 0; i < div.textContent.length; i++) {
            const range = doc.createRange()
            range.setStart(div.firstChild, i)
            range.setEnd(div.firstChild, i + 1)
            const box = range.getBoundingClientRect()
            if (box.top !== top) {
              reference.push('')
              top = box.top
            }
            reference[reference.length - 1] += div.textContent[i]
          }
          div.remove()
        }
        return {
          result,
          intact: before === JSON.stringify(input),
          plan: engine.prepareTextLayout(input),
          reference,
        }
      } finally {
        boundary.dispose()
      }
    },
    { fontBytes, change }
  )
}

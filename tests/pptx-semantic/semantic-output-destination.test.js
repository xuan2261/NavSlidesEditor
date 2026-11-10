// Synthetic source-reader fixture: real destination fonts/lifetimes, not native qualification.
import { createRequire } from 'node:module'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { familyDocumentsFixture } from './family-documents-fixture'
import { sourceOutputFamilies } from './semantic-output-family-fixture'

const require = createRequire(import.meta.url)
const {
  prepareSemanticOutputResources,
} = require('../../server/services/pptx-import/semantic-output-resources')
const { collectSemanticFontRequests } = require('../../shared/src/pptx-source-font-request')
const { createSmartArtPhysicalModel } = require('../../shared/src/pptx-smartart-render')
const { generatePrintHTML, generateRevealHTML } = require('../../shared/src/htmlGenerator')
let browser, page, payload, outputFamilies, vendorRuntime
function vendorContentType(pathname) {
  if (pathname.endsWith('.css')) return 'text/css'
  if (pathname.endsWith('.js')) return 'text/javascript'
  const font = /\.(woff2?|ttf|otf)$/.exec(pathname)
  return font ? `font/${font[1]}` : 'application/octet-stream'
}

beforeAll(async () => {
  const semantic = structuredClone((await familyDocumentsFixture()).table)
  const definition = Object.values(semantic.definitions)[0]
  definition.content.extent = { cx: 2743200, cy: 914400 }
  const table = definition.content.tableDocument
  table.properties = {}
  for (const row of table.rows)
    for (const cell of row.cells) {
      cell.textDocument.body = {
        insetLeftEmu: 0,
        insetRightEmu: 0,
        insetTopEmu: 0,
        insetBottomEmu: 0,
        verticalAlign: 't',
        verticalText: 'horz',
        wrap: false,
        autofit: { mode: 'none' },
      }
      for (const paragraph of cell.textDocument.paragraphs) {
        paragraph.defaultRunProperties = {
          fontLatin: { typeface: 'KaTeX_Main' },
          fontSizePt: 12,
          bold: false,
          italic: false,
          color: { kind: 'srgb', value: '123456' },
        }
        for (const run of paragraph.runs)
          if (run.properties?.fontLatin) run.properties.fontLatin.typeface = 'KaTeX_Main'
      }
    }
  vi.stubEnv(
    'NAVSLIDES_PPTX_FONT_ROOTS',
    JSON.stringify([path.resolve('server/vendor/katex/dist/fonts')])
  )
  payload = {
    semantic,
    resources: await prepareSemanticOutputResources({ pptxSemantic: semantic }),
    mounts: [{ instanceId: 'occurrence', slideId: 's1' }],
  }
  vi.unstubAllEnvs()
  outputFamilies = await sourceOutputFamilies()
  const bundle = await build({
    stdin: {
      resolveDir: process.cwd(),
      contents: `
      import runtime from './shared/src/pptx-semantic-output-browser.js';
      import readiness from './shared/src/pptx-semantic-output-readiness.js';
      import { generateOfflineHTML } from './client/src/utils/offlineExport.js';
      globalThis.startSemanticOutput = runtime.startSemanticOutput;
      globalThis.installSemanticPrintReadiness = readiness.installSemanticPrintReadiness;
      globalThis.generateOfflineHTML = generateOfflineHTML;
    `,
    },
    platform: 'browser',
    format: 'iife',
    bundle: true,
    write: false,
  })
  const vendorBundle = await build({
    entryPoints: [path.resolve('shared/src/pptx-semantic-output-browser.js')],
    platform: 'browser',
    format: 'iife',
    globalName: 'NavSlidesSemanticOutput',
    target: 'es2022',
    bundle: true,
    write: false,
  })
  vendorRuntime = vendorBundle.outputFiles[0].text
  browser = await chromium.launch({ headless: true })
  page = await browser.newPage()
  await page.route('http://127.0.0.1/semantic-output-destination', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html><body></body></html>',
    })
  )
  await page.goto('http://127.0.0.1/semantic-output-destination')
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
})

afterAll(async () => {
  vi.unstubAllEnvs()
  await page?.close()
  await browser?.close()
})

describe('canonical output in its actual destination document', () => {
  it.each(
    ['table', 'chart', 'diagram', 'equation'].flatMap((kind) =>
      ['print', 'reveal'].flatMap((surface) =>
        ['online', 'offline'].map((delivery) => ({ kind, surface, delivery }))
      )
    )
  )(
    'boots generated $surface canonical $kind $delivery output with real vendor assets',
    async ({ kind, surface, delivery }) => {
      const semantic = kind === 'table' ? payload.semantic : outputFamilies[kind]
      vi.stubEnv(
        'NAVSLIDES_PPTX_FONT_ROOTS',
        JSON.stringify([path.resolve('server/vendor/katex/dist/fonts')])
      )
      const resources = await prepareSemanticOutputResources({ pptxSemantic: semantic })
      vi.unstubAllEnvs()
      const presentation = {
        id: 'generated-destination',
        title: 'Canonical source output',
        pptxSemantic: semantic,
        slides: [
          {
            id: 's1',
            elements: [
              {
                id: 'el',
                pptxInstanceId: 'occurrence',
                type: kind === 'equation' ? 'latex' : kind,
                x: 20,
                y: 20,
                width: 300,
                height: 200,
                content: 'POISON',
                data: [['POISON']],
              },
            ],
          },
        ],
      }
      const before = JSON.stringify(presentation)
      const generate = surface === 'print' ? generatePrintHTML : generateRevealHTML
      let html = generate(presentation, { semanticOutputResources: resources, portable: true })
      const destination = await browser.newPage()
      const failures = []
      const escapedRequests = []
      destination.on('pageerror', (error) => failures.push(error.message))
      await destination.route('**/*', async (route) => {
        const pathname = new URL(route.request().url()).pathname
        if (pathname === '/generated')
          return route.fulfill({ contentType: 'text/html', body: html })
        if (delivery === 'offline') {
          escapedRequests.push(route.request().url())
          return route.abort()
        }
        if (pathname === '/vendor/navslides-semantic-output/runtime.js')
          return route.fulfill({ contentType: 'text/javascript', body: vendorRuntime })
        if (!pathname.startsWith('/vendor/')) return route.abort()
        const file = path.resolve('server', `.${pathname}`)
        const contentType = vendorContentType(pathname)
        return route.fulfill({ contentType, body: await readFile(file) })
      })
      try {
        if (delivery === 'offline') {
          await page.route('http://127.0.0.1/**', async (route) => {
            const pathname = new URL(route.request().url()).pathname
            if (pathname === '/vendor/navslides-semantic-output/runtime.js')
              return route.fulfill({ contentType: 'text/javascript', body: vendorRuntime })
            const contentType = vendorContentType(pathname)
            return route.fulfill({
              contentType,
              body: await readFile(
                pathname === '/reveal-overrides.css'
                  ? path.resolve('client/public/reveal-overrides.css')
                  : path.resolve('server', `.${pathname}`)
              ),
            })
          })
          html = await page.evaluate(
            (html) =>
              globalThis.generateOfflineHTML(html, {
                baseUrl: 'http://127.0.0.1/generated',
                generatedDocument: true,
              }),
            html
          )
          await page.unroute('http://127.0.0.1/**')
        }
        await destination.goto('http://127.0.0.1/generated')
        const result = await destination.evaluate(async (surface) => {
          const handle = window.__navslidesSemanticOutput
          await handle.ready
          if (surface === 'print') await window.__navslidesPrintReady
          else if (!window.Reveal.isReady())
            await new Promise((resolve, reject) => {
              const timeout = setTimeout(
                () => reject(new Error('Reveal readiness did not fire')),
                5000
              )
              window.Reveal.on('ready', () => {
                clearTimeout(timeout)
                resolve()
              })
            })
          return {
            state: handle.state,
            svg: Boolean(document.querySelector('[data-pptx-semantic-mount] > svg')),
            exportReady: window.__navslidesExportReady === true,
            revealReady: surface === 'reveal' && window.Reveal.isReady(),
            legacy: document.querySelectorAll('[data-chart-config],[data-math-latex]').length,
            poison: document
              .querySelector('[data-pptx-semantic-mount]')
              .textContent.includes('POISON'),
            ownedFonts: [...document.fonts].filter((face) => face.status === 'loaded').length,
          }
        }, surface)
        expect(result).toMatchObject({ state: 'ready', svg: true, legacy: 0, poison: false })
        expect(surface === 'print' ? result.exportReady : result.revealReady).toBe(true)
        expect(result.ownedFonts).toBeGreaterThan(0)
        expect(failures).toEqual([])
        expect(escapedRequests).toEqual([])
        expect(JSON.stringify(presentation)).toBe(before)
      } finally {
        await destination.close()
      }
    }
  )

  it.each(['chart', 'diagram', 'equation'])(
    'paints canonical %s rather than a legacy compatibility surface in the destination',
    async (kind) => {
      const semantic = outputFamilies[kind]
      const before = JSON.stringify(semantic)
      if (kind === 'diagram') {
        const source = Object.values(semantic.definitions)[0].content.smartArtDocument
        createSmartArtPhysicalModel(source, { x: 0, y: 0, width: 2743200, height: 1828800 })
      }
      expect(collectSemanticFontRequests(semantic).issues).toEqual([])
      vi.stubEnv(
        'NAVSLIDES_PPTX_FONT_ROOTS',
        JSON.stringify([path.resolve('server/vendor/katex/dist/fonts')])
      )
      const resources = await prepareSemanticOutputResources({ pptxSemantic: semantic })
      vi.unstubAllEnvs()
      const result = await page.evaluate(
        async (input) => {
          const destination = document.createElement('iframe')
          document.body.append(destination)
          const doc = destination.contentDocument
          doc.body.innerHTML =
            '<main data-pptx-semantic-mount="occurrence" data-pptx-semantic-slide="s1"></main>'
          const handle = globalThis.startSemanticOutput(doc, input)
          try {
            await handle.ready
            const svg = doc.querySelector('main > svg')
            const bounds = svg?.getBoundingClientRect()
            return {
              state: handle.state,
              svg: Boolean(svg),
              width: bounds?.width,
              height: bounds?.height,
              texts: [...doc.querySelectorAll('svg text')].map((node) => node.textContent),
              chart: Boolean(doc.querySelector('[data-chart-point]')),
              diagram: Boolean(doc.querySelector('[data-smartart-point]')),
              math: Boolean(doc.querySelector('[data-omml-component]')),
              frames: doc.querySelectorAll('iframe').length,
            }
          } finally {
            handle.dispose()
            destination.remove()
          }
        },
        { semantic, resources, mounts: [{ instanceId: 'occurrence', slideId: 's1' }] }
      )
      expect(result.state).toBe('ready')
      expect(result.svg).toBe(true)
      expect(result.width).toBeGreaterThan(0)
      expect(result.height).toBeGreaterThan(0)
      if (kind === 'chart') expect(result.chart).toBe(true)
      if (kind === 'diagram') {
        expect(result.diagram).toBe(true)
        expect(result.texts.join('')).toContain('Label')
        expect(result.frames).toBe(1)
      }
      if (kind === 'equation') {
        expect(result.texts.join('')).toBe('Output math')
        expect(result.frames).toBe(1)
      }
      expect(JSON.stringify(semantic)).toBe(before)
    }
  )

  it('rejects a replaced generation and disposes physical font loading that completes late', async () => {
    const result = await page.evaluate(async (payload) => {
      const host = document.createElement('main')
      host.setAttribute('data-pptx-semantic-mount', 'occurrence')
      host.setAttribute('data-pptx-semantic-slide', 's1')
      document.body.append(host)
      const original = FontFace.prototype.load
      let entered, release, firstFrame
      const gate = new Promise((resolve) => {
        release = resolve
      })
      const started = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Output font load did not start')), 10000)
        entered = () => {
          clearTimeout(timer)
          resolve()
        }
      })
      let blocked = false
      FontFace.prototype.load = async function () {
        if (!blocked && this.family.startsWith('pptx_table_')) {
          blocked = true
          firstFrame = document.querySelector('iframe')
          entered()
          await gate
        }
        return original.call(this)
      }
      let first, second
      try {
        first = globalThis.startSemanticOutput(document, payload)
        const firstReady = first.ready.then(
          () => 'unexpected-ready',
          (error) => error.code
        )
        await started
        const removed = new Promise((resolve, reject) => {
          const observer = new MutationObserver(() => {
            if (!firstFrame.isConnected) {
              clearTimeout(timer)
              observer.disconnect()
              resolve()
            }
          })
          const timer = setTimeout(() => {
            observer.disconnect()
            reject(new Error('Late runtime frame leaked'))
          }, 10000)
          observer.observe(document.body, { childList: true, subtree: true })
        })
        second = globalThis.startSemanticOutput(document, payload)
        await second.ready
        const secondFonts = [...document.fonts]
        const secondFrame = [...document.querySelectorAll('iframe')].find((frame) => frame !== firstFrame)
        const secondSvg = host.querySelector(':scope > svg[data-pptx-table]')
        release()
        await removed
        const state = {
          replacedCode: await firstReady,
          firstState: first.state,
          secondState: second.state,
          faces: document.fonts.size,
          frames: document.querySelectorAll('iframe').length,
          secondFontsPreserved: secondFonts.every((face) => document.fonts.has(face)),
          secondFramePreserved: secondFrame?.isConnected === true,
          secondSvgPreserved: secondSvg?.isConnected === true && host.firstElementChild === secondSvg,
        }
        second.dispose()
        return {
          ...state,
          finalFaces: document.fonts.size,
          finalFrames: document.querySelectorAll('iframe').length,
        }
      } finally {
        release()
        FontFace.prototype.load = original
        first?.dispose()
        second?.dispose()
        host.remove()
      }
    }, payload)
    expect(result).toEqual({
      replacedCode: 'semantic-output-disposed',
      firstState: 'disposed',
      secondState: 'ready',
      faces: 1,
      frames: 1,
      secondFontsPreserved: true,
      secondFramePreserved: true,
      secondSvgPreserved: true,
      finalFaces: 0,
      finalFrames: 0,
    })
  })

  it('gates print on canonical paint and restores a new owned runtime after persisted page lifecycle', async () => {
    const result = await page.evaluate(async (payload) => {
      const destination = document.createElement('iframe')
      document.body.append(destination)
      const doc = destination.contentDocument,
        win = destination.contentWindow
      doc.body.innerHTML =
        '<div id="print-bar"><button disabled>Print</button></div><main data-pptx-semantic-mount="occurrence" data-pptx-semantic-slide="s1"></main>'
      let prints = 0,
        otherReady
      win.print = () => {
        prints++
      }
      const first = globalThis.startSemanticOutput(doc, payload)
      const complete = globalThis.installSemanticPrintReadiness(win, false)
      complete(
        new Promise((resolve) => {
          otherReady = resolve
        })
      )
      await first.ready
      const held = {
        exportReady: win.__navslidesExportReady,
        disabled: doc.querySelector('button').disabled,
        prints,
      }
      otherReady()
      await win.__navslidesPrintReady
      await win.print()
      const ready = {
        exportReady: win.__navslidesExportReady,
        disabled: doc.querySelector('button').disabled,
        prints,
      }
      const aliases = [...doc.fonts].map((face) => face.family)
      win.dispatchEvent(new win.PageTransitionEvent('pagehide', { persisted: true }))
      const hidden = {
        state: first.state,
        faces: doc.fonts.size,
        painted: doc.querySelectorAll('svg').length,
        exportReady: win.__navslidesExportReady,
      }
      win.dispatchEvent(new win.PageTransitionEvent('pageshow', { persisted: true }))
      const restored = win.__navslidesSemanticOutput
      await restored.ready
      await win.__navslidesPrintReady
      const reopened = {
        sameHandle: first === restored,
        state: restored.state,
        ready: win.__navslidesExportReady,
        newAliases: [...doc.fonts].every((face) => !aliases.includes(face.family)),
        faces: doc.fonts.size,
        painted: doc.querySelectorAll('main > svg').length,
      }
      restored.dispose()
      destination.remove()
      return { held, ready, hidden, reopened }
    }, payload)
    expect(result).toEqual({
      held: { exportReady: false, disabled: true, prints: 0 },
      ready: { exportReady: true, disabled: false, prints: 1 },
      hidden: { state: 'disposed', faces: 0, painted: 0, exportReady: false },
      reopened: {
        sameHandle: false,
        state: 'ready',
        ready: true,
        newAliases: true,
        faces: 1,
        painted: 1,
      },
    })
  })

  it('paints with verified destination-owned fonts, rebuilds stale aliases and disposes only its resources', async () => {
    const before = JSON.stringify(payload)
    const result = await page.evaluate(async (payload) => {
      const destination = document.createElement('iframe')
      document.body.append(destination)
      const doc = destination.contentDocument
      doc.body.innerHTML =
        '<main data-pptx-semantic-mount="occurrence" data-pptx-semantic-slide="s1"></main>'
      const parentFaces = document.fonts.size
      const handle = globalThis.startSemanticOutput(doc, payload)
      const initial = { state: handle.state, svgs: doc.querySelectorAll('svg').length }
      await handle.ready
      const texts = [...doc.querySelectorAll('svg text')]
      const aliases = [...doc.fonts].map((face) => face.family)
      const first = {
        state: handle.state,
        texts: texts.map((node) => node.textContent),
        loaded: [...doc.fonts].every((face) => face.status === 'loaded'),
        aliasesOnly: texts.every((node) =>
          aliases.includes(node.style.fontFamily.replace(/"/g, ''))
        ),
        measuredFrameCount: doc.querySelectorAll('iframe').length,
        parentFacesAdded: document.fonts.size - parentFaces,
      }
      const oldFace = [...doc.fonts][0]
      doc.fonts.delete(oldFace)
      await handle.ensureReady()
      const rebuilt = {
        state: handle.state,
        oldFacePresent: doc.fonts.has(oldFace),
        aliasesChanged: [...doc.fonts].every((face) => !aliases.includes(face.family)),
        svgCount: doc.querySelectorAll('main > svg').length,
      }
      handle.dispose()
      let disposedCode
      try {
        await handle.ensureReady()
      } catch (error) {
        disposedCode = error.code
      }
      const final = {
        state: handle.state,
        faces: doc.fonts.size,
        frames: doc.querySelectorAll('iframe').length,
        painted: doc.querySelectorAll('svg').length,
        parentFacesAdded: document.fonts.size - parentFaces,
        disposedCode,
      }
      destination.remove()
      return { initial, first, rebuilt, final }
    }, payload)
    expect(result.initial).toEqual({ state: 'loading', svgs: 0 })
    expect(result.first).toMatchObject({
      state: 'ready',
      texts: ['Merged ', 'rich', 'A', 'B'],
      loaded: true,
      aliasesOnly: true,
      measuredFrameCount: 1,
      parentFacesAdded: 0,
    })
    expect(result.rebuilt).toEqual({
      state: 'ready',
      oldFacePresent: false,
      aliasesChanged: true,
      svgCount: 1,
    })
    expect(result.final).toEqual({
      state: 'disposed',
      faces: 0,
      frames: 0,
      painted: 0,
      parentFacesAdded: 0,
      disposedCode: 'semantic-output-disposed',
    })
    expect(JSON.stringify(payload)).toBe(before)
  })

  it.each(['hash', 'identity', 'mount'])(
    'rejects %s before paint with no owned font/frame leak',
    async (kind) => {
      const result = await page.evaluate(
        async ({ payload, kind }) => {
          const input = structuredClone(payload)
          const host = document.createElement('main')
          host.setAttribute('data-pptx-semantic-mount', 'occurrence')
          host.setAttribute('data-pptx-semantic-slide', kind === 'mount' ? 'wrong-slide' : 's1')
          document.body.append(host)
          if (kind === 'identity') input.resources.sourceIdentity = '0'.repeat(64)
          if (kind === 'hash') {
            const bytes = atob(input.resources.assets[0].bytesBase64)
            input.resources.assets[0].bytesBase64 = btoa(
              String.fromCharCode(bytes.charCodeAt(0) ^ 1) + bytes.slice(1)
            )
          }
          const baseline = document.fonts.size
          const handle = globalThis.startSemanticOutput(document, input)
          let code
          try {
            await handle.ready
          } catch (error) {
            code = error.code
          }
          const state = {
            state: handle.state,
            code,
            painted: host.querySelectorAll('svg').length,
            alert: host.getAttribute('role'),
            faces: document.fonts.size - baseline,
            frames: document.querySelectorAll('iframe').length,
          }
          handle.dispose()
          host.remove()
          return state
        },
        { payload, kind }
      )
      expect(result).toEqual({
        state: 'error',
        code: `semantic-output-${kind}`,
        painted: 0,
        alert: 'alert',
        faces: 0,
        frames: 0,
      })
    }
  )
})

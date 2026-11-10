import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { once } from 'node:events'
import path from 'node:path'
import express from 'express'
import { build } from 'esbuild'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { createSemanticFontRouter } = require('../../server/routes/pptx-semantic-fonts')
let browser, page, server, semantic, originalHash
const source = 'a'.repeat(64)
beforeAll(async () => {
  const textDocument = { schemaVersion: 1, componentId: 'body', body: {},
    paragraphs: [{ componentId: 'p', properties: {}, defaultRunProperties: {
      fontLatin: { typeface: 'KaTeX_Main' }, fontSizePt: 18,
    }, runs: [{ componentId: 'r', kind: 'text', text: 'MMMM iii', properties: {} }] }] }
  semantic = { schemaVersion: 1, definitions: { d: {
    id: 'd', kind: 'text', source: { partUri: 'ppt/slides/slide1.xml', nativeId: '1', preconditionHash: source },
    components: ['body', 'p', 'r'].map((id, i) => ({ id, kind: i === 2 ? 'run' : 'paragraph',
      locator: { path: [0, i], preconditionHash: source } })),
    content: { textDocument },
  } }, instances: { i: { id: 'i', slideId: 's', definitionId: 'd', parentInstanceId: null,
    localTransform: [1, 0, 0, 1, 0, 0], paintIndex: 0, overrides: {} } }, styles: {}, fonts: {} }
  originalHash = createHash('sha256')
    .update(await readFile('server/vendor/katex/dist/fonts/KaTeX_Main-Regular.ttf')).digest('hex')
  const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'jsx', contents: `
    import React, {useEffect} from 'react';
    import {createRoot} from 'react-dom/client';
    import {PptxSourceFontProvider} from './client/src/contexts/pptx-source-font-context.jsx';
    import {usePptxSourceFonts} from './client/src/hooks/use-pptx-source-fonts.js';
    import {loadPptxSourceFontRuntime} from './client/src/hooks/use-pptx-source-font-loader.js';
    import {collectSemanticFontRequests} from './shared/src/pptx-source-font-request.js';
    const roots = new Map();
    function Consumer({id}) {
      const state = usePptxSourceFonts();
      useEffect(() => {
        globalThis.states[id] = state;
        globalThis.dispatchEvent(new CustomEvent('font-state', {detail:{id,status:state.status}}));
      }, [state]);
      const face=state.fontRuntime?.fontProfile.faces[0];
      return <><output data-id={id}>{state.status}</output>{face &&
        <span data-font-proof={id} style={{fontFamily:state.fontRuntime.fontFamilies[face.id],
          fontSize:'18pt',fontSynthesis:'none',whiteSpace:'pre'}}>MMMM iii</span>}</>
    }
    globalThis.states={};
    globalThis.loadFonts=loadPptxSourceFontRuntime;
    globalThis.fontKey=(semantic)=>collectSemanticFontRequests(semantic).identity;
    globalThis.mountFonts=(id, semantic, revision=1, nested=false) => {
      let root=roots.get(id);
      if(!root){const host=document.createElement('div');document.body.append(host);
        root=createRoot(host);roots.set(id,root)}
      root.render(<PptxSourceFontProvider presentationId="deck" pptxSemantic={semantic}
        fontRevision={revision}><Consumer id={id}/>{nested &&
          <PptxSourceFontProvider presentationId="deck" pptxSemantic={semantic}
            fontRevision={revision}><Consumer id={id+'-nested'}/></PptxSourceFontProvider>}
        </PptxSourceFontProvider>);
    };
    globalThis.unmountFonts=(id)=>{roots.get(id)?.unmount();roots.delete(id)};
    ` }, bundle: true, write: false, platform: 'browser', format: 'iife',
    define: { 'process.env.NODE_ENV': '"production"' }, jsx: 'automatic' })
  const app = express()
  app.get('/', (_req, res) => res.type('html').send('<!doctype html><body></body>'))
  app.use('/api/presentations', createSemanticFontRouter({
    roots: [path.resolve('server/vendor/katex/dist/fonts')],
    readPresentation: async () => ({ presentation: { id: 'deck', pptxSemantic: semantic } }),
  }))
  server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  browser = await chromium.launch({ headless: true })
  page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  await page.goto(`http://127.0.0.1:${server.address().port}/`)
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
})
afterAll(async () => {
  await page?.close()
  await browser?.close()
  if (server) await new Promise((resolve) => server.close(resolve))
})

describe('production font provider with real HTTP bytes and browser measurement', () => {
  it('reconstructs shared physical runtime after an actual DPR-only browser transition', async () => {
    const cdp = await page.context().newCDPSession(page)
    try {
      await page.evaluate(async (semantic) => {
        globalThis.profileReady = new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('initial profile deadline')), 5000)
          const listener = ({ detail }) => {
            if (detail.id !== 'profile-nested' || detail.status !== 'ready') return
            clearTimeout(timer); removeEventListener('font-state', listener); resolve()
          }
          addEventListener('font-state', listener)
        })
        globalThis.mountFonts('profile', semantic, 1, true)
        await globalThis.profileReady
        globalThis.desktopRuntime = globalThis.states.profile.fontRuntime
        globalThis.desktopSource = globalThis.states.profile.sourceIdentity
        globalThis.profileReady = new Promise((resolve) => {
          const timer = setTimeout(() => {
            removeEventListener('font-state', listener)
            resolve({ error: 'profile reconstruction deadline',
              validation: globalThis.desktopRuntime.measurement.validate(
                globalThis.desktopRuntime.fontProfile, globalThis.desktopRuntime.rendererProfile) })
          }, 5000)
          const listener = ({ detail }) => {
            const state = globalThis.states['profile-nested']
            if (detail.id !== 'profile-nested' || detail.status !== 'ready' ||
                state.fontRuntime === globalThis.desktopRuntime) return
            clearTimeout(timer); removeEventListener('font-state', listener)
            const runtime = state.fontRuntime
            const profile = (win) => ({ dpr: win.devicePixelRatio, userAgent: win.navigator.userAgent,
              platform: win.navigator.platform, language: win.navigator.language })
            resolve({ validation: runtime.measurement.validate(runtime.fontProfile, runtime.rendererProfile),
              dpr: runtime.rendererProfile.devicePixelRatio,
              outer: profile(window),
              measurement: profile(document.querySelector('iframe[data-pptx-text-measurement]').contentWindow),
              shared: runtime === globalThis.states.profile.fontRuntime,
              sourceUnchanged: state.sourceIdentity === globalThis.desktopSource,
              hash: runtime.fontProfile.faces[0].assetHash,
              oldValidation: globalThis.desktopRuntime.measurement.validate(
                globalThis.desktopRuntime.fontProfile, globalThis.desktopRuntime.rendererProfile),
              faces: document.fonts.size, frames: document.querySelectorAll('iframe').length })
          }
          addEventListener('font-state', listener)
        })
      }, semantic)
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 1440, height: 900, deviceScaleFactor: 3, mobile: false,
      })
      // CDP changes DPR without notifying resize when viewport geometry is
      // unchanged. Deliver the browser notification explicitly, after the real
      // profile transition; the runtime and iframe still use physical browser values.
      await page.evaluate(() => window.dispatchEvent(new Event('resize')))
      const result = await page.evaluate(() => globalThis.profileReady)
      expect(result, JSON.stringify(result)).toMatchObject({ validation: null, dpr: 3, shared: true,
        sourceUnchanged: true, hash: originalHash, oldValidation: 'stale-table-output-fonts',
        faces: 1, frames: 1 })
      expect(result.outer).toEqual(result.measurement)
      expect(result.outer.dpr).toBe(3)
    } finally {
      await page.evaluate(() => globalThis.unmountFonts('profile'))
      await cdp.send('Emulation.clearDeviceMetricsOverride')
      await cdp.detach()
    }
  })

  it('registers, measures, shares one context and disposes only owned physical faces', async () => {
    const result = await page.evaluate(async (semantic) => {
      const event = (id, status, trigger) => new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('font-state deadline')), 10000)
        const listener = (event) => {
          if (event.detail.id === id && event.detail.status === status) {
            clearTimeout(timer); removeEventListener('font-state', listener); resolve()
          }
        }
        addEventListener('font-state', listener); trigger()
      })
      const baseline = document.fonts.size
      await event('first', 'ready', () => globalThis.mountFonts('first', semantic))
      const first = globalThis.states.first.fontRuntime
      const face = first.fontProfile.faces[0]
      const measured = first.measurement.measureLine({
        items: [{ faceId: face.id, componentId: 'r', kind: 'text', text: 'MMMM iii',
          path: 'paragraphs[0].runs[0]', properties: { fontSizePt: 18 }, start: 0, end: 8 }],
        properties: {}, fontScale: 1, startX: 0,
      })
      const visible = document.createRange()
      visible.selectNodeContents(document.querySelector('[data-font-proof="first"]'))
      const outputWidth = visible.getBoundingClientRect().width
      await event('second', 'ready', () => globalThis.mountFonts('second', semantic))
      const second = globalThis.states.second.fontRuntime
      const aliasesDiffer = first.fontFamilies[face.id] !== second.fontFamilies[face.id]
      globalThis.unmountFonts('first')
      const secondValid = second.measurement.validate(second.fontProfile, second.rendererProfile)
      const remaining = document.fonts.size - baseline
      globalThis.unmountFonts('second')
      return { hash: face.assetHash, typeface: face.typeface, width: measured.width, outputWidth,
        issues: measured.issues, aliasesDiffer, secondValid, remaining,
        final: document.fonts.size - baseline, frames: document.querySelectorAll('iframe').length }
    }, semantic)
    expect(result).toMatchObject({ hash: originalHash, typeface: 'KaTeX_Main', issues: [],
      aliasesDiffer: true, secondValid: null, remaining: 1, final: 0, frames: 0 })
    expect(result.width).toBeGreaterThan(40)
    expect(result.outputWidth).toBeCloseTo(result.width, 5)
  })

  it('rejects stale unsaved source and byte corruption without a font fallback', async () => {
    const result = await page.evaluate(async (semantic) => {
      const changed = structuredClone(semantic)
      changed.definitions.d.content.textDocument.paragraphs[0].defaultRunProperties.fontLatin.typeface = 'Missing Source'
      const failures = []
      for (const [snapshot, corrupt] of [[changed, false], [semantic, true]]) {
        try {
          await globalThis.loadFonts({ presentationId: 'deck', requestIdentity: globalThis.fontKey(snapshot),
            document, fetch: async (url, options) => {
              const response = await fetch(url, options)
              if (!corrupt || !url.includes('semantic-fonts/')) return response
              const bytes = new Uint8Array(await response.arrayBuffer()); bytes[0] ^= 1
              return new Response(bytes)
            } })
        } catch (error) { failures.push(error.code) }
      }
      return { failures, faces: document.fonts.size, frames: document.querySelectorAll('iframe').length }
    }, semantic)
    expect(result).toEqual({ failures: ['source-font-source-stale', 'source-font-delivery-hash-mismatch'],
      faces: 0, frames: 0 })
  })

  it('disposes real FontFace registration that completes after cancellation', async () => {
    const result = await page.evaluate(async (semantic) => {
      const controller = new AbortController(), original = FontFace.prototype.load
      let release, entered
      const gate = new Promise((resolve) => { release = resolve })
      const started = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('output registration deadline')), 10000)
        entered = () => { clearTimeout(timer); resolve() }
      })
      FontFace.prototype.load = async function () {
        if (this.family.startsWith('pptx_table_')) { entered(); await gate }
        return original.call(this)
      }
      try {
        const pending = globalThis.loadFonts({ presentationId: 'deck',
          requestIdentity: globalThis.fontKey(semantic), document, signal: controller.signal })
          .then(() => 'unexpected-ready', (error) => error.name)
        await started
        controller.abort()
        release()
        const outcome = await pending
        return { outcome, faces: document.fonts.size, frames: document.querySelectorAll('iframe').length }
      } finally { release(); FontFace.prototype.load = original }
    }, semantic)
    expect(result).toEqual({ outcome: 'AbortError', faces: 0, frames: 0 })
  })
})

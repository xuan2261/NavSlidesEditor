// Browser lifecycle diagnostic, not source/native or dashboard qualification.
import { build } from 'esbuild'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let browser, script, vendorRuntime
beforeAll(async () => {
  const bundle = await build({
    stdin: {
      resolveDir: process.cwd(),
      contents: `
        import React from 'react';
        import { createRoot } from 'react-dom/client';
        import { flushSync } from 'react-dom';
        import { useExportActions } from './client/src/hooks/use-export-actions.js';
        import { exportPDF } from './client/src/utils/generateHTML.js';
        import { api } from './client/src/utils/api.js';
        import { usePresentationStore } from './client/src/stores/presentation-store.js';
        const deferred = () => {
          let resolve;
          const promise = new Promise(done => { resolve = done });
          return { promise, resolve };
        };
        const ack = deferred(), read = deferred(), readEntered = deferred();
        const feedback = [], calls = { read: 0, begin: 0, end: 0 };
        addEventListener('navslides:feedback', event => feedback.push({
          type: event.detail.type, tone: event.detail.tone
        }));
        api.getPresentation = () => { calls.read++; readEntered.resolve(); return read.promise };
        usePresentationStore.setState({ saveConflict: null });
        const root = createRoot(document.getElementById('root'));
        let presentation = { id: 'deck', pptxSemantic: { schemaVersion: 1 }, slides: [] };
        let actions, pending, rawDone = false;
        function App() {
          actions = useExportActions(presentation, {
            flushPendingSave: () => ack.promise,
            beginExport: () => ++calls.begin,
            endExport: () => calls.end++
          });
          return React.createElement('div', null,
            React.createElement('button', { id: 'pdf', onClick: () => {
              pending = actions.onExportPDF();
            } }, 'Export PDF'),
            React.createElement('button', { id: 'html', onClick: () => {
              pending = actions.onExportHTML();
            } }, 'Export HTML'),
            React.createElement('button', { id: 'raw-pdf', onClick: () => {
              rawDone = false;
              pending = exportPDF({
                title: 'Readiness diagnostic', slides: [],
                pptxSemantic: { schemaVersion: 1, definitions: {}, instances: {}, styles: {}, fonts: {} }
              }, { autoPrint: false }).then(value => { rawDone = true; return value });
            } }, 'Open print document'));
        }
        flushSync(() => root.render(React.createElement(App)));
        window.harness = {
          calls, feedback, ack, read, readEntered,
          rawDone: () => rawDone,
          settle: () => pending,
          unmount: () => flushSync(() => root.unmount()),
          switchDeck: () => {
            presentation = { ...presentation, id: 'other' };
            flushSync(() => root.render(React.createElement(App)));
          },
          conflict: () => usePresentationStore.setState({ saveConflict: { remoteGeneration: 2 } }),
          saved: () => ({ ...presentation })
        };
      `,
    },
    platform: 'browser',
    format: 'iife',
    bundle: true,
    write: false,
    outdir: 'semantic-client-lifecycle',
  })
  script = bundle.outputFiles.find((file) => file.path.endsWith('.js')).text
  const runtime = await build({
    entryPoints: [path.resolve('shared/src/pptx-semantic-output-browser.js')],
    platform: 'browser',
    format: 'iife',
    globalName: 'NavSlidesSemanticOutput',
    bundle: true,
    write: false,
  })
  vendorRuntime = runtime.outputFiles[0].text
  browser = await chromium.launch({ headless: true })
})
afterAll(async () => {
  await browser?.close()
})

async function createPage() {
  const page = await browser.newPage()
  await page.route('http://127.0.0.1/output-lifecycle', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><div id="root"></div>',
    })
  )
  await page.goto('http://127.0.0.1/output-lifecycle')
  await page.addScriptTag({ content: script })
  return page
}

describe('real browser semantic output caller lifetimes', () => {
  it('keeps the print output action pending until its real destination runtime is ready', async () => {
    const page = await createPage()
    let popup, releaseRuntime
    let runtimeEntered
    const entered = new Promise((resolve) => {
      runtimeEntered = resolve
    })
    const released = new Promise((resolve) => {
      releaseRuntime = resolve
    })
    await page.context().route('http://127.0.0.1/**', async (route) => {
      const pathname = new URL(route.request().url()).pathname
      if (pathname === '/vendor/navslides-semantic-output/runtime.js') {
        runtimeEntered()
        await released
        return route.fulfill({ contentType: 'text/javascript', body: vendorRuntime })
      }
      if (!pathname.startsWith('/vendor/')) return route.abort()
      const contentType = pathname.endsWith('.css')
        ? 'text/css'
        : pathname.endsWith('.js')
          ? 'text/javascript'
          : 'application/octet-stream'
      return route.fulfill({
        contentType,
        body: await readFile(path.resolve('server', `.${pathname}`)),
      })
    })
    try {
      const opened = page.waitForEvent('popup', { timeout: 10000 })
      await page.locator('#raw-pdf').click()
      popup = await opened
      await entered
      const finishedBeforeRuntime = await page.evaluate(() => window.harness.rawDone())
      releaseRuntime()
      await page.evaluate(() => window.harness.settle().then(() => undefined))
      expect(finishedBeforeRuntime).toBe(false)
      expect(await popup.evaluate(() => window.__navslidesSemanticOutput.state)).toBe('ready')
      expect(await page.evaluate(() => window.harness.feedback)).toEqual([])
    } finally {
      releaseRuntime()
      await popup?.close()
      await page.close()
    }
  })
  it.each(['unmount', 'switchDeck'])(
    'closes the actual reserved window on %s while save ACK is unresolved',
    async (cancel) => {
      const page = await createPage()
      let popup
      try {
        const opened = page.waitForEvent('popup', { timeout: 10000 })
        await page.locator('#pdf').click()
        popup = await opened
        expect(await page.evaluate(() => window.harness.calls.read)).toBe(0)
        const closed = popup.waitForEvent('close', { timeout: 10000 })
        await page.evaluate((method) => window.harness[method](), cancel)
        await closed
        expect(popup.isClosed()).toBe(true)
        await page.evaluate(async () => {
          window.harness.ack.resolve(true)
          await window.harness.settle()
        })
        expect(
          await page.evaluate(() => ({
            ...window.harness.calls,
            feedback: window.harness.feedback,
          }))
        ).toEqual({ read: 0, begin: 0, end: 0, feedback: [] })
      } finally {
        await popup?.close()
        await page.close()
      }
    }
  )
  it('stops before resource preparation when a conflict appears during snapshot read', async () => {
    const page = await createPage()
    try {
      await page.evaluate(() => window.harness.ack.resolve(true))
      await page.locator('#html').click()
      await page.evaluate(() => window.harness.readEntered.promise)
      const result = await page.evaluate(async () => {
        window.harness.conflict()
        window.harness.read.resolve(window.harness.saved())
        await window.harness.settle()
        return {
          ...window.harness.calls,
          feedback: window.harness.feedback,
          frames: document.querySelectorAll('iframe').length,
        }
      })
      expect(result).toMatchObject({ read: 1, begin: 0, end: 0, frames: 0 })
      expect(result.feedback).toEqual([{ type: 'notice', tone: 'danger' }])
    } finally {
      await page.close()
    }
  })
})

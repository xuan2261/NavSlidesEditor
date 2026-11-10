import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { chromium } from 'playwright'
import { build } from 'esbuild'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import themeConfig from '../../client/tailwind.config.js'
import { expect, it } from 'vitest'
import { doc, run } from './omml-rendering-fixtures.js'

it('renders and edits native runs through the shared physical runtime without owning disposal', async () => {
  const bytes = [...(await readFile('server/vendor/katex/dist/fonts/KaTeX_Main-Regular.ttf'))]
  const hash = createHash('sha256').update(Buffer.from(bytes)).digest('hex')
  const source = doc(run('Source equation'))
  const bundle = await build({
    stdin: {
      contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {flushSync} from 'react-dom';
    import Editor from './client/src/components/properties/native-omml-editor.jsx';
    import {PptxSourceFontContext} from './client/src/contexts/pptx-source-font-context.jsx';
    import fonts from './shared/src/pptx-table-runtime-fonts';
    import operations from './shared/src/pptx-omml-operations';
    globalThis.fonts=fonts; globalThis.operations=operations;
    const root=createRoot(document.querySelector('main'));
    globalThis.draw=(input,value,defaults,explicit)=>flushSync(()=>root.render(
      <PptxSourceFontContext.Provider value={value}><Editor document={input}
        instanceId="source-occurrence" textDefaults={defaults} runtime={explicit}
        onSemanticOperation={command=>globalThis.command=command}/>
      </PptxSourceFontContext.Provider>));
    globalThis.unmount=()=>flushSync(()=>root.unmount());
  `,
      resolveDir: process.cwd(),
      loader: 'jsx',
    },
    bundle: true,
    write: false,
    outfile: 'native-omml-completion.js',
    platform: 'browser',
    define: { 'process.env.NODE_ENV': '"production"' },
  })
  const css = await postcss([tailwindcss({ ...themeConfig, content: [] })]).process(
    bundle.outputFiles.find((file) => file.path.endsWith('.css')).text,
    { from: undefined }
  )
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({
      viewport: { width: 1000, height: 650 },
      deviceScaleFactor: 1,
    })
    await page.route('http://127.0.0.1/omml-completion', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><body><main></main></body>',
      })
    )
    await page.goto('http://127.0.0.1/omml-completion')
    await page.addStyleTag({ content: css.css })
    await page.addScriptTag({
      content: bundle.outputFiles.find((file) => file.path.endsWith('.js')).text,
    })
    const rendered = await page.evaluate(
      async ({ bytes, hash, source }) => {
        const runtime = await globalThis.fonts.createTableFontRuntime({
          document,
          fontProfile: {
            schemaVersion: 1,
            faces: [{ id: 'main', typeface: 'KaTeX Main', assetHash: hash }],
          },
          assets: [{ faceId: 'main', bytes: new Uint8Array(bytes).buffer }],
        })
        globalThis.physicalRuntime = runtime
        globalThis.defaults = {
          run: {
            fontLatin: { typeface: 'KaTeX Main' },
            fontSizePt: 18,
            color: { kind: 'srgb', value: '123456' },
            italic: false,
            bold: false,
          },
        }
        globalThis.source = source
        globalThis.ready = {
          status: 'ready',
          fontRuntime: runtime,
          issues: [],
          sourceIdentity: hash,
        }
        globalThis.draw(source, globalThis.ready, globalThis.defaults)
        const text = document.querySelector('svg text')
        return {
          text: text?.textContent,
          family: text?.getAttribute('font-family'),
          size: text?.getAttribute('font-size'),
          alias: runtime.fontFamilies.main,
          alert: document.querySelector('[role=alert]')?.textContent,
        }
      },
      { bytes, hash, source }
    )
    expect(rendered).toMatchObject({ text: 'Source equation', size: '24' })
    expect(rendered.family).toBe(rendered.alias)
    expect(rendered.alert).toBeUndefined()
    const textId = source.root.children[0].children[0].componentId
    await page.getByRole('button', { name: `Select t ${textId}` }).click()
    await page.getByLabel('Math run text').fill('Edited equation')
    const edited = await page.evaluate(() => {
      const command = globalThis.command
      globalThis.source = globalThis.operations.applyOmmlOperation(
        globalThis.source,
        command.command
      )
      globalThis.draw(globalThis.source, globalThis.ready, globalThis.defaults)
      return { command, text: document.querySelector('svg text')?.textContent }
    })
    expect(edited.command.command).toEqual({
      type: 'setText',
      componentId: textId,
      text: 'Edited equation',
    })
    expect(edited.text).toBe('Edited equation')
    await page.screenshot({
      path: '.omo/evidence/pptx-semantic/resume-omml-completion-desktop.png',
    })
    await page.setViewportSize({ width: 375, height: 650 })
    await page.screenshot({ path: '.omo/evidence/pptx-semantic/resume-omml-completion-mobile.png' })
    const rejected = await page.evaluate(
      ({ textId }) => {
        const missing = globalThis.operations.applyOmmlOperation(globalThis.source, {
          type: 'setText',
          componentId: textId,
          text: '\u{1f600}',
        })
        globalThis.draw(missing, globalThis.ready, globalThis.defaults)
        const alert = document.querySelector('[role=alert]')
        const result = {
          text: alert?.textContent,
          id: alert?.getAttribute('data-component-id'),
          painted: Boolean(document.querySelector('svg')),
        }
        globalThis.draw(globalThis.source, globalThis.ready, globalThis.defaults)
        return result
      },
      { textId }
    )
    expect(rejected).toMatchObject({ id: textId, painted: false })
    expect(rejected.text).toMatch(/glyph coverage missing/)
    await page.getByRole('button', { name: `Select oMath ${source.root.componentId}` }).click()
    await page.getByRole('button', { name: 'Insert fraction', exact: true }).click()
    const structure = await page.evaluate(() => {
      const changed = globalThis.operations.applyOmmlOperation(
        globalThis.source,
        globalThis.command.command
      )
      globalThis.draw(changed, globalThis.ready, globalThis.defaults)
      const result = {
        type: changed.root.children.at(-1).type,
        alert: document.querySelector('[role=alert]')?.textContent,
        painted: Boolean(document.querySelector('svg')),
      }
      globalThis.draw(globalThis.source, globalThis.ready, globalThis.defaults)
      return result
    })
    expect(structure.type).toBe('f')
    expect(structure.alert).toMatch(/MATH/)
    expect(structure.painted).toBe(false)
    const states = await page.evaluate(() => {
      globalThis.draw(
        globalThis.source,
        { status: 'loading', fontRuntime: null, issues: [] },
        globalThis.defaults
      )
      const hidden = !document.querySelector('svg')
      globalThis.draw(
        globalThis.source,
        { status: 'idle', fontRuntime: null, issues: [] },
        globalThis.defaults,
        globalThis.physicalRuntime
      )
      const explicit = Boolean(document.querySelector('svg'))
      const face = [...document.fonts].find(
        (font) => font.family === globalThis.physicalRuntime.fontFamilies.main
      )
      face.family = 'invalidated_owned_alias'
      globalThis.draw(globalThis.source, globalThis.ready, globalThis.defaults)
      const stale = document.querySelector('[role=alert]')?.textContent
      face.family = globalThis.physicalRuntime.fontFamilies.main
      globalThis.unmount()
      const alive = globalThis.physicalRuntime.measurement.validate(
        globalThis.physicalRuntime.fontProfile,
        globalThis.physicalRuntime.rendererProfile
      )
      globalThis.physicalRuntime.dispose()
      return { hidden, explicit, alive, stale, frames: document.querySelectorAll('iframe').length }
    })
    expect(states).toMatchObject({ hidden: true, explicit: true, alive: null, frames: 0 })
    expect(states.stale).toMatch(/stale-table-output-fonts/)
  } finally {
    await browser.close()
  }
}, 30000)

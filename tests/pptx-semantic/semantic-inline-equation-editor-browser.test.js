import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { build } from 'esbuild'
import { chromium } from 'playwright'
import { expect, it } from 'vitest'

it('paints the inline atom with verified physical source fonts and edits its AST through real selection transactions', async () => {
  const bytes = [...await readFile('server/vendor/katex/dist/fonts/KaTeX_Main-Regular.ttf')]
  const hash = createHash('sha256').update(Buffer.from(bytes)).digest('hex')
  const bundle = await build({ stdin: { resolveDir: path.resolve('client'), loader: 'jsx', contents: `
    import React, {useLayoutEffect} from 'react';
    import {createRoot} from 'react-dom/client'; import {flushSync} from 'react-dom';
    import {useEditor,EditorContent} from '@tiptap/react';
    import {createEditorRichTextExtensions} from './src/hooks/editor-controller/editor-rich-text-extensions';
    import {semanticTextToTipTap,semanticTextFromTipTap} from './src/utils/pptx-semantic-text-bridge';
    import InlineEquationEditor from './src/components/properties/inline-equation-editor';
    import {PptxSourceFontContext} from './src/contexts/pptx-source-font-context';
    import fonts from '../shared/src/pptx-table-runtime-fonts';
    globalThis.fonts=fonts;
    const M='http://schemas.openxmlformats.org/officeDocument/2006/math';
    const node=(componentId,type,children=[],text)=>({componentId,namespaceUri:M,type,attributes:[],children,
      ...(text===undefined?{}:{text})});
    const source={schemaVersion:1,componentId:'body',paragraphs:[{componentId:'paragraph',
      defaultRunProperties:{fontLatin:{typeface:'KaTeX Main'},fontSizePt:18,
        color:{kind:'srgb',value:'123456'},bold:false,italic:false},runs:[
      {componentId:'before',kind:'text',text:'before '},
      {componentId:'equation',kind:'equation',ommlDocument:{schemaVersion:1,
        root:node('root','oMath',[node('run','r',[node('token','t',[],'x')])])}},
      {componentId:'after',kind:'text',text:' after'}]}]};
    function Harness(){
      const editor=useEditor({extensions:createEditorRichTextExtensions(),content:semanticTextToTipTap(source),
        onUpdate:({editor})=>{globalThis.saved=semanticTextFromTipTap(editor.getJSON())}});
      useLayoutEffect(()=>{globalThis.editor=editor},[editor]);
      return <><EditorContent editor={editor}/><InlineEquationEditor editor={editor} instanceId="instance"/></>;
    }
    const root=createRoot(document.querySelector('main'));
    globalThis.draw=value=>flushSync(()=>root.render(<PptxSourceFontContext.Provider value={value}>
      <Harness/></PptxSourceFontContext.Provider>));
    globalThis.unmount=()=>flushSync(()=>root.unmount());
  ` }, bundle: true, write: false, outfile: 'inline-equation-editor.js', platform: 'browser',
    define: { 'process.env.NODE_ENV': '"production"' } })
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.route('http://127.0.0.1/inline-equation-editor', (route) => route.fulfill({
      contentType: 'text/html', body: '<!doctype html><body><main></main></body>',
    }))
    await page.goto('http://127.0.0.1/inline-equation-editor')
    await page.addScriptTag({ content: bundle.outputFiles.find((file) => file.path.endsWith('.js')).text })
    await page.evaluate(async ({ bytes, hash }) => {
      const runtime = await globalThis.fonts.createTableFontRuntime({ document,
        fontProfile: { schemaVersion: 1, faces: [{ id: 'main', typeface: 'KaTeX Main', assetHash: hash }] },
        assets: [{ faceId: 'main', bytes: new Uint8Array(bytes).buffer }],
      })
      globalThis.physicalRuntime = runtime
      globalThis.draw({ status: 'ready', fontRuntime: runtime, issues: [], sourceIdentity: hash })
    }, { bytes, hash })
    await page.waitForSelector('[data-pptx-equation] svg text')
    const painted = await page.evaluate(() => {
      const runtime = globalThis.physicalRuntime
      const text = document.querySelector('[data-pptx-equation] svg text')
      return { text: text?.textContent, family: text?.getAttribute('font-family'),
        size: text?.getAttribute('font-size'), alias: runtime.fontFamilies.main,
        alert: document.querySelector('[role=alert]')?.textContent,
        surroundingText: globalThis.editor.state.doc.textContent }
    })
    expect(painted).toMatchObject({ text: 'x', size: '24', surroundingText: 'before  after' })
    expect(painted.family).toBe(painted.alias)
    expect(painted.alert).toBeUndefined()
    await page.getByRole('math', { name: 'Native inline equation' }).click()
    await page.getByRole('button', { name: 'Select t token', exact: true }).click()
    await page.getByLabel('Math run text').fill('alpha')
    expect(await page.locator('[data-pptx-equation] svg text').textContent()).toBe('alpha')
    const edited = await page.evaluate(() => globalThis.saved)
    expect(edited.paragraphs[0].runs.map((run) => run.kind)).toEqual(['text', 'equation', 'text'])
    expect(edited.paragraphs[0].runs[1]).not.toHaveProperty('text')
    expect(edited.paragraphs[0].runs[1].ommlDocument.root.children[0].children[0].text).toBe('alpha')
    await page.evaluate(() => globalThis.editor.commands.undo())
    await page.waitForFunction(() => document.querySelector('[data-pptx-equation] svg text')?.textContent === 'x')
    await page.evaluate(() => globalThis.editor.commands.redo())
    await page.waitForFunction(() => document.querySelector('[data-pptx-equation] svg text')?.textContent === 'alpha')
    await page.getByRole('button', { name: 'Select oMath root', exact: true }).click()
    await page.getByRole('button', { name: 'Insert fraction', exact: true }).click()
    expect(await page.locator('[data-pptx-equation] [role=alert]').textContent()).toMatch(/MATH/)
    expect(await page.locator('[data-pptx-equation] svg').count()).toBe(0)
    expect(await page.evaluate(() => globalThis.saved.paragraphs[0].runs[1].ommlDocument.root.children.at(-1).type)).toBe('f')
    await page.evaluate(() => globalThis.draw({ status: 'loading', fontRuntime: null, issues: [] }))
    expect(await page.locator('[data-pptx-equation] [role=alert]').textContent()).toMatch(/font runtime loading/)
    await page.evaluate(() => { globalThis.unmount(); globalThis.physicalRuntime.dispose() })
  } finally { await browser.close() }
}, 30000)

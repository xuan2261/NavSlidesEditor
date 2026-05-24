import { test, expect } from '@playwright/test'
import { EditorPage } from './pages/editor-page.js'
import { apiCreatePresentation, apiDeletePresentation } from './fixtures/test-fixtures.js'

test.describe('Toolbar Element Insertion', () => {
  let editorPage
  let presId

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Toolbar Elements Test')
    presId = pres.id
    editorPage = new EditorPage(page)
    await editorPage.gotoPresentation(presId)
  })

  test.afterEach(async ({ request }) => {
    try {
      await apiDeletePresentation(request, presId)
    } catch {}
  })

  test('can insert a Code Block', async () => {
    const prevCount = await editorPage.getElementCount()
    await editorPage.addCodeBlock()
    const newCount = await editorPage.getElementCount()
    expect(newCount).toBeGreaterThan(prevCount)
  })

  test('can insert a LaTeX block', async () => {
    const prevCount = await editorPage.getElementCount()
    await editorPage.addLatexBlock()
    const newCount = await editorPage.getElementCount()
    expect(newCount).toBeGreaterThan(prevCount)
  })

  test('can insert a Markdown block', async () => {
    const prevCount = await editorPage.getElementCount()
    await editorPage.addMarkdownBlock()
    const newCount = await editorPage.getElementCount()
    expect(newCount).toBeGreaterThan(prevCount)
  })

  test('can insert a Chart', async () => {
    const prevCount = await editorPage.getElementCount()
    await editorPage.addChart()
    const newCount = await editorPage.getElementCount()
    expect(newCount).toBeGreaterThan(prevCount)
  })

  test('can insert a Callout', async () => {
    const prevCount = await editorPage.getElementCount()
    await editorPage.addCallout()
    const newCount = await editorPage.getElementCount()
    expect(newCount).toBeGreaterThan(prevCount)
  })

  test('can insert an HTML Embed', async () => {
    const prevCount = await editorPage.getElementCount()
    await editorPage.addHtmlEmbed()
    const newCount = await editorPage.getElementCount()
    expect(newCount).toBeGreaterThan(prevCount)
  })

  test('can insert a Shape from dropdown', async () => {
    const prevCount = await editorPage.getElementCount()
    await editorPage.addShape('Rectangle')
    const newCount = await editorPage.getElementCount()
    expect(newCount).toBeGreaterThan(prevCount)
  })

  // eslint-disable-next-line unused-imports/no-unused-vars
  test('can insert a Table with prompt override', async ({ page }) => {
    const prevCount = await editorPage.getElementCount()
    await editorPage.addTable(3, 3)
    const newCount = await editorPage.getElementCount()
    expect(newCount).toBeGreaterThan(prevCount)
  })

  test('can insert a Line/Arrow', async () => {
    const prevCount = await editorPage.getElementCount()
    await editorPage.addLine()
    const newCount = await editorPage.getElementCount()
    expect(newCount).toBeGreaterThan(prevCount)
  })

  test('main text toolbar preserves editing and applies formatting controls', async () => {
    await editorPage.addTextNode()
    await editorPage.startEditingTextElement()
    await editorPage.typeInTextEditor('Hello world')

    await editorPage.selectAllText()
    await editorPage.clickMainToolbarButton('Bold (Ctrl+B)')

    let state = await editorPage.getTextEditorState()
    expect(state.proseMirrorCount).toBe(1)
    expect(state.toolbarHintVisible).toBe(false)
    expect(state.strongCount).toBeGreaterThan(0)
    expect(state.html).toContain('Hello world')

    await editorPage.selectAllText()
    await editorPage.chooseMainToolbarOption('Font size', '20px')

    state = await editorPage.getTextEditorState()
    expect(state.proseMirrorCount).toBe(1)
    expect(state.firstStyledSpan?.fontSize).toBe('20px')

    await editorPage.selectAllText()
    await editorPage.chooseMainToolbarOption('Font family', 'Georgia, serif')

    state = await editorPage.getTextEditorState()
    expect(state.proseMirrorCount).toBe(1)
    expect(state.firstStyledSpan?.fontFamily).toContain('Georgia')
  })
})

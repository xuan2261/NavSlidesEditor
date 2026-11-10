import { test, expect } from '../fixtures/test-fixtures.js'
import { contentFixture, setupContent, withPortable } from './release-content-fields.js'
import { peers, attemptWasm, ownedFrames, waitForAuthoredDescendant, inspectIsolation } from './portable-tikz-isolation.js'

const triangle =
  '\\begin{tikzpicture}\n\\draw[very thick,blue] (0,0) -- (3,0) -- (0,2) -- cycle;\n\\end{tikzpicture}'

test('real portable compiler grants Wasm only to root and compiler, not either sibling order or authored descendants', async ({
  page,
  request,
  browser,
  testPresentation,
}, testInfo) => {
  test.setTimeout(180000)
  const compiler = contentFixture('latex', {
    id: 'compiler',
    content: triangle,
    width: 360,
    height: 220,
    y: 230,
  })
  const ordered = [...peers('before'), compiler, ...peers('after')]
  await setupContent(page, request, testPresentation.id, ordered[0], ordered.slice(1))
  await withPortable(
    page,
    browser,
    testInfo,
    'compiler-sibling-isolation.html',
    async (portable) => {
      const result = await inspectIsolation(portable)
      await testInfo.attach('actual-compiler-boundaries', {
        body: JSON.stringify(result, null, 2),
        contentType: 'application/json',
      })
      await portable.screenshot({ path: testInfo.outputPath('compiler-sibling-isolation.png') })
      return result
    }
  )
})

test('portable decks without a native compiler deny Wasm at root, generated children and authored descendants', async ({
  page,
  request,
  browser,
  testPresentation,
}, testInfo) => {
  test.setTimeout(120000)
  const elements = peers('before')
  await setupContent(page, request, testPresentation.id, elements[0], elements.slice(1))
  await withPortable(page, browser, testInfo, 'no-compiler-isolation.html', async (portable) => {
    const children = await ownedFrames(
      portable,
      elements.map((element) => element.id)
    )
    await waitForAuthoredDescendant(children.get('html-before'), 'Nested authored before')
    const attempts = []
    for (const frame of portable.frames()) {
      await frame.waitForSelector('body')
      const result = await attemptWasm(frame)
      expect(result).toEqual({ allowed: false, name: 'CompileError' })
      attempts.push(result)
    }
    await testInfo.attach('actual-no-compiler-denial', {
      body: JSON.stringify(attempts),
      contentType: 'application/json',
    })
    return attempts
  })
})

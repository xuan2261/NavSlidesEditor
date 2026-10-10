import { test, expect } from '../fixtures/test-fixtures.js'
import { contentFixture, setupContent, withPortable } from './release-content-fields.js'

const triangle =
  '\\begin{tikzpicture}\n\\draw[very thick,blue] (0,0) -- (3,0) -- (0,2) -- cycle;\n\\end{tikzpicture}'
const dependencies = { network: false, offlineCapable: true, resources: [], dynamicResources: [] }

function peers(side) {
  const common = { width: 160, height: 100, y: side === 'before' ? 20 : 560 }
  return [
    contentFixture('html', {
      ...common,
      id: `html-${side}`,
      content: `<p>Authored ${side}</p><iframe data-ns-generated-frame="true" srcdoc="<p>Nested authored ${side}</p>"></iframe>`,
      htmlDependencies: dependencies,
    }),
    contentFixture('markdown', {
      ...common,
      id: `markdown-${side}`,
      content: `# Markdown ${side}`,
      x: 260,
    }),
    contentFixture('chart', {
      ...common,
      id: `chart-${side}`,
      x: 470,
      chartData: { labels: ['A', 'B'], datasets: [{ label: 'Lesson', data: [1, 2] }] },
    }),
    contentFixture('qrcode', { ...common, id: `qrcode-${side}`, x: 680, qrData: `Strict ${side}` }),
    contentFixture('html', {
      ...common,
      id: `mermaid-${side}`,
      x: 890,
      embedKind: 'mermaid',
      mermaidSource: 'flowchart LR\n A-->B',
      htmlDependencies: dependencies,
    }),
  ]
}

async function attemptWasm(frame) {
  await frame.evaluate(() => {
    window.__compilerBoundaryProbe = undefined
    const script = document.createElement('script')
    script.textContent = `WebAssembly.compile(new Uint8Array([0,97,115,109,1,0,0,0])).then(()=>window.__compilerBoundaryProbe={allowed:true},error=>window.__compilerBoundaryProbe={allowed:false,name:error.name})`
    document.body.appendChild(script)
  })
  await expect.poll(() => frame.evaluate(() => window.__compilerBoundaryProbe)).toBeDefined()
  return frame.evaluate(() => window.__compilerBoundaryProbe)
}

function allDescendantFrames(frame) {
  const descendants = []
  for (const child of frame.childFrames()) {
    descendants.push(child, ...allDescendantFrames(child))
  }
  return descendants
}

async function ownedFrames(page, expectedIds) {
  const children = new Map()
  await expect
    .poll(async () => {
      children.clear()
      for (const frame of page
        .frames()
        .filter((candidate) => candidate.parentFrame() === page.mainFrame())) {
        const element = await frame.frameElement()
        const id = await element.evaluate((node) =>
          node.closest('[data-ns-element-id]')?.getAttribute('data-ns-element-id')
        )
        if (id) children.set(id, frame)
      }
      return [...children.keys()].sort()
    })
    .toEqual([...expectedIds].sort())
  return children
}

async function waitForAuthoredDescendant(frame, text) {
  await expect
    .poll(async () => {
      for (const descendant of allDescendantFrames(frame)) {
        if (await descendant.getByText(text, { exact: true }).count()) return true
      }
      return false
    })
    .toBe(true)
}

async function inspectIsolation(page) {
  const children = await ownedFrames(page, [
    'compiler',
    ...peers('before').map((peer) => peer.id),
    ...peers('after').map((peer) => peer.id),
  ])

  const compiler = children.get('compiler')
  await expect
    .poll(
      async () =>
        compiler.locator('svg path').evaluateAll((paths) =>
          paths
            .map((path) => {
              const box = path.getBBox(),
                style = getComputedStyle(path)
              return {
                width: box.width,
                height: box.height,
                stroke: style.stroke,
                fill: style.fill,
                closed: /z\s*$/i.test(path.getAttribute('d')),
              }
            })
            .find((path) => path.width > 60 && path.height > 40 && path.closed)
        ),
      { timeout: 90000 }
    )
    .toMatchObject({ stroke: 'rgb(0, 0, 255)', fill: 'none', closed: true })
  const geometry = await compiler.locator('svg path').evaluateAll((paths) =>
    paths
      .map((path) => {
        const box = path.getBBox()
        return { width: box.width, height: box.height }
      })
      .find((box) => box.width > 60 && box.height > 40)
  )
  expect(geometry.width / geometry.height).toBeCloseTo(1.5, 1)
  expect(await attemptWasm(page.mainFrame())).toEqual({ allowed: true })
  expect(await attemptWasm(compiler)).toEqual({ allowed: true })

  const denied = {}
  for (const [id, frame] of children) {
    if (id === 'compiler') continue
    denied[id] = await attemptWasm(frame)
    expect(denied[id], `${id} must not inherit compiler authority`).toEqual({
      allowed: false,
      name: 'CompileError',
    })
    if (id.startsWith('html-'))
      await waitForAuthoredDescendant(frame, `Nested authored ${id.slice('html-'.length)}`)
    for (const [index, descendant] of allDescendantFrames(frame).entries()) {
      await descendant.waitForSelector('body')
      const key = `${id}-descendant-${index}`
      denied[key] = await attemptWasm(descendant)
      expect(denied[key], `${key} must remain strictly sandboxed`).toEqual({
        allowed: false,
        name: 'CompileError',
      })
    }
  }
  return { geometry, denied }
}

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

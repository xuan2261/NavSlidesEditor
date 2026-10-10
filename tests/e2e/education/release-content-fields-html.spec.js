import { test, expect } from '../fixtures/test-fixtures.js'
import {
  contentFixture,
  setupContent,
  inspector,
  sourceControl,
  reloadContent,
  fieldEvidence,
  withPresent,
  withPortable,
} from './release-content-fields.js'
import {
  finalFrameHtml,
  isolationHtml,
  inspectFinalFrame,
  inspectIsolation,
  openPrint,
} from './release-content-fields-html.js'
import { findFrame } from './release-surfaces.js'
import { captureSandboxNetwork } from './release-sandbox-network.js'

const dependencies = { network: false, offlineCapable: true, resources: [], dynamicResources: [] }

test('HTML source script produces the genuine final frame in canvas Present print and offline sandbox [cap:element.html.editor]', async ({
  page,
  request,
  browser,
  testPresentation,
}, testInfo) => {
  test.setTimeout(120000)
  const element = contentFixture('html', {
    content: '<p>Original embed</p>',
    htmlDependencies: dependencies,
    width: 800,
    height: 420,
  })
  await setupContent(page, request, testPresentation.id, element)
  await sourceControl(page, 'html', finalFrameHtml)
  const { persisted } = await reloadContent(page, request, testPresentation.id, element.id, {
    content: finalFrameHtml,
  })
  const canvas = await inspectFinalFrame(page)
  const generated = await withPresent(page, inspectFinalFrame)
  const print = await openPrint(page)
  let printed, printScreenshot
  try {
    printed = await inspectFinalFrame(print)
    printScreenshot = testInfo.outputPath('html-final-frame-print.png')
    await print.screenshot({ path: printScreenshot, fullPage: true })
  } finally {
    await print.close()
  }
  const portable = await withPortable(
    page,
    browser,
    testInfo,
    'html-final-frame-offline.html',
    async (offline) => {
      const finalFrame = await inspectFinalFrame(offline)
      const screenshot = testInfo.outputPath('html-final-frame-offline.png')
      await offline.screenshot({ path: screenshot })
      return { finalFrame, screenshot }
    }
  )
  await fieldEvidence(
    testInfo,
    page,
    'html',
    ['content', 'script', 'forPrint', 'finalFrame'],
    { finalFrame: 'Frame 3', geometry: { width: 140, height: 80, x: 40 } },
    {
      persisted,
      canvas,
      generated,
      printed,
      portable: portable.observed.finalFrame,
      network: portable.network,
    },
    [printScreenshot, portable.file, portable.observed.screenshot]
  )
})

test('HTML authored sandbox prevents real parent storage DOM and network API escapes on generated and print paths [cap:element.html.editor]', async ({
  page,
  request,
  testPresentation,
}, testInfo) => {
  const element = contentFixture('html', {
    content: '<p>Original isolation</p>',
    htmlDependencies: dependencies,
    width: 850,
    height: 440,
  })
  const network = captureSandboxNetwork(page.context())
  try {
    await setupContent(page, request, testPresentation.id, element)
    await sourceControl(page, 'html', isolationHtml)
    const { persisted } = await reloadContent(page, request, testPresentation.id, element.id, {
      content: isolationHtml,
    })
    network.scope('canvas')
    const canvas = await inspectIsolation(page)
    const generated = await withPresent(page, async (present) => {
      network.scope('generated')
      return inspectIsolation(present)
    })
    const print = await openPrint(page)
    let printed, screenshot
    try {
      network.scope('print')
      printed = await inspectIsolation(print)
      screenshot = testInfo.outputPath('html-runtime-isolation-print.png')
      await print.screenshot({ path: screenshot, fullPage: true })
    } finally {
      await print.close()
    }
    const attempts = await network.verify({ canvas, generated, print: printed })
    await fieldEvidence(
      testInfo,
      page,
      'html',
      ['parentIsolation', 'networkIsolation'],
      { parentAccess: 'denied', network: 'denied' },
      { persisted, canvas, generated, printed, attempts },
      [screenshot]
    )
  } finally {
    network.dispose()
  }
})

async function inspectMermaid(page) {
  const frame = await findFrame(page, '.mermaid svg')
  const nodes = frame.locator('.mermaid svg .node')
  await expect(nodes.locator('.nodeLabel')).toHaveText(['Qualified alpha', 'Qualified beta'])
  const positions = await nodes.evaluateAll((nodes) =>
    nodes.map((node) => {
      const b = node.getBoundingClientRect()
      return { x: b.x, y: b.y, width: b.width, height: b.height }
    })
  )
  for (const position of positions) {
    expect(position.width).toBeGreaterThan(40)
    expect(position.height).toBeGreaterThan(20)
  }
  const labels = await nodes.locator('.nodeLabel').evaluateAll((labels) =>
    labels.map((label) => {
      const bounds = label.getBoundingClientRect()
      return { width: bounds.width, height: bounds.height }
    })
  )
  for (const label of labels) {
    expect(label.width).toBeGreaterThan(0)
    expect(label.height).toBeGreaterThan(0)
  }
  const viewBox = await frame
    .locator('.mermaid svg')
    .evaluate((svg) => ({ width: svg.viewBox.baseVal.width, height: svg.viewBox.baseVal.height }))
  expect(viewBox.width).toBeGreaterThan(40)
  expect(viewBox.height).toBeGreaterThan(20)
  expect(positions[1].x).toBeGreaterThan(positions[0].x + positions[0].width)
  const edges = frame.locator('.mermaid svg .flowchart-link')
  await expect(edges).toHaveCount(1)
  const edge = await edges.evaluate((node) => {
    const length = node.getTotalLength(),
      transform = node.getScreenCTM()
    const start = node.getPointAtLength(0).matrixTransform(transform)
    const end = node.getPointAtLength(length).matrixTransform(transform)
    const marker = node.getAttribute('marker-end')
    const id = marker?.match(/#([^)]*)/)?.[1]
    return {
      length,
      start: { x: start.x, y: start.y },
      end: { x: end.x, y: end.y },
      marker,
      arrow: Boolean(id && node.ownerSVGElement.querySelector(`#${CSS.escape(id)} path`)),
    }
  })
  expect(edge.length).toBeGreaterThan(20)
  expect(edge.arrow).toBe(true)
  expect(edge.end.x).toBeGreaterThan(edge.start.x)
  expect(edge.start.x).toBeLessThan(positions[1].x)
  expect(edge.end.x).toBeGreaterThan(positions[0].x + positions[0].width)
  expect(edge.end.x).toBeLessThan(positions[1].x + positions[1].width / 2)
  expect(edge.end.y).toBeGreaterThan(positions[1].y)
  expect(edge.end.y).toBeLessThan(positions[1].y + positions[1].height)
  return {
    labels: await nodes.locator('.nodeLabel').allTextContents(),
    positions,
    labelBounds: labels,
    viewBox,
    edge,
  }
}

test('HTML Mermaid source control qualifies actual directed diagram across real offline and print frames [cap:element.html.editor]', async ({
  page,
  request,
  browser,
  testPresentation,
}, testInfo) => {
  test.setTimeout(120000)
  const element = contentFixture('html', {
    embedKind: 'mermaid',
    mermaidSource: 'graph LR\nA[Original]-->B[Before]',
    width: 900,
    height: 450,
  })
  await setupContent(page, request, testPresentation.id, element)
  await inspector(page).getByTestId('prop-html-edit').click()
  const source = 'graph LR\nA[Qualified alpha] --> B[Qualified beta]'
  const dialog = page.getByRole('dialog', { name: 'Mermaid Diagram', exact: true })
  await dialog.getByLabel('Mermaid source', { exact: true }).fill(source)
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click()
  const { persisted } = await reloadContent(page, request, testPresentation.id, element.id, {
    mermaidSource: source,
  })
  const canvas = await inspectMermaid(page)
  const generated = await withPresent(page, inspectMermaid)
  const print = await openPrint(page)
  let printed
  try {
    printed = await inspectMermaid(print)
  } finally {
    await print.close()
  }
  const portable = await withPortable(
    page,
    browser,
    testInfo,
    'html-mermaid-offline.html',
    async (offline) => {
      const diagram = await inspectMermaid(offline)
      const screenshot = testInfo.outputPath('html-mermaid-offline.png')
      await offline.screenshot({ path: screenshot })
      return { diagram, screenshot }
    }
  )
  await fieldEvidence(
    testInfo,
    page,
    'html',
    ['mermaid'],
    { direction: 'alpha-to-beta', edges: 1 },
    {
      persisted,
      canvas,
      generated,
      printed,
      portable: portable.observed.diagram,
      network: portable.network,
    },
    [portable.file, portable.observed.screenshot]
  )
})

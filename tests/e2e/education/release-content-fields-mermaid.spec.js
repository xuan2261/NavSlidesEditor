import { test, expect } from '../fixtures/test-fixtures.js'
import {
  contentFixture, setupContent, inspector, reloadContent, fieldEvidence, withPresent, withPortable,
} from './release-content-fields.js'
import { openPrint } from './release-content-fields-html.js'
import { findFrame } from './release-surfaces.js'
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

import { test, expect } from '../fixtures/test-fixtures.js'
import { decodePptx } from './release-static-artifacts.js'
import fs from 'node:fs/promises'
import pptxgen from 'pptxgenjs'
import JSZip from 'jszip'
import { JSDOM } from 'jsdom'
test('PPTX decoder reads only referenced visible chart labels, never hidden-series or orphan-package text', async ({}, testInfo) => {
  const pptx = new pptxgen()
  const bounds = { x: 1, y: 1, w: 5, h: 3 }
  pptx
    .addSlide()
    .addChart(
      pptx.ChartType.bar,
      [{ name: 'Authored series', labels: ['Visible category'], values: [5] }],
      { ...bounds, showLegend: true }
    )
  pptx
    .addSlide()
    .addChart(
      pptx.ChartType.bar,
      [{ name: 'Hidden series', labels: ['Hidden category'], values: [7] }],
      { ...bounds, showLegend: false, catAxisLabelPos: 'none' }
    )
  pptx
    .addSlide()
    .addChart(
      pptx.ChartType.bar,
      [{ name: 'Relative series', labels: ['Relative category'], values: [9] }],
      { ...bounds, showLegend: true }
    )
  const zip = await JSZip.loadAsync(await pptx.write({ outputType: 'nodebuffer' }))
  const slideXml = new JSDOM(await zip.file('ppt/slides/slide1.xml').async('string'), {
    contentType: 'application/xml',
  }).window.document
  const chartId = slideXml.getElementsByTagName('c:chart')[0].getAttribute('r:id')
  const relationships = new JSDOM(
    await zip.file('ppt/slides/_rels/slide1.xml.rels').async('string'),
    { contentType: 'application/xml' }
  ).window.document
  const relationship = [...relationships.getElementsByTagName('Relationship')].find(
    (item) => item.getAttribute('Id') === chartId
  )
  const target = new URL(
    relationship.getAttribute('Target'),
    'https://pptx.invalid/ppt/slides/'
  ).pathname.slice(1)
  relationship.setAttribute('Target', `/${target}`)
  zip.file('ppt/slides/_rels/slide1.xml.rels', relationships.documentElement.outerHTML)
  const visible = await zip.file(target).async('string')
  zip.file(
    'ppt/charts/unreferenced.xml',
    visible
      .replace(/Authored series/g, 'Private orphan answer')
      .replace(/Visible category/g, 'Private orphan category')
  )
  const filePath = testInfo.outputPath('decoder-visible-charts.pptx')
  await fs.writeFile(filePath, await zip.generateAsync({ type: 'nodebuffer' }))
  const decoded = await decodePptx(filePath, testInfo.outputPath('decoder-media'))
  expect(decoded.text).toContain('Authored series')
  expect(decoded.text).toContain('Visible category')
  expect(decoded.text).toContain('Relative series')
  expect(decoded.text).toContain('Relative category')
  expect(decoded.text).not.toContain('Hidden series')
  expect(decoded.text).not.toContain('Hidden category')
  expect(decoded.text).not.toContain('Private orphan')
})

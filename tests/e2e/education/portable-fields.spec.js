import { test, expect, apiUpdatePresentation } from '../fixtures/test-fixtures.js'
import { pathToFileURL } from 'node:url'
import { EditorPage } from '../pages/editor-page.js'

test('portable file renders sanitized Markdown and plotted chart without network or script errors', async ({
  page,
  request,
  testPresentation,
}, testInfo) => {
  await apiUpdatePresentation(request, testPresentation.id, {
    slides: [
      {
        id: 'portable-fields',
        background: { type: 'color', color: '#ffffff' },
        elements: [
          {
            id: 'markdown',
            type: 'markdown',
            x: 40,
            y: 40,
            width: 450,
            height: 300,
            content:
              '# Portable\n\n**Readable**\n\nLiteral entities: &quot; &amp; &lt;\n\n<script>window.compromised = true</script>',
            fontSize: 24,
            textColor: '#111111',
          },
          {
            id: 'chart',
            type: 'chart',
            x: 530,
            y: 40,
            width: 500,
            height: 330,
            chartType: 'bar',
            chartData: {
              labels: ['&quot;', 'B', 'C'],
              datasets: [{ label: 'Series', data: [0, -2, 3.5], color: '#6366f1' }],
            },
            axisTitles: { category: 'Month &quot;term&quot;', value: 'Revenue' },
            legendPosition: 'topRight',
          },
        ],
      },
    ],
  })
  await new EditorPage(page).gotoPresentation(testPresentation.id)
  await page.getByRole('button', { name: 'File menu', exact: true }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'Export HTML', exact: true }).click()
  const download = await downloadPromise
  const file = testInfo.outputPath('fields-offline.html')
  await download.saveAs(file)
  expect(await download.failure()).toBeNull()
  const offline = await page.context().newPage()
  const errors = []
  offline.on('pageerror', (error) => errors.push(error.message))
  await offline.route(/^https?:\/\//, (route) => route.abort())
  try {
    await offline.goto(pathToFileURL(file).href)
    await offline.waitForFunction(() => window.Reveal?.isReady())
    const markdown = offline.frameLocator('iframe').nth(0)
    await expect(markdown.getByRole('heading', { name: 'Portable', exact: true })).toBeVisible()
    await expect(markdown.locator('strong')).toHaveText('Readable')
    await expect(markdown.getByText('Literal entities: " & <', { exact: true })).toBeVisible()
    await expect(markdown.locator('#out script')).toHaveCount(0)
    const markdownFrame = offline
      .frames()
      .find((frame) => frame.parentFrame() && !frame.url().includes('blob:'))
    expect(await markdownFrame.evaluate(() => window.compromised === true)).toBe(false)
    let chartFrame
    await expect
      .poll(async () => {
        for (const frame of offline.frames()) {
          if (await frame.$('canvas#c')) {
            chartFrame = frame
            return true
          }
        }
        return false
      })
      .toBe(true)
    await chartFrame.waitForFunction(() =>
      window.Chart?.getChart(document.querySelector('canvas#c'))
    )
    expect(
      await chartFrame.evaluate(() => {
        const chart = Chart.getChart(document.querySelector('canvas#c'))
        return {
          values: chart.data.datasets[0].data,
          labels: chart.data.labels,
          x: chart.options.scales.x.title.text,
          y: chart.options.scales.y.title.text,
          legend: {
            position: chart.options.plugins.legend.position,
            align: chart.options.plugins.legend.align,
          },
        }
      })
    ).toEqual({
      values: [0, -2, 3.5],
      labels: ['&quot;', 'B', 'C'],
      x: 'Month &quot;term&quot;',
      y: 'Revenue',
      legend: { position: 'top', align: 'end' },
    })
    expect(errors).toEqual([])
  } finally {
    await offline.close()
  }
})

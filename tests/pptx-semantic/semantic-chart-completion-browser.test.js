import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let browser, page, bytes, hash
beforeAll(async () => {
  bytes = [...(await readFile('server/vendor/katex/dist/fonts/KaTeX_Main-Regular.ttf'))]
  hash = createHash('sha256').update(Buffer.from(bytes)).digest('hex')
  const names = [
    'pptx-text-document',
    'pptx-style-resolution',
    'pptx-text-layout-font',
    'pptx-text-layout-browser-line',
    'pptx-text-layout-browser',
    'pptx-table-runtime-fonts',
    'pptx-chart-visual-contract',
    'pptx-chart-native-contract',
    'pptx-chart-native-layout',
    'pptx-chart-native-financial',
    'pptx-chart-projection',
    'pptx-chart-native-series',
    'pptx-chart-native-primitives',
    'pptx-chart-native-surface',
    'pptx-chart-native-mesh',
    'pptx-chart-native-pie',
    'pptx-chart-native',
    'pptx-chart-document',
    'pptx-chart-svg-primitives',
    'pptx-chart-svg-cartesian',
    'pptx-chart-svg',
    'pptx-chart-render',
    'pptx-chart-operations',
  ]
  const factories = (
    await Promise.all(
      names.map(
        async (name) =>
          `factories['${name}']=(module,require)=>{${await readFile(`shared/src/${name}.js`, 'utf8')}\n};`
      )
    )
  ).join('\n')
  browser = await chromium.launch({ headless: true })
  page = await browser.newPage({ viewport: { width: 900, height: 600 } })
  await page.route('http://127.0.0.1/chart-completion', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html><body><main id="output"></main></body></html>',
    })
  )
  await page.goto('http://127.0.0.1/chart-completion')
  await page.addScriptTag({
    content: `const factories={},loaded={}; ${factories}
    globalThis.load=(name)=>{name=name.replace(/^\\.\\//,'').replace(/\\.js$/,'');
    if(!loaded[name]){const m={exports:{}};loaded[name]=m;factories[name](m,load)}return loaded[name].exports};`,
  })
})
afterAll(async () => {
  await page?.close()
  await browser?.close()
})

describe('source SVG chart with actual verified font bytes', () => {
  it('uses source label styles and verified aliases at desktop and mobile sizes; stale runtime rejects', async () => {
    const result = await page.evaluate(
      async ({ bytes, hash }) => {
        const { createTableFontRuntime } = globalThis.load('pptx-table-runtime-fonts')
        const { projectChartRender } = globalThis.load('pptx-chart-render')
        const runtime = await createTableFontRuntime({
          document,
          fontProfile: {
            schemaVersion: 1,
            faces: [{ id: 'main', typeface: 'KaTeX Main', assetHash: hash }],
          },
          assets: [{ faceId: 'main', bytes: new Uint8Array(bytes).buffer }],
        })
        const origin = (id, index) => ({
          definitionId: id,
          partUri: 'ppt/charts/chart1.xml',
          preconditionHash: 'a'.repeat(64),
          path: [0, index],
        })
        const style = {
          fontFamily: 'KaTeX Main',
          fontSizePt: 12,
          bold: false,
          italic: false,
          color: '123456',
        }
        const d = {
          schemaVersion: 1,
          source: {
            partUri: 'ppt/charts/chart1.xml',
            preconditionHash: 'a'.repeat(64),
            ownerDefinitionId: 'frame',
            relationshipId: 'rId1',
          },
          options: {},
          axes: [],
          title: { kind: 'text', value: 'Source labels', textStyle: style },
          plots: [
            {
              family: 'pieChart',
              options: {},
              axisIds: [],
              series: [
                {
                  id: 's',
                  source: origin('s', 1),
                  index: 0,
                  order: 0,
                  options: {},
                  paint: { fill: { kind: 'solid', color: 'C0504D' } },
                  data: {
                    val: {
                      kind: 'numLit',
                      cache: {
                        count: 1,
                        points: [{ index: 0, value: 7, lexicalValue: '7', source: origin('p', 2) }],
                      },
                    },
                  },
                  dataLabels: {
                    options: { showVal: true, dLblPos: 'ctr' },
                    labels: [],
                    textStyle: style,
                    numberFormat: { formatCode: '0.0', sourceLinked: false },
                  },
                },
              ],
            },
          ],
        }
        const outcomes = []
        for (const themed of [false, true])
          for (const width of [800, 320]) {
            const input = structuredClone(d)
            if (themed) {
              input.title.textStyle.fontFamily = '+mn-lt'
              input.plots[0].series[0].dataLabels.textStyle.fontFamily = '+mn-lt'
            }
            const result = projectChartRender(input, {
              width,
              height: 300,
              fontRuntime: runtime,
              ...(themed ? { theme: { fonts: { minor: { latin: 'KaTeX Main' } } } } : {}),
            })
            document.getElementById('output').style.width = `${width}px`
            document.getElementById('output').style.height = '300px'
            document.getElementById('output').innerHTML = result.svg ?? ''
            const texts = [...document.querySelectorAll('#output text')]
            const svg = document.querySelector('#output svg')?.getBoundingClientRect()
            outcomes.push({
              supported: result.supported,
              texts: texts.map((n) => n.textContent),
              colors: texts.map((n) => n.getAttribute('fill')),
              aliases: texts.every(
                (n) => n.getAttribute('font-family') === runtime.fontFamilies.main
              ),
              contained: texts.every((n) => {
                const r = n.getBoundingClientRect()
                return (
                  r.width > 0 &&
                  r.height > 0 &&
                  r.left >= svg.left &&
                  r.right <= svg.right &&
                  r.top >= svg.top &&
                  r.bottom <= svg.bottom
                )
              }),
            })
          }
        globalThis.chartRuntime = runtime
        globalThis.chartFixture = d
        globalThis.chartRender = projectChartRender
        return outcomes
      },
      { bytes, hash }
    )
    expect(result).toEqual(
      [800, 320, 800, 320].map(() => ({
        supported: true,
        texts: ['Source labels', '7.0'],
        colors: ['#123456', '#123456'],
        aliases: true,
        contained: true,
      }))
    )
    await page.screenshot({ path: '.omo/evidence/pptx-semantic/chart-completion-mobile.png' })
    await page.evaluate(() => {
      const result = globalThis.chartRender(globalThis.chartFixture, {
        width: 800,
        height: 300,
        fontRuntime: globalThis.chartRuntime,
      })
      document.getElementById('output').style.width = '800px'
      document.getElementById('output').innerHTML = result.svg
    })
    await page.screenshot({ path: '.omo/evidence/pptx-semantic/chart-completion-desktop.png' })
    const stale = await page.evaluate(() => {
      globalThis.chartRuntime.dispose()
      return globalThis.chartRender(globalThis.chartFixture, {
        width: 800,
        height: 300,
        fontRuntime: globalThis.chartRuntime,
      })
    })
    expect(stale.supported).toBe(false)
    expect(stale.issues[0].code).toBe('stale-table-output-fonts')
    expect(stale.svg).toBeUndefined()
  })
  it('renders source axes, grid paint, number formats and a source bar with the same verified runtime', async () => {
    const result = await page.evaluate(
      async ({ bytes, hash }) => {
        const runtime = await globalThis.load('pptx-table-runtime-fonts').createTableFontRuntime({
          document,
          fontProfile: {
            schemaVersion: 1,
            faces: [{ id: 'main', typeface: 'KaTeX Main', assetHash: hash }],
          },
          assets: [{ faceId: 'main', bytes: new Uint8Array(bytes).buffer }],
        })
        globalThis.axisRuntime = runtime
        const d = structuredClone(globalThis.chartFixture),
          plot = d.plots[0],
          series = plot.series[0]
        const style = d.title.textStyle,
          axisPaint = { line: { widthEmu: 9525, fill: { kind: 'solid', color: '667788' } } }
        d.axes = [
          {
            id: 10,
            crossAxisId: 20,
            kind: 'catAx',
            options: { axPos: 'b' },
            paint: axisPaint,
            textStyle: style,
          },
          {
            id: 20,
            crossAxisId: 10,
            kind: 'valAx',
            options: { axPos: 'l', majorUnit: 2 },
            scaling: { min: 0, max: 10 },
            paint: axisPaint,
            majorGridlines: axisPaint,
            textStyle: style,
            numberFormat: { formatCode: '0.0', sourceLinked: false },
          },
        ]
        plot.family = 'barChart'
        plot.options = { grouping: 'clustered' }
        plot.axisIds = [10, 20]
        series.data.cat = {
          kind: 'strLit',
          cache: {
            count: 1,
            points: [
              {
                index: 0,
                value: 'A',
                source: { ...series.source, definitionId: 'cat', path: [0, 3] },
              },
            ],
          },
        }
        const result = globalThis.chartRender(d, { width: 800, height: 300, fontRuntime: runtime })
        document.getElementById('output').innerHTML = result.svg ?? ''
        const bar = document
          .querySelector('#output rect[data-chart-point]')
          ?.getBoundingClientRect()
        const label = document
          .querySelector('#output text[data-chart-text*=".labels."]')
          ?.getBoundingClientRect()
        return {
          supported: result.supported,
          issues: result.issues,
          texts: [...document.querySelectorAll('#output text')].map((t) => t.textContent),
          axes: [...document.querySelectorAll('[data-chart-axis]')].map((a) =>
            a.getAttribute('stroke')
          ),
          centered:
            Math.abs(label.x + label.width / 2 - bar.x - bar.width / 2) < 1 &&
            Math.abs(label.y + label.height / 2 - bar.y - bar.height / 2) < label.height,
          points: result.model?.series[0].points.map((p) => p.index),
        }
      },
      { bytes, hash }
    )
    expect(result).toEqual({
      supported: true,
      issues: undefined,
      texts: ['Source labels', 'A', '0.0', '2.0', '4.0', '6.0', '8.0', '10.0', '7.0'],
      axes: ['#667788', '#667788'],
      centered: true,
      points: [0],
    })
    await page.screenshot({ path: '.omo/evidence/pptx-semantic/chart-completion-axes.png' })
    await page.evaluate(() => globalThis.axisRuntime.dispose())
  })
})

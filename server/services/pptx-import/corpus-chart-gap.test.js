/**
 * T5.2–T5.5: chart corpus decks import native editable charts with E2 gap 0
 * (scene-graph + OOXML inject path; does not require parser worker).
 */
import fs from 'node:fs'
import path from 'node:path'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { buildOoxmlSceneGraph } from './ooxml-scene-graph/index.js'
import { mapPptxOutput } from './mapper/index.js'

const CORPUS = path.resolve('server/data/test-corpus')
const CHART_DECKS = ['chart-bars-lines.pptx', 'chart-pie-scatter.pptx']

async function mapDeckWithOoxml(fileName) {
  const buf = fs.readFileSync(path.join(CORPUS, fileName))
  const zip = await JSZip.loadAsync(buf)
  const sceneGraph = await buildOoxmlSceneGraph(zip)
  // EMU size for 16:9 often used in corpus
  const mapped = await mapPptxOutput({
    output: {
      slides: [{ elements: [] }],
      size: { width: 12192000, height: 6858000 },
    },
    zip,
    originalName: fileName,
    sceneGraph,
  })
  return { mapped, sceneGraph }
}

describe('corpus chart native import (T5.2–T5.5)', () => {
  for (const file of CHART_DECKS) {
    it(`T5.2/T5.3/T5.4 ${file}: native charts, gap 0, no degraded warning`, async () => {
      const { mapped, sceneGraph } = await mapDeckWithOoxml(file)
      const elements = mapped.presentation.slides.flatMap((s) => s.elements || [])
      const charts = elements.filter((e) => e.type === 'chart')
      expect(charts.length).toBeGreaterThan(0)
      expect(sceneGraph.stats.chartNodes).toBeGreaterThan(0)
      expect(mapped.stats.nativeObjectCoverage.chartCoverageGapCount).toBe(0)
      expect(charts.length).toBeGreaterThanOrEqual(sceneGraph.stats.chartNodes)

      const degraded = (mapped.warnings || []).filter((w) => w.type === 'native-chart-degraded')
      expect(degraded).toHaveLength(0)

      // T5.5 editable chartData shape
      for (const chart of charts) {
        expect(Array.isArray(chart.chartData?.labels)).toBe(true)
        expect(Array.isArray(chart.chartData?.datasets)).toBe(true)
        expect(chart.chartData.datasets.length).toBeGreaterThan(0)
        expect(chart.chartData.datasets[0].data.every((v) => Number.isFinite(Number(v)))).toBe(true)
        expect(chart._pptxSource?.nodeId).toBeTruthy()
      }
    })
  }

  it('T5.5 mutate chart dataset value persists in JSON clone', async () => {
    const { mapped } = await mapDeckWithOoxml('chart-bars-lines.pptx')
    const chart = mapped.presentation.slides[0].elements.find((e) => e.type === 'chart')
    expect(chart).toBeTruthy()
    const before = chart.chartData.datasets[0].data[0]
    chart.chartData.datasets[0].data[0] = before + 1
    const clone = JSON.parse(JSON.stringify(mapped.presentation))
    const again = clone.slides[0].elements.find((e) => e.type === 'chart')
    expect(again.chartData.datasets[0].data[0]).toBe(before + 1)
  })
})

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import exportModule from './server-export.js'

const { exportToFile } = exportModule

describe('server chart and table PPTX package export', () => {
  it('keeps radar, supported authored chart options, and rotated merged tables native', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'navslides-chart-table-'))
    const outFile = path.join(tempDir, 'chart-table.pptx')

    try {
      const result = await exportToFile(
        {
          title: 'Chart table export',
          resolution: { width: 960, height: 540 },
          slides: [
            {
              elements: [
                {
                  id: 'radar',
                  type: 'chart',
                  chartType: 'radar',
                  x: 20,
                  y: 20,
                  width: 280,
                  height: 220,
                  chartData: { labels: ['A', 'B'], datasets: [{ label: 'Series', data: [2, 4] }] },
                },
                {
                  id: 'filled-line',
                  type: 'chart',
                  chartType: 'line',
                  areaFill: true,
                  stacked: true,
                  legendPosition: 'bottom',
                  axisTitles: { category: 'Month', value: 'Revenue' },
                  x: 320,
                  y: 20,
                  width: 280,
                  height: 220,
                  chartData: {
                    labels: ['Jan', 'Feb'],
                    datasets: [
                      { label: 'North', data: [2, 4], color: '#ef4444' },
                      { label: 'South', data: [3, 5], color: '#22c55e' },
                    ],
                  },
                },
                {
                  id: 'polar-fallback',
                  type: 'chart',
                  chartType: 'polarArea',
                  x: 620,
                  y: 20,
                  width: 280,
                  height: 220,
                  chartData: { labels: ['A', 'B'], datasets: [{ label: 'Series', data: [2, 4] }] },
                },
                {
                  id: 'rotated-merged-table',
                  type: 'table',
                  rotation: 15,
                  x: 20,
                  y: 280,
                  width: 600,
                  height: 180,
                  data: [
                    ['A', 'B', 'C', 'D'],
                    ['E', 'F', 'G', 'H'],
                    ['I', 'J', 'K', 'L'],
                  ],
                  mergedCells: [
                    { row: 0, col: 0, rowSpan: 1, colSpan: 2 },
                    { row: 1, col: 2, rowSpan: 2, colSpan: 2 },
                  ],
                },
              ],
            },
          ],
        },
        outFile,
        { strictRaster: true }
      )

      const zip = await JSZip.loadAsync(await fs.readFile(outFile))
      const chartXml = await Promise.all(
        Object.keys(zip.files)
          .filter((name) => /^ppt\/charts\/chart\d+\.xml$/.test(name))
          .map((name) => zip.file(name).async('string'))
      )
      const radarXml = chartXml.find((xml) => xml.includes('<c:radarChart>'))
      const areaXml = chartXml.find((xml) => xml.includes('<c:areaChart>'))
      const slideXml = await zip.file('ppt/slides/slide1.xml').async('string')

      expect(radarXml).toContain('<c:radarStyle val="standard"/>')
      expect(areaXml).toContain('<c:grouping val="stacked"/>')
      expect(areaXml).toContain('<c:legendPos val="b"/>')
      expect(areaXml).toContain('Month')
      expect(areaXml).toContain('Revenue')
      expect(chartXml).toHaveLength(2)
      expect(slideXml).toContain('<a:tbl>')
      expect([...slideXml.matchAll(/<a:tc[^>]*gridSpan="2"/g)]).toHaveLength(3)
      expect(slideXml).toMatch(/<a:tc[^>]*rowSpan="2"[^>]*gridSpan="2"/)
      expect(result.warnings.exportReport.warnings).toEqual([
        expect.objectContaining({
          elementId: 'rotated-merged-table',
          fallback: 'native-table-unrotated',
          matrixRowId: 'table.table-layout-rotation.pptx-export',
        }),
      ])
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.stringMatching(
            /^Slide 1: (rasterized chart fallback|inserted placeholder for chart)$/
          ),
        ])
      )
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  }, 60000)
})

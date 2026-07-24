import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import importer from './importer.js'

const { buildImportStats, importPptxFile } = importer
const CORPUS = path.resolve('server/data/test-corpus')

describe('pptx importer stats boundary', () => {
  it('exposes finite scene reconciliation counts without fallback telemetry', () => {
    const nativeObjectCoverage = {
      chartEvidenceCount: 2,
      smartArtEvidenceCount: 1,
      mappedNativeChartCount: 1,
      mappedNativeDiagramCount: 0,
      chartCoverageGapCount: 1,
      smartArtCoverageGapCount: 1,
    }
    const ooxml = {
      nativeChartCount: 2,
      nativeSmartArtCount: 1,
      slideEvidence: [{ slideIndex: 0, chartEntries: ['ppt/charts/chart1.xml'] }],
    }

    const stats = buildImportStats({
      mappedStats: {
        slideCount: 1,
        chartCount: 1,
        nativeChartCount: 2,
        nativeSmartArtCount: 1,
        nativeChartImportedCount: 1,
        nativeSmartArtImportedCount: 0,
        nativeObjectCoverage,
        ooxml,
        sceneGraphMappedNodes: 0,
        sceneGraphUnmapped: 7,
      },
      parsed: { packageVersion: '2.0.2' },
      startedAt: 10,
      now: 25,
    })

    expect(stats).toMatchObject({
      parser: 'pptxtojson',
      packageVersion: '2.0.2',
      chartCount: 1,
      nativeChartCount: 2,
      nativeSmartArtCount: 1,
      nativeChartImportedCount: 1,
      nativeSmartArtImportedCount: 0,
      nativeObjectCoverage,
      ooxml,
      sceneGraphMappedNodes: 0,
      sceneGraphUnmapped: 7,
      durationMs: 15,
    })
    expect(stats).not.toHaveProperty('fallbackParserUsed')
  })

  it('keeps the runtime import path free of fallback inspection or warnings', async () => {
    const [workerSource, importerSource] = await Promise.all([
      fs.readFile(path.resolve('server/services/pptx-import/parse-worker.js'), 'utf8'),
      fs.readFile(path.resolve('server/services/pptx-import/importer.js'), 'utf8'),
    ])

    expect(workerSource).toContain("require('pptxtojson/dist/index.cjs')")
    expect(workerSource).not.toContain('pptx2json')
    expect(workerSource).not.toContain('fallback')
    expect(importerSource).not.toContain('fallback-inspector')
    expect(importerSource).not.toContain('fallbackParserUsed')
  })

  it('forwards source-map identity through the production importer boundary', async () => {
    const uploadsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-import-source-map-'))
    try {
      const imported = await importPptxFile(path.join(CORPUS, 'math-rich-text.pptx'), {
        originalName: 'math-rich-text.pptx',
        uploadsDir,
        sourceMapIdentity: {
          presentationId: 'forwarded-deck',
          revisionId: 'r0',
          packageGeneration: 9,
        },
      })

      expect(imported.sourceMap).toMatchObject({
        presentationId: 'forwarded-deck',
        revisionId: 'r0',
        packageGeneration: 9,
      })
    } finally {
      await fs.rm(uploadsDir, { recursive: true, force: true })
    }
  })
})


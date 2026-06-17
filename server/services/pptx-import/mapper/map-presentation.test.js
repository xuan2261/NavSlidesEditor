import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import presentationMapper from './map-presentation.js'

const { mapPptxOutput } = presentationMapper

describe('pptx presentation mapper', () => {
  it('maps slide metadata and preserves export contract shape', async () => {
    const progress = []
    const result = await mapPptxOutput({
      output: {
        size: { width: 960, height: 540 },
        usedFonts: ['Arial'],
        themeColors: ['#ffffff'],
        slides: [{
          fill: { type: 'gradient', stops: [{ color: '#000000', position: 0 }] },
          transition: { type: 'fade', duration: 350, direction: 'left' },
          note: '<b>Speaker</b>',
          elements: [{ type: 'text', content: '<p>Hello</p>', left: 1, top: 2, width: 3, height: 4 }],
        }],
      },
      zip: { files: {} },
      originalName: 'Deck.pptx',
      uploadsDir: '/tmp',
      onProgress: (event) => progress.push(event),
    })

    expect(result.presentation).toMatchObject({
      title: 'Deck',
      theme: 'white',
      transition: 'slide',
      resolution: { width: 960, height: 540 },
    })
    expect(result.presentation.slides[0]).toMatchObject({
      transition: 'fade',
      transitionDuration: 350,
      transitionDirection: 'left',
      notes: '<b>Speaker</b>',
    })
    expect(result.presentation.slides[0].elements[0]).toMatchObject({ type: 'text', zIndex: 1 })
    expect(result.stats).toMatchObject({ slideCount: 1, textCount: 1 })
    expect(progress).toEqual([
      { stage: 'mapping', percent: 80, message: 'Processing slide 1 of 1' },
    ])
  })

  it('maps non-default slide sizes into the canonical canvas resolution', async () => {
    const result = await mapPptxOutput({
      output: {
        size: { width: 720, height: 540 },
        slides: [{
          elements: [{
            type: 'text',
            left: 360,
            top: 270,
            width: 100,
            height: 50,
            content: '<p>Mid</p>',
          }],
        }],
      },
      zip: { files: {} },
      originalName: '4x3.pptx',
      uploadsDir: '/tmp',
    })

    expect(result.presentation.resolution).toEqual({ width: 960, height: 540 })
    expect(result.presentation._pptxMeta.originalSize).toEqual({ width: 720, height: 540 })
    expect(result.presentation.slides[0].elements[0]).toMatchObject({
      x: 480,
      y: 270,
      width: 133,
      height: 50,
    })
  })

  it('stores text import insets as canvas px metadata', async () => {
    const result = await mapPptxOutput({
      output: {
        size: { width: 960, height: 540 },
        slides: [{
          elements: [{
            type: 'text',
            left: 0,
            top: 0,
            width: 200,
            height: 50,
            insetLeft: 7.2,
            insetRight: 7.2,
            insetTop: 3.6,
            insetBottom: 3.6,
            content: '<p>X</p>',
          }],
        }],
      },
      zip: { files: {} },
      originalName: 'Insets.pptx',
      uploadsDir: '/tmp',
    })

    expect(result.presentation.slides[0].elements[0]._pptxImportMeta).toMatchObject({
      textInsets: { left: 7.2, right: 7.2, top: 3.6, bottom: 3.6 },
      textInsetsUnit: 'px',
    })
  })

  it('stops mapping when the import signal is aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(mapPptxOutput({
      output: { size: { width: 960, height: 540 }, slides: [{ elements: [] }] },
      zip: { files: {} },
      originalName: 'Deck.pptx',
      uploadsDir: '/tmp',
      signal: controller.signal,
    })).rejects.toThrow(/aborted/i)
  })

  it('surfaces native OOXML chart and SmartArt coverage gaps', async () => {
    const zip = new JSZip()
    zip.file('ppt/charts/chart1.xml', '<c:chartSpace />')
    zip.file('ppt/diagrams/data1.xml', '<dgm:dataModel />')
    zip.file('ppt/diagrams/layout1.xml', '<dgm:layoutDef />')
    zip.file('ppt/slides/slide1.xml', '<p:sld />')
    zip.file('ppt/slides/_rels/slide1.xml.rels', `
      <Relationships>
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml" />
        <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramData" Target="../diagrams/data1.xml" />
      </Relationships>
    `)

    const result = await mapPptxOutput({
      output: { size: { width: 960, height: 540 }, slides: [{ elements: [] }] },
      zip,
      originalName: 'NativeObjects.pptx',
      uploadsDir: '/tmp',
    })

    expect(result.stats).toMatchObject({
      nativeChartCount: 1,
      nativeSmartArtCount: 1,
      nativeObjectCoverage: {
        chartEvidenceCount: 1,
        smartArtEvidenceCount: 1,
        mappedNativeChartCount: 0,
        mappedNativeDiagramCount: 0,
        chartCoverageGapCount: 1,
        smartArtCoverageGapCount: 1,
        slides: [{
          slideIndex: 0,
          chartEvidenceCount: 1,
          smartArtEvidenceCount: 1,
          mappedNativeChartCount: 0,
          mappedNativeDiagramCount: 0,
          chartCoverageGapCount: 1,
          smartArtCoverageGapCount: 1,
        }],
      },
      ooxml: {
        nativeChartCount: 1,
        nativeSmartArtCount: 1,
      },
    })
    expect(result.warnings).toEqual(expect.arrayContaining([
      {
        slideIndex: 0,
        type: 'native-chart-degraded',
        message: expect.stringContaining('slide 1'),
      },
      {
        slideIndex: 0,
        type: 'native-smartart-degraded',
        message: expect.stringContaining('slide 1'),
      },
    ]))
  })

  it('does not let a mapped chart on another slide hide an OOXML chart gap', async () => {
    const zip = new JSZip()
    zip.file('ppt/charts/chart1.xml', '<c:chartSpace />')
    zip.file('ppt/charts/chart2.xml', '<c:chartSpace />')
    zip.file('ppt/slides/slide1.xml', '<p:sld />')
    zip.file('ppt/slides/slide2.xml', '<p:sld />')
    zip.file('ppt/slides/_rels/slide1.xml.rels', `
      <Relationships>
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml" />
      </Relationships>
    `)
    zip.file('ppt/slides/_rels/slide2.xml.rels', `
      <Relationships>
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart2.xml" />
      </Relationships>
    `)

    const result = await mapPptxOutput({
      output: {
        size: { width: 960, height: 540 },
        slides: [
          { elements: [] },
          {
            elements: [{
              type: 'chart',
              chartType: 'barChart',
              left: 100,
              top: 100,
              width: 400,
              height: 300,
              data: [{ key: 'Series 1', values: [{ x: 'A', y: 10 }] }],
            }],
          },
        ],
      },
      zip,
      originalName: 'CrossSlide.pptx',
      uploadsDir: '/tmp',
    })

    expect(result.stats.nativeObjectCoverage).toMatchObject({
      chartEvidenceCount: 2,
      mappedNativeChartCount: 1,
      chartCoverageGapCount: 1,
    })
    expect(result.warnings).toEqual([
      {
        slideIndex: 0,
        type: 'native-chart-degraded',
        message: expect.stringContaining('slide 1'),
      },
    ])
  })
})

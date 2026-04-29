/* global describe, expect, it */
const { scoreParser } = require('./report-writer')
const { summarizeParserOutput } = require('./summarize-parser-output')

const inventory = {
  slideCount: 1,
  packageCounts: { media: 2, notesSlides: 1 },
}

describe('summarize-parser-output', () => {
  it('summarizes semantic parser output for editable object coverage', () => {
    const summary = summarizeParserOutput('pptxtojson', {
      themeColors: ['#fff'],
      usedFonts: ['Arial'],
      size: { width: 1280, height: 720 },
      slides: [{
        note: 'speaker note',
        layoutElements: [{ type: 'shape' }],
        elements: [
          { type: 'text' },
          { type: 'image' },
          { type: 'table' },
          { type: 'group', elements: [{ type: 'math' }] },
        ],
      }],
    }, inventory)

    expect(summary).toMatchObject({
      slideCount: 1,
      textCount: 1,
      imageCount: 1,
      shapeCount: 1,
      tableCount: 1,
      groupCount: 1,
      noteCount: 1,
      verdict: 'pass',
    })
    expect(summary.unsupportedObjects).toContain('equation')
  })

  it('summarizes raw OOXML output using package keys and XML markers', () => {
    const summary = summarizeParserOutput('pptx2json', {
      'ppt/slides/slide1.xml': {
        'p:sp': [{}],
        nested: { 'a:t': ['hello'], 'p:pic': [{}], 'a:tbl': [{}] },
      },
      'ppt/media/image1.png': Buffer.from('x'),
      'ppt/theme/theme1.xml': {},
      'ppt/slideLayouts/slideLayout1.xml': {},
      'ppt/embeddings/oleObject1.bin': Buffer.from('x'),
    }, inventory)

    expect(summary).toMatchObject({
      slideCount: 1,
      textCount: 1,
      imageCount: 1,
      shapeCount: 1,
      tableCount: 1,
      mediaCount: 1,
      verdict: 'partial',
    })
    expect(summary.unsupportedObjects).toContain('ole')
  })

  it('scores semantic parsers higher when they preserve notes and layout evidence', () => {
    const strong = [{
      ok: true,
      summary: {
        compare: { slideCountMatches: true, inventoryNoteCount: 1 },
        textCount: 1,
        imageCount: 1,
        shapeCount: 1,
        tableCount: 1,
        noteCount: 1,
        hasThemeColors: true,
        hasLayoutElements: true,
      },
    }]
    const weak = [{
      ok: true,
      summary: {
        compare: { slideCountMatches: true, inventoryNoteCount: 1 },
        textCount: 1,
        imageCount: 1,
        shapeCount: 1,
        tableCount: 1,
        noteCount: 0,
        hasThemeColors: false,
        hasLayoutElements: false,
      },
    }]

    expect(scoreParser('pptxtojson', strong).total)
      .toBeGreaterThan(scoreParser('ppt-parser', weak).total)
  })
})

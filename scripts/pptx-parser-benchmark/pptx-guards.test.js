const fs = require('fs')
const os = require('os')
const path = require('path')
const JSZip = require('jszip')
const {
  assertInsidePlanResearch,
  loadPptxWithBudget,
  PLAN_RESEARCH_ROOT,
} = require('./pptx-guards')

describe('pptx benchmark guards', () => {
  it('keeps output paths inside the plan research directory', () => {
    expect(assertInsidePlanResearch(path.join(PLAN_RESEARCH_ROOT, 'parser-summary')))
      .toContain('parser-summary')
    expect(() => assertInsidePlanResearch('scripts')).toThrow(/Output path/)
  })

  it('rejects pptx files that exceed ZIP entry limits', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pptx-guard-'))
    const filePath = path.join(dir, 'many.pptx')
    const zip = new JSZip()
    zip.file('ppt/slides/slide1.xml', '<p:sld/>')
    zip.file('ppt/slides/slide2.xml', '<p:sld/>')
    fs.writeFileSync(filePath, await zip.generateAsync({ type: 'nodebuffer' }))

    await expect(loadPptxWithBudget(filePath, {
      maxFileBytes: 1024 * 1024,
      maxEntries: 1,
      maxUncompressedBytes: 1024 * 1024,
    })).rejects.toThrow(/entry count/)
  })
})

import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import ooxmlInspection from './ooxml-inspection.js'

const { inspectOoxmlCoverage } = ooxmlInspection

describe('pptx OOXML inspection', () => {
  it('counts slide-referenced native chart and SmartArt diagram evidence', async () => {
    const zip = new JSZip()
    zip.file('ppt/charts/chart1.xml', '<c:chartSpace />')
    zip.file('ppt/charts/chart2.xml', '<c:chartSpace />')
    zip.file('ppt/charts/_rels/chart1.xml.rels', '<Relationships />')
    zip.file('ppt/diagrams/data1.xml', '<dgm:dataModel />')
    zip.file('ppt/diagrams/layout1.xml', '<dgm:layoutDef />')
    zip.file('ppt/diagrams/quickStyle1.xml', '<dgm:styleDef />')
    zip.file('ppt/slides/slide1.xml', '<p:sld />')
    zip.file('ppt/slides/_rels/slide1.xml.rels', `
      <Relationships>
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml" />
        <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml" />
        <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramData" Target="../diagrams/data1.xml" />
      </Relationships>
    `)

    await expect(inspectOoxmlCoverage(zip)).resolves.toMatchObject({
      nativeChartCount: 1,
      nativeSmartArtCount: 1,
      chartEntries: ['ppt/charts/chart1.xml'],
      smartArtEntries: ['ppt/diagrams/data1.xml'],
      packageChartEntries: ['ppt/charts/chart1.xml', 'ppt/charts/chart2.xml'],
      slideEvidence: [{
        slideIndex: 0,
        chartEntries: ['ppt/charts/chart1.xml'],
        smartArtEntries: ['ppt/diagrams/data1.xml'],
      }],
    })
  })

  it('ignores unreferenced package-level native parts', async () => {
    const zip = new JSZip()
    zip.file('ppt/charts/chart1.xml', '<c:chartSpace />')
    zip.file('ppt/diagrams/data1.xml', '<dgm:dataModel />')
    zip.file('ppt/slides/slide1.xml', '<p:sld />')
    zip.file('ppt/slides/_rels/slide1.xml.rels', '<Relationships />')

    await expect(inspectOoxmlCoverage(zip)).resolves.toMatchObject({
      nativeChartCount: 0,
      nativeSmartArtCount: 0,
      packageChartEntries: ['ppt/charts/chart1.xml'],
      packageSmartArtEntries: ['ppt/diagrams/data1.xml'],
      slideEvidence: [],
    })
  })
})

import { createHash } from 'node:crypto'
import JSZip from 'jszip'
import { buildFeatureFixture, stableZip } from './feature-fixtures.js'

const customShape = `<p:sp><p:nvSpPr><p:cNvPr id="501" name="Authored adjustable curve"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm rot="1200000" flipH="1"><a:off x="914400" y="914400"/><a:ext cx="2743200" cy="1828800"/></a:xfrm>
<a:custGeom><a:avLst><a:gd name="adj" fmla="val 25000"/></a:avLst>
<a:gdLst><a:gd name="controlX" fmla="*/ w adj 100000"/></a:gdLst>
<a:ahLst><a:ahXY gdRefX="adj" minX="0" maxX="100000"><a:pos x="controlX" y="0"/></a:ahXY></a:ahLst>
<a:cxnLst><a:cxn ang="0"><a:pos x="r" y="vc"/></a:cxn></a:cxnLst>
<a:rect l="l" t="t" r="r" b="b"/><a:pathLst><a:path w="100000" h="100000">
<a:moveTo><a:pt x="0" y="0"/></a:moveTo>
<a:cubicBezTo><a:pt x="controlX" y="0"/><a:pt x="100000" y="50000"/><a:pt x="50000" y="100000"/></a:cubicBezTo>
<a:arcTo wR="50000" hR="50000" stAng="5400000" swAng="5400000"/><a:close/>
</a:path></a:pathLst></a:custGeom><a:solidFill><a:srgbClr val="D14A30"/></a:solidFill>
<a:ln w="12700"><a:solidFill><a:srgbClr val="143D59"/></a:solidFill></a:ln></p:spPr></p:sp>`
const presetShape = `<p:sp><p:nvSpPr><p:cNvPr id="502" name="Adjusted right arrow"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm flipV="1"><a:off x="4572000" y="914400"/><a:ext cx="1828800" cy="914400"/></a:xfrm>
<a:prstGeom prst="rightArrow"><a:avLst><a:gd name="adj1" fmla="val 25000"/><a:gd name="adj2" fmla="val 60000"/></a:avLst></a:prstGeom>
<a:solidFill><a:srgbClr val="008060"/></a:solidFill></p:spPr></p:sp>`
const connector = `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="503" name="Bound dashed connector"/>
<p:cNvCxnSpPr><a:stCxn id="501" idx="0"/><a:endCxn id="502" idx="0"/></p:cNvCxnSpPr><p:nvPr/></p:nvCxnSpPr>
<p:spPr><a:xfrm><a:off x="3657600" y="1828800"/><a:ext cx="914400" cy="457200"/></a:xfrm>
<a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln w="25400"><a:solidFill><a:srgbClr val="143D59"/></a:solidFill>
<a:prstDash val="dash"/><a:headEnd type="none"/><a:tailEnd type="triangle"/></a:ln></p:spPr></p:cxnSp>`

export async function buildGeometryFixture() {
  const baseline = await buildFeatureFixture()
  const zip = await JSZip.loadAsync(baseline.buffer)
  const part = 'ppt/slides/slide2.xml'
  const original = await zip.file(part).async('string')
  zip.file(
    part,
    original.replace('</p:spTree>', `${customShape}${presetShape}${connector}</p:spTree>`)
  )
  const buffer = await stableZip(zip)
  return {
    buffer,
    catalogue: {
      id: 'source-authored-drawingml-geometry',
      sha256: createHash('sha256').update(buffer).digest('hex'),
      dimensionsEmu: baseline.catalogue.dimensionsEmu,
      requiredFonts: baseline.catalogue.requiredFonts,
      features: ['geometry.path-control', 'geometry.preset-adjustment', 'geometry.connector'].map(
        (id) => ({ id, sourceParts: [part], qualification: 'unverified' })
      ),
      nativeReference: null,
    },
  }
}

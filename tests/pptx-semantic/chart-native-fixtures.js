import JSZip from 'jszip'
import { buildFeatureFixture } from './feature-fixtures.js'
const C = 'http://schemas.openxmlformats.org/drawingml/2006/chart'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
export const nativeChartPaint = '<c:spPr><a:solidFill><a:srgbClr val="112233"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="445566"/></a:solidFill></a:ln></c:spPr>'
const channel = (name, values, strings = false) => `<c:${name}><c:${strings ? 'strLit' : 'numLit'}><c:ptCount val="${values.length}"/>${values.map((value,index)=>`<c:pt idx="${index}"><c:v>${value}</c:v></c:pt>`).join('')}</c:${strings ? 'strLit' : 'numLit'}></c:${name}>`
export function nativeChartXml(rotation = 20, family = 'bar3DChart') {
  const bubble = family === 'bubbleChart', pie = family === 'pie3DChart'
  const rows = family === 'stockChart' ? [[4,8],[9,12],[2,5],[7,10]] : family.startsWith('surface') ? [[2,8],[12,4]] : [[4,8]]
  const series = rows.map((values,index)=>`<c:ser><c:idx val="${index}"/><c:order val="${index}"/>${nativeChartPaint}${bubble ? channel('xVal',[5,15])+channel('yVal',[5,15])+channel('bubbleSize',[1,4]) : channel('cat',['A','B'],true)+channel('val',values)}</c:ser>`).join('')
  const view = family.includes('3D') ? `<c:view3D><c:rotX val="${rotation}"/><c:rotY val="40"/><c:depthPercent val="150"/><c:hPercent val="80"/><c:rAngAx val="0"/><c:perspective val="60"/></c:view3D>` : ''
  const options = family === 'bar3DChart' ? '<c:barDir val="col"/><c:shape val="box"/>' : ''
  const stock = family === 'stockChart' ? `<c:hiLowLines>${nativeChartPaint}</c:hiLowLines><c:upDownBars><c:gapWidth val="200"/><c:upBars>${nativeChartPaint}</c:upBars><c:downBars>${nativeChartPaint}</c:downBars></c:upDownBars>` : ''
  const ids = pie ? '' : '<c:axId val="1"/><c:axId val="2"/>'
  const axes = pie ? '' : `<c:${bubble ? 'valAx' : 'catAx'}><c:axId val="1"/>${bubble ? '<c:scaling><c:min val="0"/><c:max val="20"/></c:scaling>' : ''}<c:delete val="1"/><c:axPos val="b"/><c:crossAx val="2"/></c:${bubble ? 'valAx' : 'catAx'}><c:valAx><c:axId val="2"/><c:scaling><c:min val="0"/><c:max val="${bubble ? 20 : 10}"/></c:scaling><c:delete val="1"/><c:axPos val="l"/><c:crossAx val="1"/></c:valAx>`
  return `<c:chartSpace xmlns:c="${C}" xmlns:a="${A}"><c:chart>${view}<c:plotArea><c:${family}>${options}${series}${stock}${ids}</c:${family}>${axes}</c:plotArea></c:chart></c:chartSpace>`
}
// Source-bound fixture for integration tests and real import/editor smoke checks.
export async function buildNativeChartFixture(family = 'bar3DChart', rotation = 20) {
  const zip = await JSZip.loadAsync((await buildFeatureFixture()).buffer)
  zip.file('ppt/charts/chart1.xml', nativeChartXml(rotation, family))
  return zip.generateAsync({ type:'nodebuffer' })
}

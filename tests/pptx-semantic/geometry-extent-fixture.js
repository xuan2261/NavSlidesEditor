import { createRequire } from 'node:module'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'
import { authored, geometryStyleFixture } from './geometry-style-fixture.js'

const require = createRequire(import.meta.url)
const { parseXml } = require('../../server/services/pptx-import/ooxml-text-run-xml.js')
const { readGeometrySource } = require('../../server/services/pptx-import/ooxml-geometry-source.js')

// Source-decoder geometry and synthetic linked context, not native/dashboard proof.
export function extentSourceGeometry(width, height) {
  return readGeometrySource(
    parseXml(`<a:custGeom xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
      <a:avLst/><a:gdLst/><a:ahLst/>
      <a:cxnLst><a:cxn ang="0"><a:pos x="w" y="h"/></a:cxn></a:cxnLst>
      <a:rect l="0" t="0" r="w" b="h"/>
      <a:pathLst><a:path w="100" h="80" fill="none" stroke="1">
        <a:moveTo><a:pt x="0" y="0"/></a:moveTo>
        <a:lnTo><a:pt x="100" y="80"/></a:lnTo>
      </a:path></a:pathLst>
    </a:custGeom>`)[0],
    { componentId: 'geometry', width, height }
  )
}

export function extentProjectionFixture(width = 0, height = 762000) {
  const deck = geometryProjectionFixture()
  deck.pptxSemantic = geometryStyleFixture()
  const definition = deck.pptxSemantic.definitions.definition
  const geometry = extentSourceGeometry(width, height)
  definition.components = [
    definition.components[0],
    ...geometry.paths
      .flatMap((path) => path.commands.flatMap((command) => command.points || []))
      .map((point, index) => ({
        id: point.componentId,
        kind: 'control-point',
        locator: { path: [0, 0, index + 1], preconditionHash: 'a'.repeat(64) },
      })),
  ]
  geometry.schemaVersion = 2
  delete geometry.width
  delete geometry.height
  definition.content.geometry = geometry
  deck.pptxSemantic.styles.provider.payload.transform.value.ext = authored({
    cx: authored(width),
    cy: authored(height),
  })
  return deck
}

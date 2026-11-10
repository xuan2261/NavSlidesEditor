// Source-decoder fixture, not dashboard import or native corpus qualification.
import { createRequire } from 'node:module'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'

const require = createRequire(import.meta.url)
const { parseXml } = require('../../server/services/pptx-import/ooxml-text-run-xml.js')
const { readGeometrySource } = require('../../server/services/pptx-import/ooxml-geometry-source.js')

export function arcGeometryFixture() {
  const xml = `<a:custGeom xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
    <a:avLst/><a:gdLst>
      <a:gd name="rx" fmla="*/ w 1 2"/><a:gd name="ry" fmla="*/ h 1 2"/>
    </a:gdLst><a:ahLst/><a:cxnLst/>
    <a:rect l="0" t="0" r="w" b="h"/>
    <a:pathLst>
      <a:path w="100" h="80" fill="none" stroke="1">
        <a:moveTo><a:pt x="100" y="40"/></a:moveTo>
        <a:arcTo wR="rx" hR="ry" stAng="0" swAng="cd4"/>
        <a:arcTo wR="rx" hR="ry" stAng="cd4" swAng="cd4"/>
      </a:path>
      <a:path w="100" h="80" fill="none" stroke="1">
        <a:moveTo><a:pt x="100" y="40"/></a:moveTo>
        <a:arcTo wR="rx" hR="ry" stAng="0" swAng="-5400000"/>
      </a:path>
    </a:pathLst>
  </a:custGeom>`
  return readGeometrySource(parseXml(xml)[0], {
    componentId: 'geometry',
    width: 100,
    height: 80,
  })
}

export function arcProjectionFixture() {
  const deck = geometryProjectionFixture()
  const definition = deck.pptxSemantic.definitions.definition
  definition.content.geometry = arcGeometryFixture()
  const points = definition.content.geometry.paths.flatMap((path) =>
    path.commands.flatMap((command) => command.points || [])
  )
  definition.components = [
    definition.components[0],
    ...points.map((point, index) => ({
      id: point.componentId,
      kind: 'control-point',
      locator: { path: [0, 0, index + 1], preconditionHash: 'a'.repeat(64) },
    })),
  ]
  return deck
}

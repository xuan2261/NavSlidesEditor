import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { cleanup, render } from '@testing-library/react'
import { expect, it } from 'vitest'
import { ShapeRenderer } from './shape-element-renderer'
import { geometryProjectionFixture } from '../../../../../tests/pptx-semantic/geometry-projection-fixture'
import { generatePortableDocument } from '../../../utils/portable-document-rewriter'
const require = createRequire(import.meta.url)
const { PNG } = require('pngjs')
const { shapeSvgString } = require('../../../../../shared/src/shapeUtils')
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
function fixture() {
  const source = PNG.sync.write({ width: 1, height: 1, data: Buffer.from([100, 150, 200, 128]) })
  const derived = PNG.sync.write({ width: 1, height: 1, data: Buffer.from([162, 192, 222, 128]) })
  const geometry = geometryProjectionFixture().pptxSemantic.definitions.definition.content.geometry
  geometry.style = { fill: { blip: { bindingId: 'source', stretch: {} } } }
  geometry.paths[0].fill = 'lighten'
  return { source, derived, element: { id: 'shape-source-shade', type: 'shape', x: 0, y: 0, width: 100, height: 80,
    fill: '#ffffff', stroke: 'none', strokeWidth: 0, pptxGeometry: geometry,
    pptxBlipAsset: { src: '/uploads/source.png', width: 1, height: 1, format: 'png', preconditionHash: sha(source) },
    pptxBlipDerivedAssets: { lighten: { src: '/uploads/lighten.png', width: 1, height: 1, format: 'png',
      byteLength: derived.length, sha256: sha(derived), sourceHash: sha(source), algorithm: 'ooxml-blip-source-rgb-v1' } },
  } }
}
it('passes source-derived assets through the actual editable canvas renderer and HTML shape seam', () => {
  const { element } = fixture(), before = structuredClone(element)
  try {
    const { container } = render(<ShapeRenderer element={element} isSelected={true}/>)
    expect([...container.querySelectorAll('image')].map(image => image.getAttribute('href')))
      .toEqual(['/uploads/source.png', '/uploads/lighten.png'])
    expect(shapeSvgString(element)).toContain('href="/uploads/lighten.png"')
    expect(element).toEqual(before)
  } finally { cleanup() }
})
it('closes the actual generated SVG source and derived texture resources into portable HTML', async () => {
  const { source, derived, element } = fixture()
  const resources = { '/uploads/source.png': source, '/uploads/lighten.png': derived }
  const server = createServer((req, res) => {
    const bytes = resources[req.url]
    res.writeHead(bytes ? 200 : 404, { 'content-type': 'image/png' }); res.end(bytes || '')
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  try {
    const { html, receipt } = await generatePortableDocument(shapeSvgString(element), {
      baseUrl: `http://127.0.0.1:${server.address().port}/`, generatedDocument: true, strictRequiredAssets: true,
    })
    const closed = new DOMParser().parseFromString(html, 'text/html')
    const images = [...closed.querySelectorAll('image')]
    expect(images).toHaveLength(2)
    for (const image of images) expect(image.getAttribute('href')).toMatch(/^data:image\/png;base64,/)
    expect(receipt.resources).toHaveLength(2)
    expect(receipt.offlineCapable).toBe(true)
  } finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
})

import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { DOMParser } from '@xmldom/xmldom'
import { buildGeometryFixture } from './geometry-fixtures.js'

const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'

describe('authored DrawingML component fixtures', () => {
  it('keeps actual guides, curves, adjustment handles and connector identities in source', async () => {
    const { buffer, catalogue } = await buildGeometryFixture()
    const zip = await JSZip.loadAsync(buffer)
    const doc = new DOMParser().parseFromString(
      await zip.file('ppt/slides/slide2.xml').async('string'),
      'application/xml'
    )
    const nodes = (tag) => Array.from(doc.getElementsByTagNameNS(A, tag))
    expect(nodes('custGeom')).toHaveLength(1)
    expect(nodes('cubicBezTo')).toHaveLength(1)
    expect(nodes('arcTo')).toHaveLength(1)
    expect(nodes('ahXY')).toHaveLength(1)
    expect(nodes('gd').some((node) => node.getAttribute('fmla') === '*/ w adj 100000')).toBe(true)
    expect(nodes('stCxn')[0].getAttribute('id')).toBe('501')
    expect(nodes('endCxn')[0].getAttribute('id')).toBe('502')
    expect(catalogue.features.map((row) => row.id)).toEqual([
      'geometry.path-control',
      'geometry.preset-adjustment',
      'geometry.connector',
    ])
    expect(catalogue.nativeReference).toBeNull()
  })

  it('produces identical package bytes from independent generations', async () => {
    const first = await buildGeometryFixture()
    const second = await buildGeometryFixture()
    expect(first.buffer.equals(second.buffer)).toBe(true)
    expect(first.catalogue.sha256).toBe(second.catalogue.sha256)
  })
})

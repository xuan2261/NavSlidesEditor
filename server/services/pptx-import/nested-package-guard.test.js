import { describe, expect, it } from 'vitest'
import guardModule from './nested-package-guard.js'
import rawZipModule from './package-store/raw-zip.js'

const { assertRelationshipsSafe } = guardModule
const { resolveTarget } = rawZipModule

function relationships(target) {
  return Buffer.from(
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    `<Relationship Id="rId1" Type="chart" Target="${target}"/>` +
    '</Relationships>'
  )
}

describe('nested OPC relationship guards', () => {
  it('resolves a single package-root target and permits it in nested relationships', () => {
    expect(resolveTarget('ppt/slides/slide1.xml', '/ppt/charts/chart1.xml'))
      .toBe('ppt/charts/chart1.xml')

    expect(assertRelationshipsSafe(
      relationships('/ppt/charts/chart1.xml'),
      'ppt/slides/_rels/slide1.xml.rels',
      { relationships: 0 },
      { maxRelationships: 1 }
    )).toBeUndefined()
  })

  it.each([
    '//ppt/charts/chart1.xml',
    'https://example.test/chart1.xml',
    'ppt\\charts\\chart1.xml',
    'ppt%2fcharts%2fchart1.xml',
    '../../../charts/chart1.xml',
    '/../../ppt/charts/chart1.xml',
  ])('rejects hostile raw target %s', (target) => {
    expect(() => resolveTarget('ppt/slides/slide1.xml', target))
      .toThrow(/unsafe OPC relationship target/i)
  })

  it('rejects package-root traversal from root relationships', () => {
    expect(() => resolveTarget('/', '../ppt/charts/chart1.xml'))
      .toThrow(/unsafe OPC relationship target/i)

    expect(() => assertRelationshipsSafe(
      relationships('../ppt/charts/chart1.xml'),
      '_rels/.rels',
      { relationships: 0 },
      { maxRelationships: 1 }
    )).toThrow(/relationship target/i)
  })

  it.each([
    '//ppt/charts/chart1.xml',
    'https://example.test/chart1.xml',
    'ppt\\charts\\chart1.xml',
    'ppt%2fcharts%2fchart1.xml',
    '../../../charts/chart1.xml',
    '/../../ppt/charts/chart1.xml',
  ])('rejects hostile internal target %s', (target) => {
    expect(() => assertRelationshipsSafe(
      relationships(target),
      'ppt/slides/_rels/slide1.xml.rels',
      { relationships: 0 },
      { maxRelationships: 1 }
    )).toThrow(/relationship target/i)
  })
})

import { beforeAll, describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { createRequire } from 'node:module'
import { buildFeatureFixture } from './feature-fixtures.js'
import { buildGeometryFixture } from './geometry-fixtures.js'

const require = createRequire(import.meta.url)
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const { PptxImportError } = require('../../server/services/pptx-import/diagnostics')
let buffer
beforeAll(async () => {
  buffer = (await buildFeatureFixture()).buffer
})
const archive = () => JSZip.loadAsync(buffer)
const definitions = (inventory, kind) => inventory.definitions.filter((item) => item.kind === kind)

describe('relationship-bound semantic source inventory', () => {
  it('inventories all 51 authored nodes, chart constituents, rich cells, runs and excluded objects', async () => {
    const result = await buildSemanticInventory(await archive())
    expect(result.slides.map((slide) => slide.partUri)).toEqual([
      'ppt/slides/slide1.xml',
      'ppt/slides/slide2.xml',
    ])
    expect(
      definitions(result, 'diagram-node').filter((node) => node.attributes.type === 'node')
    ).toHaveLength(51)
    expect(definitions(result, 'diagram-connection')).toHaveLength(51)
    expect(definitions(result, 'chart-series')).toHaveLength(1)
    expect(definitions(result, 'table-cell')).toHaveLength(4)
    expect(definitions(result, 'text-run').length).toBeGreaterThan(51)
    expect(definitions(result, 'ole')[0].disposition).toBe('owner-excluded-preserved')
    expect(definitions(result, '3d')[0].disposition).toBe('owner-excluded-preserved')
    expect(result.definitions.every((item) => item.componentLocators.length > 0)).toBe(true)
    expect(result.definitions.some((item) => item.disposition === 'semantically-mapped')).toBe(
      false
    )
    expect(result.issues.some((issue) => issue.code === 'external-relationship-denied')).toBe(true)
  })

  it('keeps nested group identity and paint hierarchy without using names or bounds', async () => {
    const result = await buildSemanticInventory(await archive())
    const shape = (id) =>
      result.definitions.find(
        (item) =>
          item.partUri === 'ppt/slides/slide1.xml' &&
          item.nativeId === id &&
          ['group', 'shape'].includes(item.kind)
      )
    const occurrence = (id) => result.occurrences.find((item) => item.definitionId === shape(id).id)
    expect(occurrence('5').parentOccurrenceId).toBe(occurrence('4').id)
    expect(occurrence('6').parentOccurrenceId).toBe(occurrence('5').id)
    expect(occurrence('4').paintIndex).toBeLessThan(occurrence('5').paintIndex)
    expect(occurrence('5').paintIndex).toBeLessThan(occurrence('6').paintIndex)
  })

  it('inventories custom paths, adjustments and connector bindings', async () => {
    const zip = await JSZip.loadAsync((await buildGeometryFixture()).buffer)
    const result = await buildSemanticInventory(zip)
    expect(definitions(result, 'custom-geometry')).toHaveLength(1)
    expect(definitions(result, 'path-point')).toHaveLength(4)
    expect(definitions(result, 'connector')).toHaveLength(1)
    expect(
      result.definitions.some((item) => item.localName === 'stCxn' && item.attributes.id === '501')
    ).toBe(true)
  })

  it('reuses source definitions but gives shared master content separate slide occurrences', async () => {
    const zip = await archive()
    const part = 'ppt/slideMasters/slideMaster1.xml'
    const source = await zip.file(part).async('string')
    const shape = '<p:sp><p:nvSpPr><p:cNvPr id="900" name="Repeated"/></p:nvSpPr><p:spPr/></p:sp>'
    zip.file(part, source.replace('</p:spTree>', `${shape}</p:spTree>`))
    const result = await buildSemanticInventory(zip)
    const master = result.definitions.filter(
      (item) => item.partUri === part && item.kind === 'shape' && item.nativeId === '900'
    )
    expect(master).toHaveLength(1)
    const occurrences = result.occurrences.filter((item) => item.definitionId === master[0].id)
    expect(new Set(occurrences.map((item) => item.slidePartUri)).size).toBe(2)
    expect(new Set(occurrences.map((item) => item.id)).size).toBe(occurrences.length)
    for (const occurrence of occurrences) {
      const slideObject = result.occurrences.find(
        (item) =>
          item.slidePartUri === occurrence.slidePartUri &&
          result.definitions.find((definition) => definition.id === item.definitionId)?.partUri ===
            item.slidePartUri
      )
      expect(occurrence.paintIndex).toBeLessThan(slideObject.paintIndex)
    }
  })

  it('uses namespace URIs rather than prefixes for stable source identity', async () => {
    const zip = await archive()
    const original = await buildSemanticInventory(zip)
    const part = 'ppt/slides/slide1.xml'
    zip.file(
      part,
      (await zip.file(part).async('string'))
        .replace(/(<\/?)p:/g, '$1alias:')
        .replaceAll('xmlns:p=', 'xmlns:alias=')
    )
    const changed = await buildSemanticInventory(zip)
    expect(changed.definitions.map((item) => [item.id, item.kind])).toEqual(
      original.definitions.map((item) => [item.id, item.kind])
    )
  })

  it('does not read or qualify mapper output, including a dropped mapper node', async () => {
    const zip = await archive()
    const before = await buildSemanticInventory(zip)
    const after = await buildSemanticInventory(zip, { mappedPresentation: { slides: [] } })
    expect(after).toEqual(before)
    expect(
      definitions(after, 'diagram-node').filter((item) => item.attributes.type === 'node')
    ).toHaveLength(51)
  })

  it('resolves XML-escaped relationship IDs and targets by their decoded values', async () => {
    const zip = await archive()
    const slide = 'ppt/slides/slide1.xml'
    const rels = 'ppt/slides/_rels/slide1.xml.rels'
    zip.file(slide, (await zip.file(slide).async('string')).replaceAll('rIdChart', 'rId&#67;hart'))
    zip.file(
      rels,
      (await zip.file(rels).async('string'))
        .replaceAll('rIdChart', 'rId&#67;hart')
        .replace('../charts/chart1.xml', '..&#47;charts&#47;chart1.xml')
    )
    const result = await buildSemanticInventory(zip)
    expect(definitions(result, 'chart-series')).toHaveLength(1)
  })

  it('rejects a foreign relationship element that only mimics the OPC local name', async () => {
    const zip = await archive()
    const rels = 'ppt/slides/_rels/slide1.xml.rels'
    zip.file(
      rels,
      (await zip.file(rels).async('string')).replace(
        '<Relationship Id="rIdChart"',
        '<foreign:Relationship xmlns:foreign="urn:foreign" Id="rIdChart"'
      )
    )
    await expect(buildSemanticInventory(zip)).rejects.toBeInstanceOf(PptxImportError)
  })

  it.each(['ppt/diagrams/data1.xml', 'ppt/slides/_rels/slide1.xml.rels', '[Content_Types].xml'])(
    'rejects missing required source %s atomically',
    async (part) => {
      const zip = await archive()
      zip.remove(part)
      await expect(buildSemanticInventory(zip)).rejects.toBeInstanceOf(PptxImportError)
    }
  )

  it('rejects ambiguous native and relationship IDs', async () => {
    const zip = await archive()
    const part = 'ppt/slides/slide1.xml'
    zip.file(part, (await zip.file(part).async('string')).replace('id="6"', 'id="5"'))
    await expect(buildSemanticInventory(zip)).rejects.toThrow(/ambiguous/i)
    const other = await archive()
    const rel = 'ppt/slides/_rels/slide1.xml.rels'
    other.file(
      rel,
      (await other.file(rel).async('string')).replace('Id="rIdChart"', 'Id="rIdPoster"')
    )
    await expect(buildSemanticInventory(other)).rejects.toThrow(/ambiguous/i)
  })

  it('rejects missing content types and unsafe internal targets', async () => {
    const zip = await archive()
    const types = '[Content_Types].xml'
    zip.file(
      types,
      (await zip.file(types).async('string')).replace(
        /<Override PartName="\/ppt\/media\/feature.wav"[^>]*\/>/,
        ''
      )
    )
    await expect(buildSemanticInventory(zip)).rejects.toThrow(/content type/i)
    const other = await archive()
    const rel = 'ppt/slides/_rels/slide1.xml.rels'
    other.file(
      rel,
      (await other.file(rel).async('string')).replace(
        '../charts/chart1.xml',
        '../../../outside.xml'
      )
    )
    await expect(buildSemanticInventory(other)).rejects.toBeInstanceOf(PptxImportError)
  })

  it('rejects object and deep hierarchy budgets without modifying source', async () => {
    const zip = await archive()
    const before = await zip.file('ppt/slides/slide1.xml').async('string')
    await expect(buildSemanticInventory(zip, { maxObjects: 50 })).rejects.toMatchObject({
      status: 413,
    })
    await expect(buildSemanticInventory(zip, { maxDepth: 3 })).rejects.toMatchObject({
      status: 413,
    })
    expect(await zip.file('ppt/slides/slide1.xml').async('string')).toBe(before)
    await expect(buildSemanticInventory(zip, { maxObjects: 0 })).rejects.toBeInstanceOf(
      PptxImportError
    )
  })

  it('retains unknown extensions with source locations and an explicit unresolved disposition', async () => {
    const zip = await archive()
    const part = 'ppt/slides/slide1.xml'
    zip.file(
      part,
      (await zip.file(part).async('string')).replace(
        '</p:sld>',
        '<p:extLst><p:ext uri="unknown"><u:data xmlns:u="urn:unknown" value="authored"/></p:ext></p:extLst></p:sld>'
      )
    )
    const result = await buildSemanticInventory(zip)
    const unknown = definitions(result, 'unknown-extension').find(
      (item) => item.namespaceUri === 'urn:unknown'
    )
    expect(unknown.partUri).toBe(part)
    expect(unknown.disposition).toBe('requires-mapping')
    expect(result.issues.some((item) => item.definitionId === unknown.id)).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { fixture, partUri } from './smartart-layout-fixture.js'
const require = createRequire(import.meta.url)
const { parseXml } = require('../../server/services/pptx-import/ooxml-text-run-xml')
const { evaluateSmartArtLayout } = require('../../shared/src/pptx-smartart-layout')
const { normalizeSmartArtDocument } = require('../../shared/src/pptx-smartart-document')

describe('source-authored SmartArt layout evaluation', () => {
  it('evaluates source linear constraints and keeps exact graph and declaration identities', async () => {
    const { document, inventory, source } = await fixture()
    const before = JSON.stringify(document)
    const result = evaluateSmartArtLayout(document, { x: -5, y: 7, width: 200, height: 100 })
    expect(result.layoutStatus).toBe('authored-layout-evaluated')
    expect(result.placements.map((p) => [p.modelId, p.x, p.y, p.width, p.height])).toEqual([
      ['1', -5, 7, 40, 50],
      ['2', 45, 7, 40, 50],
      ['3', 95, 7, 40, 50],
    ])
    expect(result.placements[0]).toMatchObject({
      componentId: 'p1',
      styleLabel: 'node1',
      shapeType: 'rect',
    })
    expect(new Set(source.consumed)).toEqual(new Set(inventory.definitions.map((d) => d.id)))
    expect(document.layout.declarations.find((d) => d.type === 'constr').attributes.fact).toBe(0.2)
    expect(result.placements[0].layoutComponentId).toMatch(/#diagram-layout:/)
    expect(Object.isFrozen(result.placements[0])).toBe(true)
    expect(JSON.stringify(document)).toBe(before)
    expect(
      evaluateSmartArtLayout(JSON.parse(before), { x: -5, y: 7, width: 200, height: 100 })
    ).toEqual(result)
    expect(normalizeSmartArtDocument(JSON.parse(before))).toEqual(document)
  })
  it.each([
    ['no metadata', ''],
    ['title only', '<d:title lang="en-US" val="Layout"/>'],
    ['description only', '<d:desc lang="en-US" val="Description"/>'],
    ['title and description', '<d:title lang="en-US" val="Layout"/><d:desc lang="en-US" val="Description"/>'],
  ])('keeps native source paths with %s before layoutNode', async (_label, metadata) => {
    const { document, inventory, source } = await fixture({
      change: (xml) => xml.replace('<d:layoutNode name="root">', `${metadata}<d:layoutNode name="root">`),
    })
    const layoutNode = document.layout.declarations.find((declaration) => declaration.type === 'layoutNode')
    const native = inventory.definitions.find((definition) => definition.localName === 'layoutNode')
    expect(layoutNode.source.path).toEqual(native.componentLocators[0].path)
    expect(layoutNode.source.path).toEqual(metadata ? [0, metadata.includes('<d:title') && metadata.includes('<d:desc') ? 2 : 1] : [0, 0])
    expect(source.consumed).toHaveLength(inventory.definitions.length)
    expect(document.layout.declarations[0].children).toEqual([layoutNode.componentId])
    const componentLocators = new Map(source.components.map((component) => [component.id, component.locator.path]))
    for (const declaration of document.layout.declarations)
      expect(declaration.source.path).toEqual(componentLocators.get(declaration.componentId))
    const forged = JSON.parse(JSON.stringify(document))
    const target = forged.layout.declarations.find((declaration) => declaration.type === 'layoutNode')
    target.source.path = [0, 3]
    expect(() => normalizeSmartArtDocument(forged)).toThrow()
  })
  it.each([
    ['fromR', [160, 110, 60]],
    ['fromT', [0, 60, 120]],
    ['fromB', [50, -10, -70]],
  ])('uses authored direction %s without fitting or clipping', async (direction, starts) => {
    const { document } = await fixture({ direction })
    const result = evaluateSmartArtLayout(document, { x: 0, y: 0, width: 200, height: 100 })
    expect(result.placements.map((p) => (direction === 'fromR' ? p.x : p.y))).toEqual(starts)
  })
  it('keeps 80 deep logical nodes and recomputes source-relative dimensions', async () => {
    const { document } = await fixture({ count: 80 })
    const result = evaluateSmartArtLayout(document, { x: 0, y: 0, width: 100, height: 60 })
    expect(result.placements).toHaveLength(80)
    expect(result.placements[79]).toMatchObject({
      componentId: 'p80',
      modelId: '80',
      x: 2370,
      width: 20,
      height: 30,
    })
    expect(document.connections).toHaveLength(80)
  })
  it('places composite children only from authored position constraints', async () => {
    const { document } = await fixture({
      count: 1,
      algorithm: 'comp',
      change: (x) =>
        x.replace(
          '<d:constr type="sp" val="10"/>',
          '<d:constr type="l" for="ch" val="17"/><d:constr type="t" for="ch" val="-2"/>'
        ),
    })
    expect(
      evaluateSmartArtLayout(document, { x: 5, y: 8, width: 200, height: 100 }).placements[0]
    ).toMatchObject({ x: 22, y: 6, width: 40, height: 50 })
  })
  it.each([
    ['unsupported algorithm', (x) => x.replace('type="lin"', 'type="cycle"')],
    ['unsupported parameter', (x) => x.replace('type="linDir"', 'type="flowDir"')],
    ['unsupported construct', (x) => x.replace('<d:forEach', '<d:choose/><d:forEach')],
    ['unsupported constraint operation', (x) => x.replace('fact="0.2"', 'fact="0.2" op="gte"')],
    ['unknown namespace', (x) => x.replace('<d:shape', '<d:shape xmlns:d="urn:spoof"')],
  ])('rejects %s with exact source location', async (_, change) => {
    await expect(fixture({ change })).rejects.toMatchObject({
      code: 'PPTX_SMARTART_LAYOUT_UNSUPPORTED',
      sourceLocation: { partUri, path: expect.any(Array) },
    })
  })
  it('rejects underconstrained composite placement rather than inventing coordinates', async () => {
    const { document } = await fixture({ algorithm: 'comp' })
    expect(() => evaluateSmartArtLayout(document, { x: 0, y: 0, width: 100, height: 100 })).toThrow(
      /underconstrained/
    )
  })
  it('rejects unresolved references and conflicting constraints atomically', async () => {
    for (const change of [
      (x) => x.replace('refType="w"', 'refType="w" refFor="ch" refForName="missing"'),
      (x) =>
        x.replace(
          '<d:constr type="sp"',
          '<d:constr type="w" for="ch" val="19"/><d:constr type="sp"'
        ),
    ]) {
      const { document } = await fixture({ change })
      const before = JSON.stringify(document)
      expect(() =>
        evaluateSmartArtLayout(document, { x: 0, y: 0, width: 100, height: 100 })
      ).toThrow()
      expect(JSON.stringify(document)).toBe(before)
    }
  })
  it('retains XML declaration order independently of graph order', async () => {
    const { document, xml } = await fixture()
    expect(parseXml(xml)[0].local).toBe('layoutDef')
    expect(document.layout.declarations[0].type).toBe('layoutDef')
    expect(document.layout.declarations[0].attributes.uniqueId).toBe('authored-layout')
    const changed = JSON.parse(JSON.stringify(document))
    changed.layout.source.preconditionHash = 'b'.repeat(64)
    expect(() => normalizeSmartArtDocument(changed)).toThrow(/layout.*source/)
  })
})

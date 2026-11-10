import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { fixture } from './smartart-layout-fixture.js'
const require = createRequire(import.meta.url)
const { evaluateSmartArtLayout } = require('../../shared/src/pptx-smartart-layout')

describe('SmartArt layout graph and reopen contracts', () => {
  it.each([
    '<d:alg type="comp"><d:param type="linDir" val="fromL"/></d:alg>',
    '<d:alg type="lin"><d:param type="linDir" val="fromL"/></d:alg>',
    '<d:alg type="lin"><d:param type="linDir" val="fromL"/><d:param type="linDir" val="fromR"/></d:alg>',
    '',
  ])('rejects unsupported algorithm configuration in an empty iteration: %s', async (algorithm) => {
    const { document } = await fixture({
      change: (x) =>
        x.replace(
          '</d:layoutNode></d:layoutDef>',
          `<d:forEach axis="ch" ptType="asst"><d:layoutNode name="hidden">${algorithm}</d:layoutNode></d:forEach></d:layoutNode></d:layoutDef>`
        ),
    })
    expect(() =>
      evaluateSmartArtLayout(document, { x: 0, y: 0, width: 100, height: 100 })
    ).toThrow()
  })
  it('uses graph sourceOrder rather than XML point order', async () => {
    const { document } = await fixture()
    const changed = JSON.parse(JSON.stringify(document))
    changed.connections[1].sourceId = '0'
    changed.connections[1].sourceOrder = 2
    changed.connections[2].sourceId = '0'
    changed.connections[2].sourceOrder = 1
    const result = evaluateSmartArtLayout(changed, { x: 0, y: 0, width: 100, height: 100 })
    expect(result.placements.map((p) => p.modelId)).toEqual(['1', '3', '2'])
    expect(changed.points.map((p) => p.modelId)).toEqual(['0', '1', '2', '3'])
  })
  it('rejects reference-only layouts and uncovered ordinary nodes', async () => {
    const { document } = await fixture()
    const missing = JSON.parse(JSON.stringify(document))
    delete missing.layout
    expect(() => evaluateSmartArtLayout(missing, { x: 0, y: 0, width: 100, height: 100 })).toThrow(
      /missing authored layout/
    )
    const { document: shallow } = await fixture({
      change: (x) => x.replace('axis="des"', 'axis="ch"'),
    })
    expect(() => evaluateSmartArtLayout(shallow, { x: 0, y: 0, width: 100, height: 100 })).toThrow(
      /unplaced logical node 2/
    )
  })
  it('rejects cyclic constraints rather than using a previous evaluation', async () => {
    const { document } = await fixture({
      change: (x) =>
        x
          .replace(
            'type="w" for="ch" forName="item" refType="w" fact="0.2"',
            'type="w" for="ch" forName="item" refFor="ch" refForName="item" refType="h"'
          )
          .replace(
            'type="h" for="ch" forName="item" refType="h" fact="0.5"',
            'type="h" for="ch" forName="item" refFor="ch" refForName="item" refType="w"'
          ),
      count: 1,
    })
    expect(() => evaluateSmartArtLayout(document, { x: 0, y: 0, width: 100, height: 100 })).toThrow(
      /cyclic\/underconstrained reference/
    )
  })
  it.each([
    (d) => {
      d.layout.declarations[0].children.push(d.layout.rootId)
    },
    (d) => {
      d.layout.declarations[1].attributes.guessedPosition = 4
    },
    (d) => {
      d.layout.declarations[1].source.path = [0, 4]
    },
    (d) => {
      d.points[1].properties.push({ name: 'custSzX', value: 200 })
    },
    (d) => {
      d.connections[0].destinationId = '1000'
    },
  ])('rejects forged/reopened unsupported input without mutation', async (change) => {
    const { document } = await fixture()
    const changed = JSON.parse(JSON.stringify(document))
    change(changed)
    const before = JSON.stringify(changed)
    expect(() => evaluateSmartArtLayout(changed, { x: 0, y: 0, width: 100, height: 100 })).toThrow()
    expect(JSON.stringify(changed)).toBe(before)
  })
})

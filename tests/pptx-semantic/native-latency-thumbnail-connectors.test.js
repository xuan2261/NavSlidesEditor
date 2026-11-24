import { createRequire } from 'node:module'
import { expect, it } from 'vitest'
import { linkedConnectorFixture } from './geometry-style-connector-fixture.js'
const require = createRequire(import.meta.url)
const { normalizePptxSemanticDocument: normalize } = require('../../shared/src/pptx-semantic-document.js')
const { replaceSemanticRecords } = require('../../shared/src/pptx-semantic-records.js')
const { projectionEnvelope, sameEnvelope } = require('../../shared/src/pptx-slide-projection-cache.js')

it('connector reuse excludes unrelated slides but tracks endpoints and validation', () => {
  const input = normalize(linkedConnectorFixture())
  const slide = { id: 's1', elements: [] }
  const before = projectionEnvelope(input, slide)
  const unrelated = normalize(replaceSemanticRecords(input, { instances: {
    i2: { ...input.instances.i2, overrides: { hidden: true } },
  } }))
  expect(sameEnvelope(before, projectionEnvelope(unrelated, slide))).toBe(true)
  const moved = normalize(replaceSemanticRecords(unrelated, { instances: {
    i1: { ...unrelated.instances.i1, localTransform: [1, 0, 0, 1, 10, 20] },
  } }))
  expect(sameEnvelope(before, projectionEnvelope(moved, slide))).toBe(false)
  const detached = normalize(replaceSemanticRecords(input, { instances: {
    connector: { ...input.instances.connector, connectorBindings: { start: null } },
  } }))
  expect(sameEnvelope(before, projectionEnvelope(detached, slide))).toBe(false)
  expect(() => normalize(replaceSemanticRecords(input, { instances: {
    i1: { ...input.instances.i1, slideId: 's2' },
  } }))).toThrow()
})

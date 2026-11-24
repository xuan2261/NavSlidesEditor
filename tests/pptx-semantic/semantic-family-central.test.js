import { beforeAll, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { familyDocumentsFixture } from './family-documents-fixture'
import { importTableFixture, tableFrame, linkedTableShape } from './table-import-fixture'

const require = createRequire(import.meta.url)
const { getProjectionCapabilities } = require('../../shared/src/pptx-projection-capabilities')
const { normalizeSemanticPresentation } = require('../../shared/src/pptx-semantic-presentation')
const copy = (value) => JSON.parse(JSON.stringify(value))
let fixtures
beforeAll(async () => {
  fixtures = await familyDocumentsFixture()
})

describe('central typed family admission and projection', () => {
  it.each(['table', 'chart'])('advertises only active unlocked %s occurrence commands', (kind) => {
    const model = copy(fixtures[kind])
    const definition = Object.values(model.definitions)[0]
    expect(getProjectionCapabilities(model, 'occurrence').operations).toEqual([`${kind}.edit`])
    for (const modify of [
      (value) => {
        value.instances.occurrence.overrides.locked = true
      },
      (value) => {
        value.instances.occurrence.lineage = { tombstone: true }
      },
      (value) => {
        value.definitions[definition.id].content.frameProperties = { locks: { noSelect: true } }
      },
    ]) {
      const blocked = copy(model)
      modify(blocked)
      expect(getProjectionCapabilities(blocked, 'occurrence').operations).toEqual([])
    }
    model.definitions.parent = {
      id: 'parent',
      kind: 'group',
      origin: 'project',
      source: null,
      components: [],
      content: {},
    }
    model.instances.parent = {
      id: 'parent',
      slideId: 's1',
      definitionId: 'parent',
      parentInstanceId: null,
      localTransform: [1, 0, 0, 1, 0, 0],
      paintIndex: 0,
      overrides: { locked: true },
    }
    model.instances.occurrence.parentInstanceId = 'parent'
    expect(getProjectionCapabilities(model, 'occurrence').operations).toEqual([])
  })

  it('rebuilds schema-one table compatibility from source rather than client copies', () => {
    const model = copy(fixtures.table)
    const definition = Object.values(model.definitions)[0]
    const input = {
      pptxSemantic: model,
      slides: [
        {
          id: 's1',
          elements: [
            {
              id: 'table',
              type: 'table',
              pptxInstanceId: 'occurrence',
              data: [['forged']],
              tableDocument: { forged: true },
            },
          ],
        },
      ],
    }
    const before = copy(input)
    const next = normalizeSemanticPresentation(input)
    expect(next.slides[0].elements[0].tableDocument).toEqual(definition.content.tableDocument)
    expect(next.slides[0].elements[0].data).not.toEqual([['forged']])
    expect(input).toEqual(before)
    expect(normalizeSemanticPresentation(copy(next))).toEqual(next)
  })

  it('also derives typed tables beside schema-two linked geometry', async () => {
    const { presentation: input } = await importTableFixture({
      graphic: tableFrame() + linkedTableShape,
      geometryInheritance: true,
    })
    const definition = Object.values(input.pptxSemantic.definitions).find(
      (entry) => entry.kind === 'table'
    )
    const element = input.slides[0].elements.find((entry) => entry.type === 'table')
    element.data = [['forged']]
    element.tableDocument = { forged: true }
    const next = normalizeSemanticPresentation(input)
    expect(next.pptxSemantic.schemaVersion).toBe(2)
    expect(next.slides[0].elements.find((entry) => entry.id === element.id).tableDocument).toEqual(
      definition.content.tableDocument
    )
    const serialized = copy(next)
    expect(normalizeSemanticPresentation(serialized)).toEqual(serialized)
  })
})

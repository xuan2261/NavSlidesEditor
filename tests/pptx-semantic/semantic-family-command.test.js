import { beforeAll, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { familyDocumentsFixture } from './family-documents-fixture'
import { geometryProjectionFixture } from './geometry-projection-fixture'
import { inheritedGeometryStyleFixture } from './geometry-style-fixture'
const require = createRequire(import.meta.url)
const {
  applyPresentationProjectionOperation: apply,
} = require('../../shared/src/pptx-projection-operation')
const {
  normalizePptxSemanticDocument: normalize,
} = require('../../shared/src/pptx-semantic-document')
const { assertSemanticBaseline } = require('../../server/services/pptx-import/semantic-baseline')
const {
  familyRootId,
  materializeFamilyDocument,
  validateFamilyOverride,
} = require('../../shared/src/pptx-family-operations')
const { materializeGeometry } = require('../../shared/src/pptx-geometry-style-resolution')
const copy = (v) => JSON.parse(JSON.stringify(v))
let fixtures
beforeAll(async () => {
  fixtures = await familyDocumentsFixture()
})
function presentation(kind) {
  const document = copy(fixtures[kind])
  return {
    pptxSemantic: document,
    slides: [
      {
        id: 's1',
        elements: [
          {
            id: 'element',
            pptxInstanceId: 'occurrence',
            type: kind === 'equation' ? 'latex' : kind,
          },
        ],
      },
    ],
  }
}
function targetText(node) {
  if (node.type === 't') return node
  for (const child of node.children) {
    const result = targetText(child)
    if (result) return result
  }
}
const commands = {
  chart: () => ({ type: 'chart.title.set', value: 'Local chart title' }),
  diagram: (d) => ({
    type: 'label',
    pointId: d.content.smartArtDocument.points[1].componentId,
    textDocument: { ...copy(d.content.smartArtDocument.points[1].textDocument) },
  }),
  equation: (d) => ({
    type: 'setText',
    componentId: targetText(d.content.ommlDocument.root).componentId,
    text: '42',
  }),
}
describe('typed family journal production authority', () => {
  it.each(['chart', 'diagram', 'equation'])(
    'replays %s commands and source-preserving JSON restore',
    (kind) => {
      const before = presentation(kind),
        d = Object.values(before.pptxSemantic.definitions)[0]
      const family = { chart: 'chart', diagram: 'smartart', equation: 'omml' }[kind]
      const command = commands[kind](d)
      if (kind === 'diagram') command.textDocument.paragraphs[0].runs[0].text = 'Local diagram'
      const op = {
        type: `${family}.edit`,
        instanceId: 'occurrence',
        componentId: familyRootId(d),
        command,
      }
      const next = apply(before, op)
      expect(next.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
      expect(() => assertSemanticBaseline(before, next)).not.toThrow()
      const reopened = normalize(copy(next.pptxSemantic))
      const effective = materializeFamilyDocument(d, reopened.instances.occurrence)
      expect(effective).not.toEqual(
        d.content[
          { chart: 'chartDocument', diagram: 'smartArtDocument', equation: 'ommlDocument' }[kind]
        ]
      )
      const restored = apply(next, { ...op, command: { type: 'reset' } })
      expect(restored.pptxSemantic.instances.occurrence.overrides).toEqual({})
    }
  )
  it.each(['table', 'chart', 'diagram', 'equation'])(
    'rejects arbitrary %s payloads instead of admitting a second document',
    (kind) => {
      const doc = copy(fixtures[kind]),
        d = Object.values(doc.definitions)[0]
      doc.instances.occurrence.overrides.components = {
        [familyRootId(d)]: {
          familyOperations: {
            family: kind,
            commands: [
              {
                type: 'replace',
                payload: d.content,
              },
            ],
          },
        },
      }
      const before = copy(doc)
      expect(() => normalize(doc)).toThrow()
      expect(doc).toEqual(before)
    }
  )
  it('rejects accessor commands without invoking them', () => {
    const p = presentation('chart'),
      d = Object.values(p.pptxSemantic.definitions)[0]
    let calls = 0
    const command = { type: 'chart.title.set' }
    Object.defineProperty(command, 'value', {
      enumerable: true,
      get() {
        calls++
        return 'forged'
      },
    })
    expect(() =>
      apply(p, {
        type: 'chart.edit',
        instanceId: 'occurrence',
        componentId: familyRootId(d),
        command,
      })
    ).toThrow()
    const wrapper = { instanceId: 'occurrence', componentId: familyRootId(d), command: {} }
    Object.defineProperty(wrapper, 'type', {
      enumerable: true,
      get() {
        calls++
        return 'chart.edit'
      },
    })
    expect(() => apply(p, wrapper)).toThrow()
    expect(calls).toBe(0)
  })
})
describe('standalone typed journal contract', () => {
  it.each(['chart', 'diagram', 'equation'])(
    'replays the actual %s reducer without mutating its source',
    (kind) => {
      const model = copy(fixtures[kind]),
        d = Object.values(model.definitions)[0]
      const family = { chart: 'chart', diagram: 'smartart', equation: 'omml' }[kind]
      const command = commands[kind](d)
      const override = { familyOperations: { family, commands: [command] } }
      const before = copy(d)
      expect(validateFamilyOverride(d, familyRootId(d), override)).toBe(true)
      const instance = {
        ...model.instances.occurrence,
        overrides: { components: { [familyRootId(d)]: override } },
      }
      const first = materializeFamilyDocument(d, instance)
      expect(materializeFamilyDocument(d, copy(instance))).toEqual(first)
      expect(d).toEqual(before)
      expect(() => validateFamilyOverride(d, d.components[1].id, override)).toThrow()
      expect(() =>
        validateFamilyOverride(d, familyRootId(d), {
          ...override,
          chartDocument: first,
        })
      ).toThrow()
    }
  )
  it('validates table replay ownership and covered-content JSON retention', () => {
    const model = fixtures.table,
      d = Object.values(model.definitions)[0]
    const table = d.content.tableDocument,
      root = familyRootId(d)
    const commands = [
      { type: 'unmergeCell', cellId: table.rows[0].cells[0].componentId },
      { type: 'mergeCells', startRow: 0, startColumn: 0, rowSpan: 1, columnSpan: 2 },
      { type: 'unmergeCell', cellId: table.rows[0].cells[0].componentId },
    ]
    const instance = copy(model.instances.occurrence)
    instance.overrides.components = { [root]: { familyOperations: { family: 'table', commands } } }
    const effective = materializeFamilyDocument(d, copy(instance))
    expect(effective.rows.map((row) => row.cells.map((cell) => cell.textDocument))).toEqual(
      table.rows.map((row) => row.cells.map((cell) => cell.textDocument))
    )
    const text = copy(table.rows[0].cells[0].textDocument)
    text.paragraphs[0].componentId = table.rows[0].cells[1].textDocument.paragraphs[0].componentId
    expect(() =>
      validateFamilyOverride(d, root, {
        familyOperations: {
          family: 'table',
          commands: [
            {
              type: 'replaceCellText',
              cellId: table.rows[0].cells[0].componentId,
              textDocument: text,
            },
          ],
        },
      })
    ).toThrow()
  })
})
describe('schema 2 whole-effects operation', () => {
  it('retains ordered effects as a single typed program, without source or sibling mutation', () => {
    const p = geometryProjectionFixture()
    p.pptxSemantic = inheritedGeometryStyleFixture()
    const before = copy(p)
    const program = { kind: 'list', effects: [{ kind: 'blur', rad: 0 }] }
    const op = {
      type: 'geometry.edit',
      instanceId: 'i1',
      componentId: 'geometry',
      command: { type: 'effects', effects: program },
    }
    const next = apply(p, op)
    expect(materializeGeometry(next.pptxSemantic, 'i1').style.effects).toEqual(program)
    expect(materializeGeometry(next.pptxSemantic, 'i2')).toEqual(
      materializeGeometry(p.pptxSemantic, 'i2')
    )
    expect(p).toEqual(before)
    expect(
      apply(next, { ...op, command: { type: 'effects', effects: null } }).pptxSemantic.instances.i1
        .overrides.components.geometry.geometryStyle.effects
    ).toEqual({ kind: 'list', effects: [] })
    expect(() => apply(p, { ...op, command: { ...op.command, extra: true } })).toThrow()
  })
})

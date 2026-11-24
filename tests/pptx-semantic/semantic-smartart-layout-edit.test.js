import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { fixture } from './smartart-layout-fixture.js'
import { familyDocumentsFixture } from './family-documents-fixture.js'
const require = createRequire(import.meta.url)
const { applySmartArtOperation: edit } = require('../../shared/src/pptx-smartart-operations')
const { evaluateSmartArtLayout: evaluate } = require('../../shared/src/pptx-smartart-layout')
const { materializeFamilyDocument, validateFamilyOverride } = require('../../shared/src/pptx-family-operations')
const bounds = { x: 0, y: 0, width: 200, height: 100 }
const command = (declaration, attribute, value) => ({ type: 'layout', declarationId: declaration.componentId, attribute, value })

describe('existing authored SmartArt layout edits', () => {
  it('edits exact parameters and constraints through the deterministic authored evaluator', async () => {
    const { document } = await fixture()
    const before = JSON.stringify(document)
    const direction = document.layout.declarations.find((d) => d.type === 'param')
    const width = document.layout.declarations.find((d) => d.type === 'constr' && d.attributes.type === 'w')
    const spacing = document.layout.declarations.find((d) => d.type === 'constr' && d.attributes.type === 'sp')
    const reversed = edit(document, command(direction, 'val', 'fromR'))
    expect(evaluate(reversed, bounds).placements.map((p) => p.x)).toEqual([160, 110, 60])
    const resized = edit(reversed, command(width, 'fact', 0.25))
    const spaced = edit(resized, command(spacing, 'val', 5))
    expect(evaluate(spaced, bounds).placements.map((p) => [p.x, p.width])).toEqual([[150, 50], [95, 50], [40, 50]])
    expect(evaluate(JSON.parse(JSON.stringify(spaced)), bounds)).toEqual(evaluate(spaced, bounds))
    for (const d of spaced.layout.declarations) {
      const original = document.layout.declarations.find((entry) => entry.componentId === d.componentId)
      expect(d.source).toEqual(original.source)
      expect(d.children).toEqual(original.children)
      expect(d.type).toBe(original.type)
    }
    expect(spaced.relationships).toEqual(document.relationships)
    expect(spaced.points).toEqual(document.points)
    expect(Object.isFrozen(spaced.layout.declarations[0])).toBe(true)
    expect(JSON.stringify(document)).toBe(before)
  })

  it('rejects stale IDs, unrelated declarations, identity payloads and invalid typed values atomically', async () => {
    const { document } = await fixture()
    const before = JSON.stringify(document)
    const direction = document.layout.declarations.find((d) => d.type === 'param')
    const width = document.layout.declarations.find((d) => d.type === 'constr' && d.attributes.type === 'w')
    const spacing = document.layout.declarations.find((d) => d.type === 'constr' && d.attributes.type === 'sp')
    for (const invalid of [
      { ...command(direction, 'val', 'fromR'), declarationId: 'stale-declaration' },
      { ...command(direction, 'val', 'fromR'), declarationId: 'p1' },
      command(document.layout.declarations[0], 'val', 2),
      command(direction, 'type', 'horzAlign'), command(direction, 'val', 'clockwise'),
      command(direction, 'fact', 2), command(width, 'val', 20),
      command(width, 'fact', '0.3'), command(width, 'fact', Infinity),
      command(spacing, 'val', -1), command(width, 'fact', -1),
      { ...command(direction, 'val', 'fromR'), source: direction.source },
    ]) expect(() => edit(document, invalid)).toThrow()
    expect(JSON.stringify(document)).toBe(before)
  })

  it('reopens occurrence journals without changing definition or sibling layout and rejects stale replay', async () => {
    const { document } = await fixture()
    const direction = document.layout.declarations.find((d) => d.type === 'param')
    const definition = { id: 'definition', kind: 'diagram', content: { smartArtDocument: document }, components: [] }
    const operation = command(direction, 'val', 'fromR')
    const occurrence = { definitionId: 'definition', overrides: { components: { data: {
      familyOperations: { family: 'smartart', commands: [operation] },
    } } } }
    const sibling = { definitionId: 'definition', overrides: {} }
    const before = JSON.stringify({ definition, sibling })
    expect(validateFamilyOverride(definition, 'data', occurrence.overrides.components.data)).toBe(true)
    const effective = materializeFamilyDocument(definition, occurrence)
    const reopened = JSON.parse(JSON.stringify({ definition, occurrence, sibling }))
    expect(materializeFamilyDocument(reopened.definition, reopened.occurrence)).toEqual(effective)
    expect(materializeFamilyDocument(definition, sibling)).toEqual(document)
    expect(JSON.stringify({ definition, sibling })).toBe(before)
    reopened.occurrence.overrides.components.data.familyOperations.commands[0].declarationId = 'stale'
    expect(() => materializeFamilyDocument(reopened.definition, reopened.occurrence)).toThrow()
  })

  it('uses the production presentation reducer for save/reopen/reset and sibling isolation', async () => {
    const fixtures = await familyDocumentsFixture((zip) => {
      zip.file('ppt/diagrams/layout1.xml', `<d:layoutDef xmlns:d="http://schemas.openxmlformats.org/drawingml/2006/diagram"><d:layoutNode name="root"><d:alg type="lin"><d:param type="linDir" val="fromL"/><d:param type="vertAlign" val="t"/></d:alg><d:constrLst><d:constr type="w" for="ch" refType="w" fact="0.4"/><d:constr type="h" for="ch" refType="h" fact="0.6"/></d:constrLst><d:forEach axis="ch" ptType="node"><d:layoutNode name="item"><d:presOf axis="self"/><d:alg type="comp"/><d:shape type="rect"/></d:layoutNode></d:forEach></d:layoutNode></d:layoutDef>`)
    })
    const semantic = JSON.parse(JSON.stringify(fixtures.diagram))
    const definition = Object.values(semantic.definitions)[0]
    semantic.instances.sibling = { ...semantic.instances.occurrence, id: 'sibling' }
    const source = definition.content.smartArtDocument
    const direction = source.layout.declarations.find((d) => d.type === 'param')
    const { applyPresentationProjectionOperation: apply } = require('../../shared/src/pptx-projection-operation')
    const { normalizeSemanticPresentation } = require('../../shared/src/pptx-semantic-presentation')
    const input = { pptxSemantic: semantic, slides: [{ id: 's1', elements: [
      { id: 'element', type: 'diagram', pptxInstanceId: 'occurrence' },
      { id: 'sibling-element', type: 'diagram', pptxInstanceId: 'sibling' },
    ] }] }
    const before = JSON.stringify(input)
    const operation = { type: 'smartart.edit', instanceId: 'occurrence', componentId: source.componentId,
      command: command(direction, 'val', 'fromR') }
    const next = apply(input, operation)
    const reopened = normalizeSemanticPresentation(JSON.parse(JSON.stringify(next)))
    const effective = materializeFamilyDocument(definition, reopened.pptxSemantic.instances.occurrence)
    expect(evaluate(effective, bounds).placements[0].x).toBe(120)
    expect(next.pptxSemantic.definitions).toEqual(semantic.definitions)
    expect(next.pptxSemantic.instances.sibling).toEqual(semantic.instances.sibling)
    expect(materializeFamilyDocument(definition, reopened.pptxSemantic.instances.sibling)).toEqual(source)
    expect(apply(next, { ...operation, command: { type: 'reset' } }).pptxSemantic.instances.occurrence.overrides).toEqual({})
    expect(() => apply(input, { ...operation, componentId: direction.componentId })).toThrow()
    expect(() => apply(input, { ...operation, instanceId: 'missing' })).toThrow()
    expect(JSON.stringify(input)).toBe(before)
  })
})

import { describe, expect, it } from 'vitest'
import reader from '../../server/services/pptx-import/ooxml-semantic-timing.js'
import xmlReader from '../../server/services/pptx-import/ooxml-text-run-xml.js'
import timing from '../src/pptx-timing-document.js'
import operations from '../src/pptx-timing-operations.js'
import dispatcher from '../src/pptx-projection-operation.js'

const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const hash = 'a'.repeat(64)
const behavior = (id, spid, filter = 'fade') => `<p:animEffect filter="${filter}" transition="in"><p:cBhvr><p:cTn id="${id}" dur="400"/><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl></p:cBhvr></p:animEffect>`
function fixture(extra = '') {
  const xml = `<p:timing xmlns:p="${P}"><p:tnLst><p:par><p:cTn id="1" nodeType="clickEffect"><p:childTnLst>${behavior('2', '7')}${behavior('3', '8')}${extra}</p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`
  const source = { id: 'timing', partUri: 'ppt/slides/slide1.xml', preconditionHash: hash,
    componentLocators: [{ path: [0, 1], preconditionHash: hash }] }
  const timingDocument = reader.readSemanticTiming({ source, node: xmlReader.parseXml(xml)[0], xml })
  const definition = { id: 'timing', kind: 'opaque', source: { partUri: source.partUri,
    preconditionHash: hash, componentLocator: source.componentLocators[0] }, content: {
    timingDocument, targetReferences: timingDocument.targetReferences, excludedObjects: [{ id: 'timing', kind: 'timing' }] }, components: [] }
  const definitions = { timing: definition }
  const instances = {}
  for (const [id, nativeId, partUri] of [['one', '7', source.partUri], ['two', '8', source.partUri], ['other', '7', 'ppt/slideMasters/slideMaster1.xml']]) {
    definitions[id] = { id, kind: 'shape', source: { partUri, nativeId, preconditionHash: hash }, content: {}, components: [] }
    instances[id] = { id, slideId: 'slide', definitionId: id, parentInstanceId: null,
      localTransform: [1, 0, 0, 1, 0, 0], paintIndex: 0, relationshipChain: [], overrides: {} }
  }
  const slide = { id: 'slide', elements: ['one', 'two', 'other'].map(id => ({ id, type: 'shape', pptxInstanceId: id })) }
  const document = { schemaVersion: 1, definitions, instances, styles: {}, fonts: {},
    sourceSlides: [{ sourceId: hash, partUri: source.partUri, preconditionHash: hash, slideId: 'slide' }] }
  return { presentation: { slides: [slide], pptxSemantic: document }, definition, xml }
}
const intent = (presentation, command) => ({ type: 'timing.edit', slideId: 'slide', definitionId: 'timing',
  nodeLocator: structuredClone(timing.resolveSlideTiming(presentation.pptxSemantic, presentation.slides[0]).nodes.find(node => node.sourceTarget.spid === '7').nodeLocator), command })

describe('native source timing authoring', () => {
  it('retains exact source XML, original spids and structural node locators', () => {
    const { presentation, definition, xml } = fixture()
    expect(definition.content.timingDocument.xml).toBe(xml)
    expect(definition.content.timingDocument.tree.children[0].locator.path).toEqual([0, 1, 0])
    const result = timing.resolveSlideTiming(presentation.pptxSemantic, presentation.slides[0])
    expect(result.nodes.map(node => node.targetInstanceId)).toEqual(['one', 'two'])
    expect(result.nodes[0]).toMatchObject({ effect: 'fade-in', durationMs: 400, trigger: 'onClick', sourceTarget: { spid: '7' } })
    expect(result.nodes[0].sourceTarget.locator.preconditionHash).toBe(hash)
  })
  it('fails closed on unsupported behavior without coercing wipe into a slide effect', () => {
    const { presentation } = fixture(behavior('4', '7', 'wipe(right)'))
    const result = timing.resolveSlideTiming(presentation.pptxSemantic, presentation.slides[0])
    expect(result.nodes).toHaveLength(2)
    expect(result.unsupported).toEqual(expect.arrayContaining([expect.objectContaining({ reason: 'unsupported-effect' })]))
  })
  it('never resolves same native id from a different source part or ambiguous occurrences', () => {
    const { presentation } = fixture()
    const document = presentation.pptxSemantic
    delete document.instances.one
    presentation.slides[0].elements = presentation.slides[0].elements.filter(element => element.id !== 'one')
    expect(timing.resolveSlideTiming(document, presentation.slides[0]).nodes[0]).toMatchObject({ status: 'unresolved', reason: 'missing-target' })
    document.instances.one = { ...document.instances.two, id: 'one', definitionId: 'one' }
    document.instances.alias = { ...document.instances.one, id: 'alias' }
    presentation.slides[0].elements.push({ id: 'one', pptxInstanceId: 'one' }, { id: 'alias', pptxInstanceId: 'alias' })
    expect(timing.resolveSlideTiming(document, presentation.slides[0]).nodes[0]).toMatchObject({ status: 'unresolved', reason: 'ambiguous-target' })
  })
  it('retains one source click group rather than requiring a click per behavior', () => {
    const { presentation } = fixture()
    const result = timing.resolveSlideTiming(presentation.pptxSemantic, presentation.slides[0])
    expect(result.nodes.map(node => node.trigger)).toEqual(['onClick', 'withPrevious'])
    expect(result.nodes[0].sourceGroupLocator).toEqual(result.nodes[1].sourceGroupLocator)
  })
  it('routes timing commands through the canonical dispatcher', () => {
    const { presentation } = fixture()
    const result = dispatcher.applyPresentationProjectionOperation(presentation, intent(presentation, { type: 'set-trigger', trigger: 'afterPrevious' }))
    expect(result.slides[0].sourceTiming.overrides[0].trigger).toBe('afterPrevious')
  })
  it('applies target/order/trigger atomically and survives JSON reload without mutating source', () => {
    const { presentation } = fixture()
    const baseline = structuredClone(presentation)
    let result = operations.applyTimingPresentationOperation(presentation, intent(presentation, { type: 'set-target', targetInstanceId: 'two' }))
    result = operations.applyTimingPresentationOperation(result, intent(result, { type: 'set-order', order: 2 }))
    result = operations.applyTimingPresentationOperation(result, intent(result, { type: 'set-trigger', trigger: 'afterPrevious' }))
    result = operations.applyTimingPresentationOperation(result, intent(result, { type: 'set-duration', durationMs: 800 }))
    result = operations.applyTimingPresentationOperation(result, intent(result, { type: 'set-delay', delayMs: 100 }))
    const reopened = JSON.parse(JSON.stringify(result))
    timing.normalizeSourceTiming(reopened.pptxSemantic, reopened.slides[0])
    const node = timing.resolveSlideTiming(reopened.pptxSemantic, reopened.slides[0]).nodes.find(node => node.sourceTarget.spid === '7')
    expect(node).toMatchObject({ targetInstanceId: 'two', order: 2, trigger: 'afterPrevious', durationMs: 800, delayMs: 100 })
    expect(result.pptxSemantic.definitions).toEqual(baseline.pptxSemantic.definitions)
    expect(presentation).toEqual(baseline)
    expect(() => operations.applyTimingPresentationOperation(result, intent(result, { type: 'set-order', order: 0 }))).toThrow()
    expect(result.slides[0].sourceTiming).toEqual(reopened.slides[0].sourceTiming)
  })
  it('rejects forged locators, unknown commands, stale targets, locked targets and source changes', () => {
    const { presentation } = fixture()
    const operation = intent(presentation, { type: 'set-trigger', trigger: 'javascript:alert(1)' })
    expect(() => operations.applyTimingPresentationOperation(presentation, operation)).toThrow()
    operation.command = { type: 'set-order', order: 1 }
    operation.nodeLocator.preconditionHash = 'b'.repeat(64)
    expect(() => operations.applyTimingPresentationOperation(presentation, operation)).toThrow()
    for (const targetInstanceId of ['other', 'missing']) {
      expect(() => operations.applyTimingPresentationOperation(presentation, intent(presentation, { type: 'set-target', targetInstanceId }))).toThrow()
    }
    expect(() => operations.applyTimingPresentationOperation(presentation, intent(presentation, { type: 'set-duration', durationMs: -10 }))).toThrow()
    expect(() => operations.applyTimingPresentationOperation(presentation, intent(presentation, { type: 'set-delay', delayMs: -5 }))).toThrow()
    presentation.slides[0].locked = true
    expect(() => operations.applyTimingPresentationOperation(presentation, intent(presentation, { type: 'set-order', order: 1 }))).toThrow()
  })
  it('validates overlays on reopen and explicitly discloses a removed authored target', () => {
    const { presentation } = fixture()
    const result = operations.applyTimingPresentationOperation(presentation, intent(presentation, { type: 'set-target', targetInstanceId: 'two' }))
    result.pptxSemantic = { ...result.pptxSemantic, instances: { ...result.pptxSemantic.instances,
      two: { ...result.pptxSemantic.instances.two, lineage: { tombstone: true } } } }
    result.slides[0].elements = result.slides[0].elements.filter(element => element.id !== 'two')
    expect(timing.resolveSlideTiming(result.pptxSemantic, result.slides[0]).nodes[0]).toMatchObject({ status: 'unresolved', reason: 'missing-target' })
    const forged = structuredClone(result)
    forged.slides[0].sourceTiming.overrides[0].trigger = 'unsafe'
    expect(() => timing.normalizeSourceTiming(forged.pptxSemantic, forged.slides[0])).toThrow()
  })
  it('rejects a tree node whose locator was moved away from its exact source path', () => {
    const { definition } = fixture()
    definition.content.timingDocument.tree.children[0].locator.path.push(9)
    expect(() => timing.validateTimingDefinition(definition)).toThrow(/locator/)
  })
  it('fails closed when the source event group anchor target is removed', () => {
    const { presentation } = fixture()
    delete presentation.pptxSemantic.instances.one
    presentation.slides[0].elements = presentation.slides[0].elements.filter(element => element.id !== 'one')
    expect(timing.resolveSlideTiming(presentation.pptxSemantic, presentation.slides[0]).nodes[1])
      .toMatchObject({ status: 'unresolved', reason: 'missing-group-target', groupedWithPrevious: true })
  })
  it('pins an existing locked source target when semantic paste introduces an ambiguous clone', () => {
    const { presentation } = fixture()
    const document = presentation.pptxSemantic, slide = presentation.slides[0]
    document.instances.one.overrides.locked = true
    const nextDocument = { ...document, instances: { ...document.instances, clone: { ...document.instances.one, id: 'clone' } } }
    const nextSlide = { ...slide, elements: [...slide.elements, { id: 'clone', pptxInstanceId: 'clone' }] }
    const pinned = timing.pinDuplicatedTimingTargets(document, slide, nextDocument, nextSlide)
    expect(timing.resolveSlideTiming(nextDocument, pinned).nodes[0]).toMatchObject({ status: 'ready', targetInstanceId: 'one' })
    expect(slide.sourceTiming).toBeUndefined()
    expect(() => operations.applyTimingPresentationOperation(presentation, intent(presentation, { type: 'set-target', targetInstanceId: 'two' }))).toThrow(/locked/)
  })
  it('retains an explicit equal trigger as an independent authored schedule', () => {
    const { presentation } = fixture()
    const second = timing.resolveSlideTiming(presentation.pptxSemantic, presentation.slides[0]).nodes[1]
    const result = operations.applyTimingPresentationOperation(presentation, { type: 'timing.edit', slideId: 'slide', definitionId: 'timing',
      nodeLocator: second.nodeLocator, command: { type: 'set-trigger', trigger: 'withPrevious' } })
    expect(timing.resolveSlideTiming(result.pptxSemantic, result.slides[0]).nodes[1])
      .toMatchObject({ trigger: 'withPrevious', triggerOverridden: true, groupedWithPrevious: true })
    const reset = operations.applyTimingPresentationOperation(result, { type: 'timing.edit', slideId: 'slide', definitionId: 'timing',
      nodeLocator: second.nodeLocator, command: { type: 'reset' } })
    expect(reset.slides[0].sourceTiming.overrides).toEqual([])
  })
  it('rejects non-JSON, duplicate, unknown-field and ambiguous-order overlays on reopen', () => {
    const { presentation } = fixture()
    const slide = presentation.slides[0], document = presentation.pptxSemantic
    const nodeLocator = intent(presentation, { type: 'reset' }).nodeLocator
    const entry = { definitionId: 'timing', nodeLocator, trigger: 'onClick' }
    for (const overrides of [[entry, entry], [{ ...entry, unexpected: true }], [{ ...entry, order: 2 }]]) {
      expect(() => timing.normalizeSourceTiming(document, { ...slide, sourceTiming: { schemaVersion: 1, overrides } })).toThrow()
    }
    const accessor = { definitionId: 'timing', nodeLocator, get trigger() { throw new Error('Accessor must not execute') } }
    expect(() => timing.normalizeSourceTiming(document, { ...slide, sourceTiming: { schemaVersion: 1, overrides: [accessor] } })).toThrow(/descriptor/)
  })
  it.each(['spid', 'missing', 'duplicate', 'non-target'])('rejects contradictory immutable target references: %s', alteration => {
    const { definition } = fixture()
    const source = definition.content.timingDocument
    if (alteration === 'spid') source.targetReferences[0].spid = '8'
    if (alteration === 'missing') source.targetReferences.pop()
    if (alteration === 'duplicate') source.targetReferences.push(structuredClone(source.targetReferences[0]))
    if (alteration === 'non-target') source.targetReferences[0].locator = structuredClone(source.tree.locator)
    expect(() => timing.validateTimingDefinition(definition)).toThrow(/target reference/)
  })
  it.each(['set-order', 'reset'])('rejects %s atomically when another affected target is locked', type => {
    let { presentation } = fixture()
    if (type === 'reset') presentation = structuredClone(operations.applyTimingPresentationOperation(presentation, intent(presentation, { type: 'set-order', order: 2 })))
    presentation.pptxSemantic.instances.two.overrides.locked = true
    const snapshot = structuredClone(presentation)
    const command = type === 'reset' ? { type } : { type, order: 2 }
    expect(() => operations.applyTimingPresentationOperation(presentation, intent(presentation, command))).toThrow(/locked/)
    expect(presentation).toEqual(snapshot)
  })
  it('rejects reset when its restored source target is locked', () => {
    let { presentation } = fixture()
    presentation = structuredClone(operations.applyTimingPresentationOperation(presentation, intent(presentation, { type: 'set-target', targetInstanceId: 'two' })))
    presentation.pptxSemantic.instances.one.overrides.locked = true
    expect(() => operations.applyTimingPresentationOperation(presentation, intent(presentation, { type: 'reset' }))).toThrow(/locked/)
  })
  it('matches decoded XML target IDs without rewriting raw source attributes', () => {
    const { definition } = fixture()
    const source = definition.content.timingDocument
    const path = source.targetReferences[0].locator.path.slice(definition.source.componentLocator.path.length)
    const target = path.reduce((node, index) => node.children[index], source.tree)
    target.attributes.find(entry => entry.name === 'spid').value = '&#55;'
    source.xml = source.xml.replace('spid="7"', 'spid="&#55;"')
    const snapshot = structuredClone(source)
    expect(timing.inspectTimingDefinition(definition).nodes[0].sourceTarget.spid).toBe('7')
    expect(source).toEqual(snapshot)
  })
})

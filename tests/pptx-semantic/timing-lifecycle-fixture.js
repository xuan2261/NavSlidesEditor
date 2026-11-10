import semantic from '../../shared/src/pptx-semantic-presentation.js'
import reader from '../../server/services/pptx-import/ooxml-semantic-timing.js'
import xmlReader from '../../server/services/pptx-import/ooxml-text-run-xml.js'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'

// Synthetic lifecycle evidence only; no corpus or native fidelity assertion.
export function timingLifecycleFixture() {
  const presentation = { ...geometryProjectionFixture(), id: 'timing-lifecycle' }
  const document = presentation.pptxSemantic
  const hash = 'a'.repeat(64), partUri = 'ppt/slides/slide7.xml'
  const behavior = (id, spid) => `<p:animEffect filter="fade" transition="in"><p:cBhvr><p:cTn id="${id}" dur="400"/><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl></p:cBhvr></p:animEffect>`
  const xml = `<p:timing xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:tnLst><p:par><p:cTn id="1" nodeType="clickEffect"><p:childTnLst>${behavior('2', '2')}${behavior('3', '3')}</p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`
  const source = { id: 'timing', partUri, preconditionHash: hash,
    componentLocators: [{ path: [0, 1], preconditionHash: hash }] }
  const timingDocument = reader.readSemanticTiming({ source, node: xmlReader.parseXml(xml)[0], xml })
  document.definitions.timing = { id: 'timing', kind: 'opaque',
    source: { partUri, preconditionHash: hash, componentLocator: source.componentLocators[0] },
    content: { timingDocument, targetReferences: timingDocument.targetReferences,
      excludedObjects: [{ id: 'timing', kind: 'timing' }] }, components: [] }
  document.definitions.second = { ...structuredClone(document.definitions.definition), id: 'second',
    source: { ...document.definitions.definition.source, nativeId: '3' } }
  document.sourceSlides = [{ sourceId: hash, partUri, preconditionHash: hash, slideId: 's1' }]
  presentation.slides[1].sourceTimingDefinitionIds = ['timing']
  for (const [index, slide] of presentation.slides.entries()) {
    const id = `second-${index}`
    document.instances[id] = { ...structuredClone(document.instances[`i${index + 1}`]),
      id, definitionId: 'second', paintIndex: 1 }
    slide.elements.push({ ...structuredClone(slide.elements[0]), id, pptxInstanceId: id })
    slide.hasSourceTiming = true
  }
  return structuredClone(semantic.normalizeSemanticPresentation(presentation))
}

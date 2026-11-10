import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import sourceModule from '../../server/services/pptx-import/semantic-source-transitions.js'
import xmlModule from '../../server/services/pptx-import/ooxml-text-run-xml.js'
import contract from '../../shared/src/pptx-transition-document.js'
import presentationModule from '../../shared/src/pptx-semantic-presentation.js'
import htmlModule from '../../shared/src/htmlGenerator.js'
import inventoryModule from '../../server/services/pptx-import/semantic-inventory.js'
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const MC = 'http://schemas.openxmlformats.org/markup-compatibility/2006'
const P14 = 'http://schemas.microsoft.com/office/powerpoint/2010/main'
const hash = 'a'.repeat(64), partUri = 'ppt/slides/slide12.xml'
const wrapper = '<mc:AlternateContent><mc:Choice Requires="p14"><p:transition spd="med" p14:dur="700"><p:fade/></p:transition></mc:Choice><mc:Fallback><p:transition spd="med"><p:fade/></p:transition></mc:Fallback></mc:AlternateContent>'
const clone = value => JSON.parse(JSON.stringify(value))
function fixture(body = wrapper) {
  const xml = `<p:sld xmlns:p="${P}" xmlns:mc="${MC}" xmlns:p14="${P14}"><p:cSld/>${body}</p:sld>`
  const roots = xmlModule.parseXml(xml), root = roots[0].children[1]
  const node = root.local === 'AlternateContent' ? root.children[0].children[0] : root
  const path = root.local === 'AlternateContent' ? [0, 1, 0, 0] : [0, 1]
  const id = `${partUri}#transition:${path.join('.')}`
  const source = { id, kind: 'transition', partUri, preconditionHash: hash, componentLocators: [{ path, preconditionHash: hash }] }
  const semantic = { definitions: {}, sourceSlides: [{ slideId: 's', partUri, sourceId: hash, preconditionHash: hash }] }, dispositions = new Map()
  sourceModule.projectSourceTransitions({ inventory: { definitions: [source] }, parts: new Map([[partUri, { xml, roots }]]),
    nodes: new Map([[id, node]]), semantic, dispositions, fail: (_, detail) => { throw new Error(detail) } })
  return { semantic, definition: semantic.definitions[id], dispositions, xml, roots, node, source }
}
describe('source transition admission and browser projection', () => {
  it('preserves both raw MC branches with exact source components and one effective fade700', () => {
    const { definition, semantic, dispositions } = fixture()
    expect(definition.content.transitionDocument.xml).toBe(wrapper)
    expect(definition.content.transitionDocument.locator).toEqual({ path: [0, 1], preconditionHash: hash })
    expect(definition.components.map(item => item.locator.path)).toEqual([[0, 1, 0, 0], [0, 1, 1, 0]])
    expect(dispositions.size).toBe(1)
    expect(contract.sourceTransition(semantic, { id: 's' })).toEqual({ transition: 'fade', transitionDuration: 700 })
    expect(() => contract.validateTransitionDefinition(definition)).not.toThrow()
  })
  it('accepts arbitrary prefix names only when Requires resolves to the supported URI', () => {
    const { definition } = fixture(wrapper.replaceAll('p14', 'extension').replace('<mc:AlternateContent>', `<mc:AlternateContent xmlns:extension="${P14}">`))
    expect(contract.readTransitionDocument(definition.content.transitionDocument).projection.transitionDuration).toBe(700)
  })
  it('supports a direct exact-duration fade', () => {
    expect(contract.sourceTransition(fixture('<p:transition p14:dur="1200"><p:fade/></p:transition>').semantic, { id: 's' }))
      .toEqual({ transition: 'fade', transitionDuration: 1200 })
  })
  it.each([
    ['unknown extension', value => value.replace('<p:fade/>', '<p14:unknown/>')],
    ['unsupported known effect', value => value.replace('<p:fade/>', '<p:push dir="l"/>')],
    ['sound', value => value.replace('<p:fade/>', '<p:fade/><p:sndAc/>')],
    ['automatic advance', value => value.replace('spd="med"', 'advTm="500"')],
    ['disabled click', value => value.replace('spd="med"', 'advClick="0"')],
    ['unknown attribute', value => value.replace('spd="med"', 'extra="1"')],
    ['duplicate attribute', value => value.replace('spd="med"', 'spd="med" spd="med"')],
    ['namespace forgery', value => value.replace('Requires="p14"', 'xmlns:p14="urn:forged" Requires="p14"')],
    ['empty Requires', value => value.replace('Requires="p14"', 'Requires=""')],
    ['whitespace Requires bound to default namespace', value => value
      .replace('<mc:AlternateContent>', `<mc:AlternateContent xmlns="${P14}">`)
      .replace('Requires="p14"', 'Requires="  "')],
    ['unbound Requires', value => value.replace('Requires="p14"', 'Requires="other"')],
    ['missing fallback', value => value.replace(/<mc:Fallback>[\s\S]*?<\/mc:Fallback>/u, '')],
    ['text', value => value.replace('<p:fade/>', 'text<p:fade/>')],
    ['comment', value => value.replace('<p:fade/>', '<!--opaque--><p:fade/>')],
    ['duration underflow', value => value.replace('dur="700"', 'dur="99"')],
    ['duration overflow', value => value.replace('dur="700"', 'dur="10001"')],
    ['duration coercion', value => value.replace('dur="700"', 'dur="7e2"')],
    ['missing effective duration', value => value.replace(' p14:dur="700"', '')],
    ['unknown fallback', value => value.replace('<p:transition spd="med"><p:fade/>', '<p:transition spd="med"><p:unknown/>')],
  ])('rejects %s without partial admission', (_, mutate) => { expect(() => fixture(mutate(wrapper))).toThrow() })
  it.each([
    ['owner hash', definition => { definition.source.preconditionHash = 'b'.repeat(64) }],
    ['owner path', definition => { definition.source.componentLocator.path = [0, 1, 1, 0] }],
    ['wrapper path', definition => { definition.content.transitionDocument.locator.path = [0, 3] }],
    ['missing branch', definition => { definition.components.pop() }],
    ['extra branch', definition => { definition.components.push(clone(definition.components[0])) }],
    ['branch hash', definition => { definition.components[1].locator.preconditionHash = 'b'.repeat(64) }],
    ['branch kind', definition => { definition.components[1].kind = 'text-run' }],
    ['branch id', definition => { definition.components[1].id = 'forged' }],
    ['project origin', definition => { definition.origin = 'project' }],
    ['wrong kind', definition => { definition.kind = 'shape' }],
  ])('rejects reopened forged %s', (_, mutate) => {
    const definition = clone(fixture().definition); mutate(definition)
    expect(() => contract.validateTransitionDefinition(definition)).toThrow()
  })
  it('reopens JSON provenance and preserves later writable NavSlides transition edits', () => {
    const { definition, semantic } = fixture()
    const document = { schemaVersion: 1, styles: {}, fonts: {}, definitions: semantic.definitions, instances: {}, sourceSlides: semantic.sourceSlides }
    const deck = { id: 'deck', title: 'Transition', theme: 'white', transition: 'slide', resolution: { width: 960, height: 540 },
      pptxSemantic: document, slides: [{ id: 's', elements: [], ...contract.sourceTransition(semantic, { id: 's' }) }] }
    const reopened = presentationModule.normalizeSemanticPresentation(clone(deck))
    expect(reopened.pptxSemantic.definitions[definition.id].content.transitionDocument).toEqual(definition.content.transitionDocument)
    expect(htmlModule.generateRevealHTML(reopened)).toContain('data-transition-duration="700"')
    reopened.slides[0].transition = 'zoom'; reopened.slides[0].transitionDuration = 1200
    const edited = presentationModule.normalizeSemanticPresentation(clone(reopened))
    const html = htmlModule.generateRevealHTML(edited)
    expect(html).toContain('data-transition="zoom"'); expect(html).toContain('data-transition-duration="1200"')
    expect(html).toContain('transition-duration:1200ms;')
    expect(edited.pptxSemantic.definitions[definition.id].content.transitionDocument).toEqual(definition.content.transitionDocument)
  })
  it('preserves full unchanged native package transition branches and precise provenance', async () => {
    const bytes = await readFile('PPTX/Bai_2_2.pptx')
    expect(createHash('sha256').update(bytes).digest('hex')).toBe('e433a1780b7e7b0b69d98cb7e2d7e99b487c47736b89b1649bd311360352d044')
    const zip = await JSZip.loadAsync(bytes)
    const xml = await zip.file(partUri).async('string'), roots = xmlModule.parseXml(xml)
    const node = roots[0].children[2].children[0].children[0]
    const source = { preconditionHash: createHash('sha256').update(xml).digest('hex'), componentLocators: [{ path: [0, 2, 0, 0] }] }
    const document = sourceModule.readSemanticTransition({ source, node, xml, roots })
    expect(contract.readTransitionDocument(document).projection).toEqual({ transition: 'fade', transitionDuration: 700 })
    expect(document.xml).toContain('<mc:Fallback xmlns="">')
    expect(document.xml).toMatch(/<mc:Choice Requires="p14">[\s\S]*p14:dur="700"[\s\S]*<\/mc:Choice>/u)
    expect(document.locator.path).toEqual([0, 2])
    const inventory = await inventoryModule.buildSemanticInventory(zip)
    const transitions = inventory.definitions.filter(item => item.kind === 'transition')
    expect(transitions).toHaveLength(78)
    const semantic = { definitions: {} }, dispositions = new Map()
    const parts = new Map(), nodes = new Map()
    for (const transition of transitions) {
      if (!parts.has(transition.partUri)) {
        const xml = await zip.file(transition.partUri).async('string')
        parts.set(transition.partUri, { xml, roots: xmlModule.parseXml(xml) })
      }
      let node = { children: parts.get(transition.partUri).roots }
      for (const index of transition.componentLocators[0].path) node = node.children[index]
      nodes.set(transition.id, node)
    }
    sourceModule.projectSourceTransitions({ inventory, parts, nodes, semantic, dispositions,
      fail: (_, detail) => { throw new Error(detail) } })
    expect(Object.keys(semantic.definitions)).toHaveLength(39)
    expect(dispositions.size).toBe(78)
    for (const definition of Object.values(semantic.definitions)) {
      expect(definition.components).toHaveLength(2)
      expect(() => contract.validateTransitionDefinition(definition)).not.toThrow()
    }
  })
})

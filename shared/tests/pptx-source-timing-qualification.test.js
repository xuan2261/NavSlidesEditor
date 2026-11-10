import { describe, expect, it } from 'vitest'
import reader from '../../server/services/pptx-import/ooxml-semantic-timing'
import xmlReader from '../../server/services/pptx-import/ooxml-text-run-xml'
import timing from '../src/pptx-timing-document'

const P = 'http://schemas.openxmlformats.org/presentationml/2006/main', hash = 'a'.repeat(64)
const fade = (id, duration = '400') => `<p:animEffect filter="fade" transition="in"><p:cBhvr><p:cTn id="${id}" dur="${duration}"/><p:tgtEl><p:spTgt spid="7"/></p:tgtEl></p:cBhvr></p:animEffect>`
function inspect(content) {
  const xml = `<p:timing xmlns:p="${P}"><p:tnLst>${content}</p:tnLst></p:timing>`
  const source = { id: 'timing', partUri: 'ppt/slides/slide1.xml', preconditionHash: hash,
    componentLocators: [{ path: [0, 1], preconditionHash: hash }] }
  const timingDocument = reader.readSemanticTiming({ source, node: xmlReader.parseXml(xml)[0], xml })
  return timing.inspectTimingDefinition({ id: source.id, kind: 'opaque', source: {
    partUri: source.partUri, preconditionHash: hash, componentLocator: source.componentLocators[0] }, content: { timingDocument } })
}
const group = (content, attributes = '', conditions = '') => `<p:par><p:cTn id="1" ${attributes}>${conditions}<p:childTnLst>${content}</p:childTnLst></p:cTn></p:par>`

describe('native timing qualification is exact rather than a compatibility preset guess', () => {
  it('supports literal source visibility without changing original target identity', () => {
    const set = '<p:set><p:cBhvr><p:cTn id="2" dur="1"/><p:tgtEl><p:spTgt spid="7"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>'
    expect(inspect(group(set)).nodes[0]).toMatchObject({ effect: 'appear', durationMs: 0, sourceTarget: { spid: '7' } })
  })
  it('preserves absolute group delay for simultaneous source behaviors', () => {
    const conditions = '<p:stCondLst><p:cond delay="125"/></p:stCondLst>'
    const result = inspect(group(fade('2') + fade('3'), 'nodeType="clickEffect"', conditions))
    expect(result.nodes.map(node => [node.trigger, node.delayMs, node.groupedWithPrevious])).toEqual([
      ['onClick', 125, false], ['withPrevious', 125, true],
    ])
  })
  it('keeps unsupported predecessor groups as barriers until a new source click boundary', () => {
    const unsupported = group(fade('2').replace('filter="fade"', 'filter="wipe(right)"'), 'nodeType="clickEffect"')
    const dependent = group(fade('4'), 'nodeType="afterEffect"').replace('id="1"', 'id="3"')
    const independent = group(fade('6'), 'nodeType="clickEffect"').replace('id="1"', 'id="5"')
    const result = inspect(unsupported + dependent + independent)
    expect(result.nodes.map(node => node.nativeTimeId)).toEqual(['6'])
    expect(result.unsupported).toEqual(expect.arrayContaining([expect.objectContaining({ reason: 'unsupported-predecessor' })]))
  })
  it('rejects ancestor activation delay crossing a later click boundary', () => {
    const nested = group(fade('3'), 'nodeType="clickEffect"').replace('id="1"', 'id="2"')
    const result = inspect(group(nested, 'dur="indefinite"', '<p:stCondLst><p:cond delay="125"/></p:stCondLst>'))
    expect(result.nodes).toEqual([])
    expect(result.unsupported[0].reason).toBe('unsupported-timing-context')
  })
  it.each(['indefinite', '', 'bad', '9007199254740992', '2'])('does not coerce visibility duration %s to instantaneous', duration => {
    const set = `<p:set><p:cBhvr><p:cTn id="2" dur="${duration}"/><p:tgtEl><p:spTgt spid="7"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>`
    expect(inspect(group(set)).nodes).toEqual([])
  })
  it.each([
    ['finite ancestor duration', group(fade('2'), 'dur="200"')],
    ['sequential container', `<p:seq><p:cTn id="1"><p:childTnLst>${fade('2')}</p:childTnLst></p:cTn></p:seq>`],
    ['trigger target dependency', group(fade('2'), '', '<p:stCondLst><p:cond evt="onBegin"><p:tn val="99"/></p:cond></p:stCondLst>')],
    ['repeat behavior', group(fade('2'), 'repeatCount="2000"')],
    ['missing fade duration', group(fade('2', 'indefinite'))],
    ['condition target extensions', group(fade('2'), '', '<p:stCondLst><p:cond evt="onClick"><p:tgtEl><p:sldTgt unsupported="1"/></p:tgtEl></p:cond></p:stCondLst>')],
    ['multiple condition targets', group(fade('2'), '', '<p:stCondLst><p:cond evt="onClick"><p:tgtEl><p:sldTgt/></p:tgtEl><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:stCondLst>')],
    ['nested effect groups', group('<p:par><p:cTn id="3" nodeType="afterEffect"><p:childTnLst>' + fade('2') + '</p:childTnLst></p:cTn></p:par>', 'nodeType="clickEffect"')],
    ['duplicate native time id', group(fade('1'))],
    ['literal filter mismatch', group(fade('2').replace('filter="fade"', 'filter="fadeSomething"'))],
  ])('discloses and never executes %s', (_label, source) => {
    const result = inspect(source)
    expect(result.nodes).toHaveLength(0)
    expect(result.unsupported.length).toBeGreaterThan(0)
    expect(result.unsupported.every(row => row.effect === undefined && row.targetInstanceId === undefined)).toBe(true)
  })
})

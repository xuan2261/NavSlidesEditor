import { createSemanticMediaFixture } from './semantic-media-fixture.js'

const SLIDE = 'ppt/slides/slide1.xml'

// XML-authored source fixture only: this is not a native Office fidelity or
// browser playback qualification clip. The base fixture supplies a real WAV.
export async function createSemanticMediaTimingFixture() {
  const zip = await createSemanticMediaFixture({ durationSeconds: 4, trimEnd: '3500' })
  const source = await zip.file(SLIDE).async('string')
  const picture = source.match(/<p:pic>[\s\S]*?<\/p:pic>/)[0]
  const sibling = picture
    .replace('id="2"', 'id="3"')
    .replace('name="Authored audio"', 'name="Sibling audio"')
    .replace('x="914400"', 'x="2743200"')
  const behavior = (id, target, effect = 'in') =>
    `<p:animEffect filter="fade" transition="${effect}"><p:cBhvr><p:cTn id="${id}" dur="400"/><p:tgtEl><p:spTgt spid="${target}"/></p:tgtEl></p:cBhvr></p:animEffect>`
  const group = (id, trigger, content) =>
    `<p:par><p:cTn id="${id}" nodeType="${trigger}"><p:childTnLst>${content}</p:childTnLst></p:cTn></p:par>`
  const excludedCommand = '<p:cmd type="call" cmd="javascript:alert(1)"><p:cBhvr><p:cTn id="31" dur="0"/><p:tgtEl><p:spTgt spid="2"/></p:tgtEl></p:cBhvr></p:cmd>'
  const timing = `<p:timing><p:tnLst>${[
    group('10', 'clickEffect', behavior('11', '2')),
    group('20', 'afterEffect', behavior('21', '3', 'out')),
    group('30', 'clickEffect', excludedCommand),
  ].join('')}</p:tnLst></p:timing>`
  zip.file(SLIDE, source
    .replace('</p:spTree>', `${sibling}</p:spTree>`)
    .replace('</p:sld>', `${timing}</p:sld>`))
  return zip
}

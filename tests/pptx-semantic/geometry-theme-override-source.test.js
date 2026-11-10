import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import JSZip from 'jszip'
const require = createRequire(import.meta.url)
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const { buildGeometryStyleSources } = require('../../server/services/pptx-import/ooxml-geometry-style-source')
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
const slots = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink']
const palette = (rgb = 'ABCDEF') => `<a:clrScheme name="Native">${slots.map((s) => `<a:${s}><a:srgbClr val="${rgb}"/></a:${s}>`).join('')}</a:clrScheme>`
const paint = '<a:solidFill><a:schemeClr val="phClr"><a:tint val="25000"/></a:schemeClr></a:solidFill>'
const format = (entries = paint) => `<a:fmtScheme name="Native"><a:fillStyleLst>${entries}</a:fillStyleLst><a:lnStyleLst/><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme>`
const override = (categories = palette()) => `<a:themeOverride xmlns:a="${A}">${categories}</a:themeOverride>`
const edge = (type, target, id = type, extra = '') => `<Relationship Id="${id}" Type="${R}/${type}" Target="${target}" ${extra}/>`
const rels = (entries) => `<Relationships xmlns="${REL}">${entries}</Relationships>`
const owners = { slide: 'ppt/slides/one.xml', layout: 'ppt/slideLayouts/layout.xml', master: 'ppt/slideMasters/master.xml', theme: 'ppt/theme/base.xml' }
const relPart = (uri) => uri.replace(/([^/]+)$/, '_rels/$1.rels')
async function fixture(index = 1) {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>')
  zip.file('ppt/presentation.xml', `<p:presentation xmlns:p="${P}" xmlns:r="${R}"><p:sldIdLst><p:sldId id="256" r:id="slide"/></p:sldIdLst></p:presentation>`)
  zip.file('ppt/_rels/presentation.xml.rels', rels(edge('slide', 'slides/one.xml')))
  const shape = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Native"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:style><a:fillRef idx="${index}"><a:schemeClr val="accent1"/></a:fillRef></p:style></p:sp>`
  for (const [owner, root] of [['slide', 'sld'], ['layout', 'sldLayout'], ['master', 'sldMaster']]) {
    zip.file(owners[owner], `<p:${root} xmlns:p="${P}" xmlns:a="${A}"><p:cSld><p:spTree>${owner === 'slide' ? shape : ''}</p:spTree></p:cSld></p:${root}>`)
  }
  zip.file(relPart(owners.slide), rels(edge('slideLayout', '../slideLayouts/layout.xml')))
  zip.file(relPart(owners.layout), rels(edge('slideMaster', '../slideMasters/master.xml')))
  zip.file(relPart(owners.master), rels(edge('theme', '../theme/base.xml')))
  zip.file(owners.theme, `<a:theme xmlns:a="${A}"><a:themeElements>${palette('112233')}${format()}</a:themeElements></a:theme>`)
  return zip
}
async function bind(zip, owner, target = 'native.xml', xml = override(), relationship = edge('themeOverride', `../theme/${target}`)) {
  const uri = relPart(owners[owner]), existing = zip.file(uri) ? await zip.file(uri).async('string') : rels('')
  zip.file(uri, existing.replace('</Relationships>', `${relationship}</Relationships>`))
  zip.file(`ppt/theme/${target}`, xml)
}
const build = async (zip) => buildGeometryStyleSources(zip, await buildSemanticInventory(zip))
const contexts = (result) => Object.values(result.styles).filter((s) => s.kind === 'geometry-context')
const nativeRecords = (result) => Object.values(result.styles).filter((s) => s.kind === 'native-theme-override')
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const packageHashes = async (zip) => Object.fromEntries(await Promise.all(Object.keys(zip.files).filter((u) => !zip.files[u].dir).map(async (u) => [u, hash(await zip.file(u).async('nodebuffer'))])))
describe('relationship-bound native geometry theme override sources', () => {
  it('emits actual root/category/relationship locators without mutating source bytes', async () => {
    const zip = await fixture()
    await bind(zip, 'slide')
    const before = await packageHashes(zip), result = await build(zip), native = nativeRecords(result)[0], context = contexts(result)[0].payload
    expect(native).toMatchObject({ kind: 'native-theme-override', origin: 'source', source: { partUri: 'ppt/theme/native.xml', preconditionHash: before['ppt/theme/native.xml'], componentLocator: { path: [0] } } })
    expect(native.payload.colorScheme.source.componentLocator.path).toEqual([0, 0])
    expect(Object.keys(native.payload.colorScheme.value.colors)).toEqual(slots)
    expect(native.payload.colorScheme.value.colors.accent1.value).toEqual({ kind: 'srgb', value: 'ABCDEF' })
    expect(context.themeId).toBe(`${owners.theme}:geometry-theme`)
    expect(context.themeOverrideBindings).toEqual([{ styleId: 'ppt/theme/native.xml:geometry-theme-override', edge: { fromPartUri: owners.slide, toPartUri: 'ppt/theme/native.xml', relationshipId: 'themeOverride', type: `${R}/themeOverride`, source: { partUri: relPart(owners.slide), preconditionHash: before[relPart(owners.slide)], componentLocator: { path: [0, 1], preconditionHash: before[relPart(owners.slide)] } } } }])
    expect(context.matrixBindings.fillRef).not.toHaveProperty('overrideStyleId')
    expect(await packageHashes(zip)).toEqual(before)
  })
  it('shares one record through distinct ordered slide/layout edges', async () => {
    const zip = await fixture()
    await bind(zip, 'layout')
    await bind(zip, 'slide')
    const result = await build(zip), bindings = contexts(result)[0].payload.themeOverrideBindings
    expect(nativeRecords(result)).toHaveLength(1)
    expect(bindings.map((b) => b.edge.fromPartUri)).toEqual([owners.slide, owners.layout])
    expect(bindings[0].styleId).toBe(bindings[1].styleId)
  })
  it('selects format independently of palette and preserves transformed phClr declarations', async () => {
    const zip = await fixture()
    await bind(zip, 'slide', 'slide.xml', override(palette()))
    await bind(zip, 'layout', 'layout.xml', override(format()))
    const result = await build(zip), context = contexts(result)[0].payload, binding = context.matrixBindings.fillRef
    expect(binding).toMatchObject({ themeId: `${owners.theme}:geometry-theme`, overrideStyleId: 'ppt/theme/layout.xml:geometry-theme-override', source: { partUri: 'ppt/theme/layout.xml', componentLocator: { path: [0, 0, 0, 0] } } })
    const entry = result.styles[binding.overrideStyleId].payload.formatScheme.value.fillStyles[0]
    expect(entry.value.color.value).toMatchObject({ kind: 'scheme', value: 'phClr', transforms: [{ value: { kind: 'tint', value: 25000 } }] })
    expect(result.styles['ppt/theme/slide.xml:geometry-theme-override'].payload).not.toHaveProperty('formatScheme')
  })
  it('uses the slide whole-format replacement rather than filling holes from layout/base', async () => {
    const zip = await fixture()
    await bind(zip, 'layout', 'layout.xml', override(format()))
    await bind(zip, 'slide', 'slide.xml', override(format('')))
    await expect(build(zip)).rejects.toThrow('selected unsupported/missing style matrix entry')
  })
  it.each([
    ['backgroundFillStyles', 'fillRef', 1001, '<a:bgFillStyleLst>', '</a:bgFillStyleLst>', paint],
    ['lineStyles', 'lnRef', 1, '<a:lnStyleLst>', '</a:lnStyleLst>', `<a:ln w="9525">${paint}</a:ln>`],
    ['effectStyles', 'effectRef', 1, '<a:effectStyleLst>', '</a:effectStyleLst>', '<a:effectStyle><a:effectLst/></a:effectStyle>'],
  ])('binds native %s through the genuine selected matrix entry', async (list, ref, index, open, close, entry) => {
    const zip = await fixture(index)
    if (ref !== 'fillRef') zip.file(owners.slide, (await zip.file(owners.slide).async('string')).replaceAll('fillRef', ref))
    const xml = format().replace(`${open.slice(0, -1)}/>`, `${open}${entry}${close}`)
    await bind(zip, 'slide', 'native.xml', override(xml))
    const binding = contexts(await build(zip))[0].payload.matrixBindings[ref]
    expect(binding).toMatchObject({ list, entryIndex: 0, overrideStyleId: 'ppt/theme/native.xml:geometry-theme-override', source: { partUri: 'ppt/theme/native.xml' } })
  })
  it('rejects a selected unsupported native entry even when the base entry is supported', async () => {
    const zip = await fixture()
    await bind(zip, 'slide', 'native.xml', override(format('<a:blipFill/>')))
    await expect(build(zip)).rejects.toThrow('selected unsupported/missing style matrix entry')
  })
  it.each([0, 1000])('keeps sentinel %i free of provider/source fields', async (index) => {
    const zip = await fixture(index)
    await bind(zip, 'slide', 'native.xml', override(format('')))
    const binding = contexts(await build(zip))[0].payload.matrixBindings.fillRef
    expect(binding.entryIndex).toBeNull()
    expect(binding).not.toHaveProperty('overrideStyleId')
    expect(binding).not.toHaveProperty('source')
  })
  it('retains unused unsupported entries and font package identity without interpreting fonts', async () => {
    const zip = await fixture()
    await bind(zip, 'slide', 'native.xml', override(format(paint + '<a:blipFill/>') + '<a:fontScheme name="Preserved"><a:majorFont/><a:minorFont/></a:fontScheme>'))
    const before = await packageHashes(zip), result = await build(zip)
    expect(nativeRecords(result)[0].payload.formatScheme.value.fillStyles[1].value.kind).toBe('unsupported')
    expect(nativeRecords(result)[0].payload.fontScheme).toMatchObject({ source: { partUri: 'ppt/theme/native.xml', componentLocator: { path: [0, 1] } }, value: { kind: 'preserved' } })
    expect(await packageHashes(zip)).toEqual(before)
  })
  it('keeps no-override output identical and omits optional fields', async () => {
    const zip = await fixture(), first = await build(zip)
    expect(await build(zip)).toEqual(first)
    expect(nativeRecords(first)).toEqual([])
    expect(contexts(first)[0].payload).not.toHaveProperty('themeOverrideBindings')
    expect(contexts(first)[0].payload.matrixBindings.fillRef).not.toHaveProperty('overrideStyleId')
  })
  it('retains font-only override identity with inherited matrices and palette', async () => {
    const zip = await fixture()
    await bind(zip, 'slide', 'font.xml', override('<a:fontScheme name="Native"><a:majorFont/><a:minorFont/></a:fontScheme>'))
    const result = await build(zip), payload = nativeRecords(result)[0].payload
    expect(Object.keys(payload)).toEqual(['fontScheme'])
    expect(payload.fontScheme.value).toEqual({ kind: 'preserved' })
    expect(contexts(result)[0].payload.matrixBindings.fillRef.source.partUri).toBe(owners.theme)
    expect(contexts(result)[0].payload.matrixBindings.fillRef).not.toHaveProperty('overrideStyleId')
  })
  it.each([
    ['duplicate color category', override(palette() + palette())],
    ['duplicate format category', override(format() + format())],
    ['duplicate font category', override('<a:fontScheme/><a:fontScheme/>')],
    ['missing native slots', override('<a:clrScheme name="Bad"><a:accent1><a:srgbClr val="123456"/></a:accent1></a:clrScheme>')],
    ['duplicate native slot', override(palette().replace('</a:clrScheme>', '<a:accent1><a:srgbClr val="123456"/></a:accent1></a:clrScheme>'))],
    ['wrong root', override().replaceAll('themeOverride', 'theme')],
    ['wrong namespace', override().replace(A, 'urn:wrong')],
    ['unknown category', override('<a:unknown/>')],
    ['malformed category attribute', override(palette().replace('name="Native"', 'bogus="Native"'))],
    ['duplicate matrix list', override(format().replace('</a:fmtScheme>', '<a:fillStyleLst/></a:fmtScheme>'))],
    ['foreign matrix list', override(format().replace('<a:lnStyleLst/>', '<x:lnStyleLst xmlns:x="urn:wrong"/>'))],
  ])('rejects %s', async (_, xml) => {
    const zip = await fixture(0)
    await bind(zip, 'slide', 'native.xml', xml)
    await expect(build(zip)).rejects.toThrow()
  })
  it.each([
    ['external', 'slide', edge('themeOverride', '../theme/native.xml', 'override', 'TargetMode="External"')],
    ['ambiguous', 'slide', edge('themeOverride', '../theme/native.xml', 'a') + edge('themeOverride', '../theme/native.xml', 'b')],
    ['duplicate relationship id', 'slide', edge('themeOverride', '../theme/native.xml', 'slideLayout')],
    ['wrong relationship type', 'slide', '<Relationship Id="override" Type="urn:wrong/themeOverride" Target="../theme/native.xml"/>'],
    ['wrong relationship namespace', 'slide', `<x:Relationship xmlns:x="urn:wrong" Id="override" Type="${R}/themeOverride" Target="../theme/native.xml"/>`],
    ['malformed relationship attribute', 'slide', edge('themeOverride', '../theme/native.xml', 'override', 'bogus="1"')],
    ['nested relationship', 'slide', `<Container>${edge('themeOverride', '../theme/native.xml')}</Container>`],
    ['unsupported master owner', 'master', edge('themeOverride', '../theme/native.xml')],
    ['unsupported base-theme owner', 'theme', edge('themeOverride', 'native.xml')],
    ['host cycle', 'slide', edge('themeOverride', 'one.xml')],
    ['base-theme cycle', 'slide', edge('themeOverride', '../theme/base.xml')],
  ])('rejects %s relationship', async (_, owner, relationship) => {
    const zip = await fixture(0)
    await bind(zip, owner, 'native.xml', override(), relationship)
    await expect(build(zip)).rejects.toThrow()
  })
  it('rejects a changed override hash after inventory capture', async () => {
    const zip = await fixture()
    await bind(zip, 'slide')
    const inventory = await buildSemanticInventory(zip)
    zip.file('ppt/theme/native.xml', override(palette('445566')))
    await expect(buildGeometryStyleSources(zip, inventory)).rejects.toThrow('changed source hash')
  })
})

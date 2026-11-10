import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { familyFixture, slidePart } from './semantic-family-adapter-fixture'
import { stableZip } from './feature-fixtures'
const require = createRequire(import.meta.url)
const { validateFamilyDocuments } = require('../../shared/src/pptx-semantic-family-documents')
const adapters = [
  ['chart', '8', 'chartDocument', 'projectChartFrame'],
  ['smartart', '9', 'smartArtDocument', 'projectSmartArtFrame'],
  ['omml', '10', 'ommlDocument', 'projectOmmlShape'],
]
const load = (family, name) =>
  require(`../../server/services/pptx-import/semantic-${family}-adapter`)[name]
const definition = (input, result) => ({
  id: input.source.id,
  kind: result.kind,
  source: {
    partUri: input.source.partUri,
    nativeId: input.source.nativeId,
    preconditionHash: input.source.preconditionHash,
    componentLocator: input.source.componentLocators[0],
  },
  content: result.content,
  components: result.components,
})
describe('production typed family adapters', () => {
  it.each(adapters)(
    'admits %s with exact root bindings and immutable source',
    async (family, id, field, name) => {
      const input = await familyFixture(id),
        before = JSON.stringify(input.inventory)
      const bytes = await stableZip(input.zip)
      const result = await load(family, name)(input)
      expect(result.content[field]).toBeDefined()
      expect(result.mappedDefinitionIds).toContain(input.source.id)
      expect(new Set(result.mappedDefinitionIds).size).toBe(result.mappedDefinitionIds.length)
      expect(() => validateFamilyDocuments(definition(input, result))).not.toThrow()
      expect(result.sourceTransform.ext).toEqual(result.extent)
      expect(result.localTransform).toHaveLength(6)
      expect(JSON.stringify(input.inventory)).toBe(before)
      expect(await stableZip(input.zip)).toEqual(bytes)
      expect(await load(family, name)(input)).toEqual(result)
      for (const c of result.components) {
        const record = input.inventory.definitions.find((d) => d.id === c.id)
        if (record) {
          expect(c.partUri ?? input.source.partUri).toBe(record.partUri)
          expect(c.locator).toEqual(record.componentLocators[0])
        }
      }
    }
  )
  it.each(adapters)(
    'rejects %s stale XML and forged root locator',
    async (family, id, _field, name) => {
      const input = await familyFixture(id),
        project = load(family, name)
      await expect(
        Promise.resolve().then(() => project({ ...input, xml: input.xml + ' ' }))
      ).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED' })
      const source = {
        ...input.source,
        componentLocators: [{ ...input.source.componentLocators[0], path: [0] }],
      }
      await expect(
        Promise.resolve().then(() => project({ ...input, source }))
      ).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED' })
    }
  )
  it.each(adapters)(
    'rejects unrepresented %s owner declarations',
    async (family, id, _field, name) => {
      const input = await familyFixture(id, async (zip) => {
        const xml = await zip.file(slidePart).async('string')
        zip.file(slidePart, xml.replace(`id="${id}" name=`, `id="${id}" unsupported="1" name=`))
      })
      await expect(Promise.resolve().then(() => load(family, name)(input))).rejects.toMatchObject({
        code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
      })
    }
  )
  it('retains genuine creation identity and rejects forged metadata component locators', async () => {
    const input = await familyFixture('8', async (zip) => {
      const xml = await zip.file(slidePart).async('string')
      zip.file(
        slidePart,
        xml.replace(
          '<p:cNvPr id="8" name="Native chart"/>',
          '<p:cNvPr id="8" name="Native chart"><a:extLst><a:ext uri="{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}"><a16:creationId xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main" id="{11111111-2222-3333-4444-555555555555}"/></a:ext></a:extLst></p:cNvPr>'
        )
      )
    })
    const project = load('chart', 'projectChartFrame')
    const result = await project(input)
    const creation = input.components.find((c) => c.localName === 'creationId')
    expect(result.components.find((c) => c.id === creation.id).locator).toEqual(
      creation.componentLocators[0]
    )
    for (const field of ['locator', 'part', 'hash', 'kind']) {
      const forged = {
        ...creation,
        componentLocators: creation.componentLocators.map((l) => ({ ...l })),
      }
      if (field === 'locator') forged.componentLocators[0].path = [0]
      if (field === 'part') forged.partUri = 'ppt/slides/slide2.xml'
      if (field === 'hash') forged.preconditionHash = 'a'.repeat(64)
      if (field === 'kind') forged.kind = 'chart-series'
      await expect(
        project({
          ...input,
          components: input.components.map((c) => (c.id === creation.id ? forged : c)),
        })
      ).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED' })
    }
  })
  it('retains chart source channels and cross-part kinds without a fabricated preview', async () => {
    const input = await familyFixture(),
      result = await load('chart', 'projectChartFrame')(input)
    expect(
      result.content.chartDocument.plots[0].series[0].data.val.cache.points.map((p) => p.value)
    ).toEqual([7, 11])
    expect(result.components.filter((c) => c.kind === 'series')).toHaveLength(1)
    expect(result.components.some((c) => c.kind === 'point')).toBe(true)
    expect(result.components.every((c) => c.partUri)).toBe(true)
    expect(result.compatibility).toEqual({ type: 'chart' })
  })
  it('retains authored frame transform, false flags and nonvisual metadata', async () => {
    const input = await familyFixture('8', async (zip) => {
      const xml = await zip.file(slidePart).async('string')
      zip.file(
        slidePart,
        xml
          .replace(
            'id="8" name="Native chart"',
            'id="8" name="Native chart" descr="A&amp;B" hidden="0"'
          )
          .replace(
            /(<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="8"[\s\S]*?<\/p:nvGraphicFramePr>)<p:xfrm>/,
            '$1<p:xfrm rot="-1234" flipH="0" flipV="1">'
          )
      )
    })
    const result = await load('chart', 'projectChartFrame')(input)
    expect(result.sourceTransform).toMatchObject({ rotation: -1234, flipH: false, flipV: true })
    expect(result.content.frameProperties.identity).toMatchObject({ descr: 'A&B', hidden: false })
  })

  it('preserves SmartArt graph/layout source components without cached drawing authority', async () => {
    const input = await familyFixture('9'),
      result = await load('smartart', 'projectSmartArtFrame')(input)
    expect(result.kind).toBe('diagram')
    expect(result.content.smartArtDocument.layout.declarations).toHaveLength(3)
    expect(result.content.layoutStatus).toBe('authored-layout-not-evaluated')
    expect(result.compatibility).toEqual({ type: 'diagram' })
    expect(result.components.some((c) => c.partUri === 'ppt/diagrams/layout1.xml')).toBe(true)
  })

  it('binds equation to the genuine containing shape and retains structural math', async () => {
    const input = await familyFixture('10'),
      result = await load('omml', 'projectOmmlShape')(input)
    expect(result.kind).toBe('equation')
    const root = input.inventory.definitions.find(
      (d) => d.id === result.content.ommlDocument.root.componentId
    )
    expect(root.kind).toBe('math-component')
    expect(
      root.componentLocators[0].path.slice(0, input.source.componentLocators[0].path.length)
    ).toEqual(input.source.componentLocators[0].path)
    expect(result.content.ommlDocument.root.type).toBe('oMathPara')
    expect(result.compatibility).toEqual({ type: 'latex' })
    expect(result.content.mathFrame.textBody).toBeDefined()
  })

  it.each(['mixed', 'duplicate', 'paint', 'foreign-owner'])(
    'rejects equation %s rather than guessing a binding',
    async (mode) => {
      const input = await familyFixture('10', async (zip) => {
        let xml = await zip.file(slidePart).async('string')
        if (mode === 'mixed') xml = xml.replace('<a14:m ', '<a:r><a:t>Not math</a:t></a:r><a14:m ')
        if (mode === 'duplicate')
          xml = xml.replace(
            '</a14:m>',
            '</a14:m><a14:m xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main"><m:oMath/></a14:m>'
          )
        if (mode === 'paint')
          xml = xml.replace(
            'id="10" name="Native OMML"',
            'id="10" name="Native OMML" unsupported="1"'
          )
        zip.file(slidePart, xml)
      })
      if (mode === 'foreign-owner')
        input.source = { ...input.source, id: input.source.id + '-forged' }
      await expect(
        Promise.resolve().then(() => load('omml', 'projectOmmlShape')(input))
      ).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED' })
    }
  )
})

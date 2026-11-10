import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { chromium } from 'playwright'
import { build } from 'esbuild'
const require = createRequire(import.meta.url)
const JSZip = require('jszip')
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const {
  readSemanticSmartArt,
} = require('../../server/services/pptx-import/ooxml-semantic-smartart')
const { applySmartArtOperation } = require('../../shared/src/pptx-smartart-operations')
const { normalizeSmartArtDocument } = require('../../shared/src/pptx-smartart-document')
const { normalizePptxSemanticDocument } = require('../../shared/src/pptx-semantic-document')
const render = require('../../shared/src/pptx-smartart-render')
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const D = 'http://schemas.openxmlformats.org/drawingml/2006/diagram'
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const rels = (items) =>
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.map(([id, type, target]) => `<Relationship Id="${id}" Type="${R}/${type}" Target="${target}"/>`).join('')}</Relationships>`
export async function sourceFixture(change = () => {}) {
  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>'
  )
  zip.file(
    'ppt/presentation.xml',
    `<p:presentation xmlns:p="${P}" xmlns:r="${R}"><p:sldIdLst><p:sldId id="256" r:id="s"/></p:sldIdLst></p:presentation>`
  )
  zip.file('ppt/_rels/presentation.xml.rels', rels([['s', 'slide', 'slides/slide1.xml']]))
  zip.file(
    'ppt/slides/slide1.xml',
    `<p:sld xmlns:p="${P}" xmlns:a="${A}" xmlns:d="${D}" xmlns:r="${R}"><p:cSld><p:spTree><p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="7"/></p:nvGraphicFramePr><a:graphic><a:graphicData uri="${D}"><d:relIds r:dm="dm" r:lo="lo" r:qs="qs" r:cs="cs"/></a:graphicData></a:graphic></p:graphicFrame></p:spTree></p:cSld></p:sld>`
  )
  zip.file(
    'ppt/slides/_rels/slide1.xml.rels',
    rels([
      ['dm', 'diagramData', '../diagrams/data.xml'],
      ['lo', 'diagramLayout', '../diagrams/layout.xml'],
      ['qs', 'diagramQuickStyle', '../diagrams/style.xml'],
      ['cs', 'diagramColors', '../diagrams/colors.xml'],
      ['theme', 'theme', '../theme/theme1.xml'],
    ])
  )
  zip.file(
    'ppt/diagrams/data.xml',
    `<d:dataModel xmlns:d="${D}" xmlns:a="${A}"><d:ptLst><d:pt modelId="0" type="doc"/><d:pt modelId="1"><d:prSet presStyleIdx="0"/></d:pt><d:pt modelId="2"><d:prSet presStyleIdx="1"/></d:pt></d:ptLst><d:cxnLst><d:cxn modelId="3" srcId="0" destId="1" srcOrd="0" destOrd="0"/><d:cxn modelId="4" srcId="0" destId="2" srcOrd="1" destOrd="0"/></d:cxnLst></d:dataModel>`
  )
  zip.file(
    'ppt/diagrams/layout.xml',
    `<d:layoutDef xmlns:d="${D}"><d:layoutNode name="root"><d:alg type="lin"><d:param type="linDir" val="fromL"/><d:param type="vertAlign" val="t"/></d:alg><d:constrLst><d:constr type="w" for="ch" refType="w" fact="0.4"/><d:constr type="h" for="ch" refType="h" fact="0.6"/><d:constr type="sp" refType="w" fact="0.1"/></d:constrLst><d:forEach axis="ch" ptType="node"><d:layoutNode name="item" styleLbl="node1"><d:presOf axis="self"/><d:alg type="comp"/><d:shape type="ellipse"/></d:layoutNode></d:forEach></d:layoutNode></d:layoutDef>`
  )
  zip.file(
    'ppt/diagrams/style.xml',
    `<d:styleDef xmlns:d="${D}" xmlns:a="${A}" uniqueId="source-style"><d:styleLbl name="node1"><d:style><a:lnRef idx="1"><a:schemeClr val="phClr"/></a:lnRef><a:fillRef idx="1"><a:schemeClr val="phClr"/></a:fillRef><a:effectRef idx="0"><a:schemeClr val="phClr"/></a:effectRef><a:fontRef idx="minor"><a:schemeClr val="phClr"/></a:fontRef></d:style></d:styleLbl></d:styleDef>`
  )
  zip.file(
    'ppt/diagrams/colors.xml',
    `<d:colorsDef xmlns:d="${D}" xmlns:a="${A}" uniqueId="source-colors"><d:styleLbl name="node1"><d:fillClrLst meth="repeat"><a:srgbClr val="CC2200"/><a:srgbClr val="0044CC"/></d:fillClrLst><d:linClrLst meth="repeat"><a:srgbClr val="222222"/></d:linClrLst><d:txFillClrLst meth="repeat"><a:srgbClr val="FFFFFF"/></d:txFillClrLst></d:styleLbl></d:colorsDef>`
  )
  zip.file(
    'ppt/theme/theme1.xml',
    `<a:theme xmlns:a="${A}" name="source"><a:themeElements><a:clrScheme name="source"><a:accent1><a:srgbClr val="123456"/></a:accent1></a:clrScheme><a:fontScheme name="source"><a:minorFont><a:latin typeface="Aptos"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="source"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="25400"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme></a:themeElements></a:theme>`
  )
  await change(zip)
  const inventory = await buildSemanticInventory(zip)
  const context = {
    zip,
    inventory,
    source: inventory.definitions.find((d) => d.kind === 'graphic-frame'),
  }
  return { context, ...(await readSemanticSmartArt(context)) }
}
const bounds = { x: 0, y: 0, width: 9144000, height: 4572000 }
describe('genuine SmartArt source painter completion', () => {
  it('binds quick-style labels and their paragraph defaults through canonical JSON reopening', async () => {
    const result = await sourceFixture(async (zip) => {
      const part = 'ppt/diagrams/style.xml'
      zip.file(
        part,
        (await zip.file(part).async('string')).replace(
          '</d:styleLbl>',
          '<d:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="2400"/></a:pPr></a:p></d:txPr></d:styleLbl>'
        )
      )
    })
    const source = result.context.source
    const definition = {
      id: source.id,
      kind: 'diagram',
      source: {
        partUri: source.partUri,
        preconditionHash: source.preconditionHash,
        componentLocator: source.componentLocators[0],
        nativeId: source.nativeId,
      },
      content: { smartArtDocument: result.smartArtDocument },
      components: result.components,
    }
    const input = {
      schemaVersion: 1,
      definitions: { [definition.id]: definition },
      styles: {},
      fonts: {},
      instances: {
        occurrence: {
          id: 'occurrence',
          definitionId: definition.id,
          slideId: 's1',
          parentInstanceId: null,
          localTransform: [1, 0, 0, 1, 0, 0],
          paintIndex: 0,
          overrides: {},
        },
      },
    }
    const before = JSON.stringify(input)
    const normalized = normalizePptxSemanticDocument(input)
    expect(normalizePptxSemanticDocument(JSON.parse(JSON.stringify(normalized)))).toEqual(
      normalized
    )
    expect(
      Object.isFrozen(normalized.definitions[definition.id].content.smartArtDocument.sourceStyles)
    ).toBe(true)
    const label = result.smartArtDocument.sourceStyles.labels[0]
    const ids = [
      label.componentId,
      label.textStyleDocument.componentId,
      label.textStyleDocument.paragraphs[0].componentId,
    ]
    for (const id of ids) {
      for (const mutation of ['kind', 'part', 'hash', 'path', 'missing']) {
        const changed = JSON.parse(before)
        const owner = changed.definitions[definition.id]
        const component = owner.components.find((c) => c.id === id)
        if (mutation === 'kind') component.kind = 'media-segment'
        if (mutation === 'part') component.partUri = 'ppt/diagrams/unrelated.xml'
        if (mutation === 'hash') component.locator.preconditionHash = 'f'.repeat(64)
        if (mutation === 'path') component.locator.path = [99]
        if (mutation === 'missing') owner.components = owner.components.filter((c) => c.id !== id)
        expect(() => normalizePptxSemanticDocument(changed)).toThrow()
      }
    }
    expect(JSON.stringify(input)).toBe(before)
  })
  it('reads related quick style, palette, theme line and font data; paints authored geometry', async () => {
    const { smartArtDocument: document } = await sourceFixture()
    expect(document.sourceStyles.labels[0]).toMatchObject({
      name: 'node1',
      textDefaults: { run: { fontLatin: { typeface: 'Aptos' } } },
    })
    const before = JSON.stringify(document)
    const svg = render.renderSmartArtSvg(document, bounds)
    expect(svg).toContain('<ellipse')
    expect(svg).toContain('fill="#CC2200"')
    expect(svg).toContain('fill="#0044CC"')
    expect(svg).toContain('stroke-width="2.6666666666666665"')
    expect(svg).toContain('viewBox="0 0 960 480"')
    expect(svg).not.toContain('<line')
    expect(svg).not.toContain('<image')
    expect(JSON.stringify(document)).toBe(before)
  })
  it('repaints source palette selection after style edits without altering source/siblings', async () => {
    const { smartArtDocument: document } = await sourceFixture()
    const before = JSON.stringify(document)
    const next = applySmartArtOperation(document, {
      type: 'style',
      pointId: document.points[1].componentId,
      properties: [{ name: 'presStyleIdx', value: 1 }],
    })
    expect(render.renderSmartArtSvg(next, bounds).match(/fill="#0044CC"/g)).toHaveLength(2)
    expect(next.points[2]).toEqual(document.points[2])
    expect(next.sourceStyles).toEqual(document.sourceStyles)
    expect(JSON.stringify(document)).toBe(before)
    expect(render.renderSmartArtSvg(JSON.parse(JSON.stringify(next)), bounds)).toBe(
      render.renderSmartArtSvg(next, bounds)
    )
  })
  it.each([
    ['ppt/diagrams/style.xml', 'idx="1"', 'idx="99"'],
    ['ppt/diagrams/colors.xml', 'meth="repeat"', 'meth="span"'],
    ['ppt/theme/theme1.xml', '<a:prstDash val="solid"/>', '<a:custDash/>'],
  ])('rejects unsupported source styles at their real part: %s', async (path, from, to) => {
    await expect(
      sourceFixture(async (zip) =>
        zip.file(path, (await zip.file(path).async('string')).replace(from, to))
      )
    ).rejects.toMatchObject({ sourceLocation: { partUri: path } })
  })
  it('rejects a theme override instead of painting the base theme as authoritative', async () => {
    const path = 'ppt/slides/_rels/slide1.xml.rels'
    await expect(
      sourceFixture(async (zip) => {
        zip.file('ppt/theme/themeOverride1.xml', `<a:themeOverride xmlns:a="${A}"/>`)
        zip.file(
          path,
          (await zip.file(path).async('string')).replace(
            '</Relationships>',
            `<Relationship Id="override" Type="${R}/themeOverride" Target="../theme/themeOverride1.xml"/></Relationships>`
          )
        )
      })
    ).rejects.toMatchObject({
      sourceLocation: { partUri: path },
      code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
    })
  })
  it('refuses uncalibrated nonzero literal geometry instead of treating it as EMU', async () => {
    const { smartArtDocument: document } = await sourceFixture(async (zip) => {
      const path = 'ppt/diagrams/layout.xml'
      zip.file(
        path,
        (await zip.file(path).async('string')).replace(
          'type="sp" refType="w" fact="0.1"',
          'type="sp" val="10"'
        )
      )
    })
    expect(() => render.renderSmartArtSvg(document, bounds)).toThrow(
      /physical.*unit|unit.*calibrat/i
    )
  })
  it('retains source quick-style text defaults, paragraph identities, and theme joins', async () => {
    const { smartArtDocument: document, mappedDefinitionIds } = await sourceFixture(async (zip) => {
      const style = 'ppt/diagrams/style.xml',
        theme = 'ppt/theme/theme1.xml'
      zip.file(
        style,
        (await zip.file(style).async('string')).replace(
          '</d:styleLbl>',
          '<d:txPr><a:bodyPr lIns="12345" anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"><a:defRPr sz="2400" b="1"/></a:pPr></a:p></d:txPr></d:styleLbl>'
        )
      )
      zip.file(
        theme,
        (await zip.file(theme).async('string')).replace(
          '<a:prstDash val="solid"/>',
          '<a:prstDash val="solid"/><a:miter lim="800000"/>'
        )
      )
    })
    const label = document.sourceStyles.labels[0]
    expect(label.textDefaults).toMatchObject({
      body: { insetLeftEmu: 12345, verticalAlign: 'ctr' },
      paragraph: { alignment: 'ctr' },
      run: { fontSizePt: 24, bold: true, fontLatin: { typeface: 'Aptos' } },
    })
    expect(mappedDefinitionIds).toContain(label.textStyleDocument.paragraphs[0].componentId)
    expect(render.renderSmartArtSvg(document, bounds)).toContain('stroke-miterlimit="8"')
    const altered = JSON.parse(JSON.stringify(document))
    altered.sourceStyles.labels[0].textDefaults.run.fontSizePt = 12
    expect(() => normalizeSmartArtDocument(altered)).toThrow()
    altered.sourceStyles.labels[0].textDefaults.run.fontSizePt = 24
    altered.sourceStyles.styleSource.preconditionHash = 'b'.repeat(64)
    expect(() => normalizeSmartArtDocument(altered)).toThrow()
  })
  it('renders the fifty-first edited logical node from source declarations without truncation', async () => {
    const { smartArtDocument: source } = await sourceFixture()
    let document = source
    for (let n = 3; n <= 51; n++)
      document = applySmartArtOperation(document, {
        type: 'add',
        point: {
          componentId: `${source.componentId}~authored:p${n}`,
          modelId: `${n + 10}`,
          type: 'node',
          properties: [],
        },
        connection: {
          componentId: `${source.componentId}~authored:c${n}`,
          modelId: `${n + 100}`,
          type: 'parOf',
          sourceId: '0',
          destinationId: `${n + 10}`,
          sourceOrder: n,
          destinationOrder: 0,
        },
      })
    const svg = render.renderSmartArtSvg(document, bounds)
    expect(svg.match(/data-smartart-point=/g)).toHaveLength(51)
    expect(svg).toContain(`${source.componentId}~authored:p51`)
    expect(source.points).toHaveLength(3)
    expect(document.connections).toHaveLength(51)
  })
  it.each([undefined, 0, 38100])(
    'paints source rich labels with source left inset %s through the real browser measurer',
    async (leftInset) => {
      const { smartArtDocument: document } = await sourceFixture(async (zip) => {
        const data = 'ppt/diagrams/data.xml',
          theme = 'ppt/theme/theme1.xml',
          layout = 'ppt/diagrams/layout.xml',
          style = 'ppt/diagrams/style.xml'
        zip.file(
          style,
          (await zip.file(style).async('string')).replace(
            '</d:styleLbl>',
            '<d:txPr><a:bodyPr lIns="12345" rIns="0" tIns="0" bIns="0"/><a:lstStyle/><a:p/></d:txPr></d:styleLbl>'
          )
        )
        zip.file(
          theme,
          (await zip.file(theme).async('string')).replace(
            'typeface="Aptos"',
            'typeface="KaTeX Main"'
          )
        )
        zip.file(
          layout,
          (await zip.file(layout).async('string')).replace('type="ellipse"', 'type="rect"')
        )
        zip.file(
          data,
          (await zip.file(data).async('string')).replace(
            '<d:prSet presStyleIdx="0"/>',
            `<d:prSet presStyleIdx="0"/><d:t><a:bodyPr${leftInset === undefined ? '' : ` lIns="${leftInset}"`} rIns="0" tIns="0" bIns="0" anchor="t" vert="horz" wrap="none"><a:noAutofit/></a:bodyPr><a:lstStyle/><a:p><a:r><a:rPr sz="1800"/><a:t>Source </a:t></a:r><a:r><a:rPr sz="2400"/><a:t>label</a:t></a:r></a:p></d:t>`
          )
        )
      })
      const before = JSON.stringify(document)
      expect(() => render.renderSmartArtSvg(document, bounds)).toThrow(/verified physical font/)
      const bytes = [...(await readFile('server/vendor/katex/dist/fonts/KaTeX_Main-Regular.ttf'))]
      const hash = createHash('sha256').update(Buffer.from(bytes)).digest('hex')
      const bundle = await build({
        stdin: {
          contents: `
      const React = require("react");
      const { createRoot } = require("react-dom/client");
      const { NativeSmartArtRenderer } = require("./client/src/components/native-smartart/native-smartart-renderer.jsx");
      globalThis.fonts = require("./shared/src/pptx-table-runtime-fonts");
      globalThis.mountSmartArt = (input, bounds, fontRuntime) => new Promise((resolve) => {
        function App() {
          React.useLayoutEffect(() => resolve(), []);
          return React.createElement(NativeSmartArtRenderer, { document: input, bounds, fontRuntime });
        }
        createRoot(document.querySelector("main")).render(React.createElement(App));
      });`,
          resolveDir: process.cwd(),
        },
        bundle: true,
        write: false,
        platform: 'browser',
        jsx: 'automatic',
      })
      const browser = await chromium.launch({ headless: true })
      try {
        const page = await browser.newPage({
          viewport: { width: 1000, height: 520 },
          deviceScaleFactor: 1,
        })
        await page.route('http://127.0.0.1/smartart-completion', (route) =>
          route.fulfill({
            contentType: 'text/html',
            body: '<!doctype html><body style="margin:0"><main style="width:100%;height:500px"></main></body>',
          })
        )
        await page.goto('http://127.0.0.1/smartart-completion')
        await page.addScriptTag({ content: bundle.outputFiles[0].text })
        const result = await page.evaluate(
          async ({ document: input, bounds, bytes, hash }) => {
            const runtime = await globalThis.fonts.createTableFontRuntime({
              document,
              fontProfile: {
                schemaVersion: 1,
                faces: [{ id: 'main', typeface: 'KaTeX Main', assetHash: hash }],
              },
              assets: [{ faceId: 'main', bytes: new Uint8Array(bytes).buffer }],
            })
            globalThis.smartArtRuntime = runtime
            await globalThis.mountSmartArt(input, bounds, runtime)
            return {
              text: [...document.querySelectorAll('text')].map((n) => n.textContent),
              sizes: [...document.querySelectorAll('text')].map((n) => n.style.fontSize),
              aliases: [...document.querySelectorAll('text')].map((n) => n.style.fontFamily),
              x: [...document.querySelectorAll('text')].map((n) => Number(n.getAttribute('x'))),
              alias: runtime.fontFamilies.main,
              validity: runtime.measurement.validate(runtime.fontProfile, runtime.rendererProfile),
            }
          },
          { document, bounds, bytes, hash }
        )
        expect(result.text).toEqual(['Source ', 'label'])
        expect(result.sizes).toEqual(['24px', '32px'])
        expect(result.aliases).toEqual([result.alias, result.alias])
        expect(result.validity).toBeNull()
        expect(result.x[0]).toBeCloseTo((leftInset ?? 12345) / 9525, 10)
        await page.screenshot({
          path: '.omo/evidence/pptx-semantic/resume-smartart-completion-desktop.png',
        })
        await page.setViewportSize({ width: 375, height: 230 })
        await page.evaluate(() => {
          document.querySelector('main').style.height = '220px'
        })
        await page.screenshot({
          path: '.omo/evidence/pptx-semantic/resume-smartart-completion-mobile.png',
        })
        await page.evaluate(() => globalThis.smartArtRuntime.dispose())
      } finally {
        await browser.close()
      }
      expect(JSON.stringify(document)).toBe(before)
    }
  )
})

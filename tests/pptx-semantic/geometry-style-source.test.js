import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import JSZip from 'jszip'
import { mkdtemp, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const require = createRequire(import.meta.url)
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const {
  buildGeometryStyleSources,
} = require('../../server/services/pptx-import/ooxml-geometry-style-source')
const { createMediaIndex } = require('../../server/services/pptx-import/media')
const { createMediaTransaction } = require('../../server/services/pptx-import/media-dedup')
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
const { normalizeSemanticPresentation } = require('../../shared/src/pptx-semantic-presentation')
const { materializeGeometry } = require('../../shared/src/pptx-geometry-style-resolution')
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
const transform =
  '<a:xfrm flipH="false" rot="0"><a:off x="0" y="-9525"/><a:ext cx="0" cy="762000"/></a:xfrm>'
const geometry = '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'
const ph = '<p:ph idx="7" type="body"/>'
const shape = (id, properties = '', placeholder = '') =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Source"/><p:cNvSpPr/><p:nvPr>${placeholder}</p:nvPr></p:nvSpPr><p:spPr>${properties}</p:spPr></p:sp>`
const part = (kind, shapes, map = '') =>
  `<p:${kind} xmlns:p="${P}" xmlns:a="${A}"><p:cSld><p:spTree>${shapes}</p:spTree></p:cSld>${map}</p:${kind}>`
const relationship = (type, target, id = 'edge', mode = '') =>
  `<Relationship Id="${id}" Type="${R}/${type}" Target="${target}"${mode ? ` TargetMode="${mode}"` : ''}/>`
const rels = (xml) => `<Relationships xmlns="${REL}">${xml}</Relationships>`
async function fixture({
  slide = shape(2, '', ph),
  layout = shape(3, '', ph),
  master,
  matrix = '',
} = {}) {
  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>'
  )
  zip.file(
    'ppt/presentation.xml',
    `<p:presentation xmlns:p="${P}" xmlns:r="${R}"><p:sldIdLst><p:sldId id="256" r:id="s1"/><p:sldId id="257" r:id="s2"/></p:sldIdLst></p:presentation>`
  )
  zip.file(
    'ppt/_rels/presentation.xml.rels',
    rels(
      relationship('slide', 'slides/one.xml', 's1') + relationship('slide', 'slides/two.xml', 's2')
    )
  )
  for (const name of ['one', 'two']) {
    zip.file(
      `ppt/slides/${name}.xml`,
      part(
        'sld',
        slide,
        `<p:clrMapOvr><a:overrideClrMapping accent1="${name === 'one' ? 'accent2' : 'accent3'}"/></p:clrMapOvr>`
      )
    )
    zip.file(
      `ppt/slides/_rels/${name}.xml.rels`,
      rels(relationship('slideLayout', '../slideLayouts/layout.xml'))
    )
  }
  zip.file('ppt/slideLayouts/layout.xml', part('sldLayout', layout))
  zip.file(
    'ppt/slideLayouts/_rels/layout.xml.rels',
    rels(relationship('slideMaster', '../slideMasters/master.xml'))
  )
  zip.file(
    'ppt/slideMasters/master.xml',
    part(
      'sldMaster',
      master ??
        shape(
          4,
          transform + geometry + '<a:solidFill><a:schemeClr val="accent1"/></a:solidFill>',
          ph
        ) + shape(5, transform + geometry),
      '<p:clrMap accent1="accent1"/>'
    )
  )
  zip.file(
    'ppt/slideMasters/_rels/master.xml.rels',
    rels(relationship('theme', '../theme/theme.xml'))
  )
  zip.file(
    'ppt/theme/theme.xml',
    `<a:theme xmlns:a="${A}"><a:themeElements><a:clrScheme name="Source"><a:accent1><a:srgbClr val="123456"/></a:accent1><a:accent2><a:srgbClr val="234567"/></a:accent2><a:accent3><a:srgbClr val="345678"/></a:accent3></a:clrScheme><a:fmtScheme name="Source">${matrix}</a:fmtScheme></a:themeElements></a:theme>`
  )
  return { zip, inventory: await buildSemanticInventory(zip) }
}
const declaration = (result, inventory, nativeId, uri = 'ppt/slides/one.xml') => {
  const definition = inventory.definitions.find((d) => d.nativeId === nativeId && d.partUri === uri)
  return result.styles[result.definitionBindings[definition.id].styleId].payload
}
const context = (result, inventory, nativeId = '2', uri = 'ppt/slides/one.xml') => {
  const occurrence = inventory.occurrences.find(
    (o) =>
      o.slidePartUri === uri &&
      inventory.definitions.find((d) => d.id === o.definitionId)?.nativeId === nativeId
  )
  return result.styles[result.occurrenceBindings[occurrence.id].contextId].payload
}
describe('native blip fill source binding contract', () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGkwAAAAASUVORK5CYII=',
    'base64'
  )
  const blipFixture = async (paint, matrix = false) => {
    const { zip } = await fixture()
    const nativeShape = matrix
      ? shape(2, transform + geometry, ph)
      : shape(2, transform + geometry + paint, ph)
    for (const name of ['one', 'two']) {
      zip.file(
        `ppt/slides/${name}.xml`,
        part(
          'sld',
          nativeShape,
          `<p:clrMapOvr><a:overrideClrMapping accent1="${name === 'one' ? 'accent2' : 'accent3'}"/></p:clrMapOvr>`
        )
      )
      zip.file(
        `ppt/slides/_rels/${name}.xml.rels`,
        rels(
          relationship('slideLayout', '../slideLayouts/layout.xml') +
            relationship('image', '../media/source.png', 'imageOne')
        )
      )
    }
    if (matrix) {
      const theme = await zip.file('ppt/theme/theme.xml').async('string')
      zip.file(
        'ppt/theme/theme.xml',
        theme.replace('</a:fmtScheme>', `<a:fillStyleLst>${paint}</a:fillStyleLst></a:fmtScheme>`)
      )
      zip.file(
        'ppt/theme/_rels/theme.xml.rels',
        rels(relationship('image', '../media/source.png', 'imageOne'))
      )
    }
    const contentTypes = await zip.file('[Content_Types].xml').async('string')
    zip.file(
      '[Content_Types].xml',
      contentTypes.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>')
    )
    zip.file('ppt/media/source.png', png)
    return { zip, inventory: await buildSemanticInventory(zip) }
  }
  const validPaint = `<a:blipFill><a:blip xmlns:rel="${R}" rel:embed="imageOne"/></a:blipFill>`
  it('persists and binds image paint from the native override whole-format provider', async () => {
    const { zip } = await blipFixture(validPaint)
    for (const name of ['one', 'two']) {
      const xml = await zip.file(`ppt/slides/${name}.xml`).async('string')
      zip.file(
        `ppt/slides/${name}.xml`,
        xml
          .replace(validPaint, '')
          .replace(
            '</p:spPr>',
            '</p:spPr><p:style><a:fillRef idx="1"><a:schemeClr val="accent1"/></a:fillRef></p:style>'
          )
      )
      zip.file(
        `ppt/slides/_rels/${name}.xml.rels`,
        rels(
          relationship('slideLayout', '../slideLayouts/layout.xml') +
            relationship('themeOverride', '../theme/native-image.xml', 'nativeFormat')
        )
      )
    }
    zip.file(
      'ppt/theme/native-image.xml',
      `<a:themeOverride xmlns:a="${A}"><a:fmtScheme name="Image"><a:fillStyleLst>${validPaint}</a:fillStyleLst><a:lnStyleLst/><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme></a:themeOverride>`
    )
    zip.file(
      'ppt/theme/_rels/native-image.xml.rels',
      rels(relationship('image', '../media/source.png', 'imageOne'))
    )
    const inventory = await buildSemanticInventory(zip)
    const uploadsDir = await mkdtemp(join(tmpdir(), 'navslides-blip-override-'))
    const mediaTransaction = createMediaTransaction({ hashScope: {} })
    try {
      const result = await buildGeometryStyleSources(zip, inventory, {
        mediaIndex: createMediaIndex(zip),
        uploadsDir,
        mediaOptions: { mediaTransaction },
      })
      const entry =
        result.styles['ppt/theme/native-image.xml:geometry-theme-override'].payload.formatScheme
          .value.fillStyles[0].value.blip
      expect(entry.value.bindingId).toBeTruthy()
      expect(result.styles[entry.value.bindingId].source.partUri).toBe('ppt/theme/native-image.xml')
      expect(result.styles[entry.value.bindingId].payload.asset).toMatchObject({
        width: 1,
        height: 1,
        format: 'png',
        partUri: 'ppt/media/source.png',
      })
      expect(await readdir(uploadsDir)).toHaveLength(1)
    } finally {
      await mediaTransaction.rollback()
      await rm(uploadsDir, { recursive: true, force: true })
    }
  })
  it('rejects a nested image relationship rather than treating descendants as OPC edges', async () => {
    const valid = await blipFixture(validPaint)
    const uploadsDir = await mkdtemp(join(tmpdir(), 'navslides-blip-rels-'))
    let mediaTransaction = createMediaTransaction({ hashScope: {} })
    try {
      await expect(
        buildGeometryStyleSources(valid.zip, valid.inventory, {
          mediaIndex: createMediaIndex(valid.zip),
          uploadsDir,
          mediaOptions: { mediaTransaction },
        })
      ).resolves.toBeDefined()
      await mediaTransaction.rollback()
      mediaTransaction = createMediaTransaction({ hashScope: {} })
      for (const name of ['one', 'two']) {
        valid.zip.file(
          `ppt/slides/_rels/${name}.xml.rels`,
          rels(
            relationship('slideLayout', '../slideLayouts/layout.xml') +
              '<Nested>' +
              relationship('image', '../media/source.png', 'imageOne') +
              '</Nested>'
          )
        )
      }
      const inventory = valid.inventory
      await expect(
        buildGeometryStyleSources(valid.zip, inventory, {
          mediaIndex: createMediaIndex(valid.zip),
          uploadsDir,
          mediaOptions: { mediaTransaction },
        })
      ).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED' })
      expect(await readdir(uploadsDir)).toEqual([])
    } finally {
      await mediaTransaction.rollback()
      await rm(uploadsDir, { recursive: true, force: true })
    }
  })
  it('binds a decoded embed ID without storing XML escape syntax as typed ID', async () => {
    const { zip, inventory } = await blipFixture(validPaint.replace('imageOne', 'image&#79;ne'))
    const uploadsDir = await mkdtemp(join(tmpdir(), 'navslides-blip-entity-'))
    const mediaTransaction = createMediaTransaction({ hashScope: {} })
    try {
      const result = await buildGeometryStyleSources(zip, inventory, {
        mediaIndex: createMediaIndex(zip),
        uploadsDir,
        mediaOptions: { mediaTransaction },
      })
      const blip = declaration(result, inventory, '2').properties.fill.value.blip
      expect(blip.value.embed.value).toBe('imageOne')
      expect(result.styles[blip.value.bindingId].payload.edge.relationshipId).toBe(
        blip.value.embed.value
      )
      expect(await zip.file('ppt/slides/one.xml').async('string')).toContain('image&#79;ne')
    } finally {
      await mediaTransaction.rollback()
      await rm(uploadsDir, { recursive: true, force: true })
    }
  })
  it('does not swallow a media budget failure as an unused unsupported matrix', async () => {
    const { zip, inventory } = await blipFixture(validPaint, true)
    const uploadsDir = await mkdtemp(join(tmpdir(), 'navslides-blip-budget-'))
    const mediaTransaction = createMediaTransaction({ hashScope: {} })
    try {
      const options = {
        mediaIndex: createMediaIndex(zip),
        uploadsDir,
        mediaOptions: { mediaTransaction, mediaBudget: { tryReserve: () => false } },
      }
      await expect(buildGeometryStyleSources(zip, inventory, options)).rejects.toMatchObject({
        code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
      })
      await mediaTransaction.rollback()
      expect(await readdir(uploadsDir)).toEqual([])
    } finally {
      await mediaTransaction.rollback()
      await rm(uploadsDir, { recursive: true, force: true })
    }
  })
  it('propagates an exact cancellation before writing image bytes', async () => {
    const { zip, inventory } = await blipFixture(validPaint)
    const uploadsDir = await mkdtemp(join(tmpdir(), 'navslides-blip-abort-'))
    const mediaTransaction = createMediaTransaction({ hashScope: {} })
    const controller = new AbortController()
    const reason = new Error('Source blip fixture cancellation')
    controller.abort(reason)
    try {
      await expect(
        buildGeometryStyleSources(zip, inventory, {
          mediaIndex: createMediaIndex(zip),
          uploadsDir,
          mediaOptions: { mediaTransaction, signal: controller.signal },
        })
      ).rejects.toBe(reason)
      await mediaTransaction.rollback()
      expect(await readdir(uploadsDir)).toEqual([])
    } finally {
      await mediaTransaction.rollback()
      await rm(uploadsDir, { recursive: true, force: true })
    }
  })
  it.each([
    [
      'foreign embed namespace',
      `<a:blipFill><a:blip xmlns:r="urn:foreign" r:embed="imageOne"/></a:blipFill>`,
    ],
    [
      'duplicate expanded embed',
      `<a:blipFill><a:blip xmlns:r="${R}" xmlns:rel="${R}" r:embed="imageOne" rel:embed="imageOne"/></a:blipFill>`,
    ],
    [
      'embed plus link',
      `<a:blipFill><a:blip xmlns:r="${R}" r:embed="imageOne" r:link="imageOne"/></a:blipFill>`,
    ],
    [
      'effect child',
      `<a:blipFill><a:blip xmlns:r="${R}" r:embed="imageOne"><a:alphaModFix amt="50000"/></a:blip></a:blipFill>`,
    ],
    [
      'both placement modes',
      `<a:blipFill><a:blip xmlns:r="${R}" r:embed="imageOne"/><a:tile/><a:stretch/></a:blipFill>`,
    ],
    [
      'duplicate crop',
      `<a:blipFill><a:blip xmlns:r="${R}" r:embed="imageOne"/><a:srcRect/><a:srcRect/></a:blipFill>`,
    ],
    [
      'fractional crop',
      `<a:blipFill><a:blip xmlns:r="${R}" r:embed="imageOne"/><a:srcRect l="1.5"/></a:blipFill>`,
    ],
    [
      'collapsed horizontal tile',
      `<a:blipFill><a:blip xmlns:r="${R}" r:embed="imageOne"/><a:tile sx="0"/></a:blipFill>`,
    ],
    [
      'collapsed vertical tile',
      `<a:blipFill><a:blip xmlns:r="${R}" r:embed="imageOne"/><a:tile sy="0"/></a:blipFill>`,
    ],
    [
      'unknown tile alignment',
      `<a:blipFill><a:blip xmlns:r="${R}" r:embed="imageOne"/><a:tile algn="unknown"/></a:blipFill>`,
    ],
  ])('rejects malformed blip declaration: %s', async (_name, paint) => {
    const baseline = await blipFixture(validPaint)
    const uploadsDir = await mkdtemp(join(tmpdir(), 'navslides-blip-negative-'))
    const mediaTransaction = createMediaTransaction({ hashScope: {} })
    try {
      const options = {
        mediaIndex: createMediaIndex(baseline.zip),
        uploadsDir,
        mediaOptions: { mediaTransaction },
      }
      await expect(
        buildGeometryStyleSources(baseline.zip, baseline.inventory, options)
      ).resolves.toBeDefined()
      await mediaTransaction.rollback()
      const malformed = await blipFixture(paint)
      await expect(
        buildGeometryStyleSources(malformed.zip, malformed.inventory, {
          ...options,
          mediaIndex: createMediaIndex(malformed.zip),
        })
      ).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED' })
      expect(await readdir(uploadsDir)).toEqual([])
    } finally {
      await mediaTransaction.rollback()
      await rm(uploadsDir, { recursive: true, force: true })
    }
  })
  it.each([
    ['', '', ['embed', 'bindingId']],
    [
      ' dpi="0" rotWithShape="false"',
      '<a:srcRect/><a:tile/>',
      ['embed', 'bindingId', 'dpi', 'rotWithShape', 'srcRect', 'tile'],
    ],
    [
      ' dpi="192" rotWithShape="true"',
      '<a:srcRect l="10000" t="-5000" r="0"/><a:stretch><a:fillRect l="0" b="25000"/></a:stretch>',
      ['embed', 'bindingId', 'dpi', 'rotWithShape', 'srcRect', 'stretch'],
    ],
  ])('binds immutable package media without authored defaults: %s', async (attrs, body, keys) => {
    const { zip } = await fixture()
    const nativeShape = shape(
      2,
      transform +
        geometry +
        `<a:blipFill${attrs}><a:blip xmlns:rel="${R}" rel:embed="imageOne"/>${body}</a:blipFill>`,
      ph
    )
    for (const name of ['one', 'two'])
      zip.file(
        `ppt/slides/${name}.xml`,
        part(
          'sld',
          nativeShape,
          `<p:clrMapOvr><a:overrideClrMapping accent1="${name === 'one' ? 'accent2' : 'accent3'}"/></p:clrMapOvr>`
        )
      )
    const contentTypes = await zip.file('[Content_Types].xml').async('string')
    zip.file(
      '[Content_Types].xml',
      contentTypes.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>')
    )
    zip.file('ppt/media/source.png', png)
    for (const name of ['one', 'two'])
      zip.file(
        `ppt/slides/_rels/${name}.xml.rels`,
        rels(
          relationship('slideLayout', '../slideLayouts/layout.xml') +
            relationship('image', '../media/source.png', 'imageOne')
        )
      )
    const inventory = await buildSemanticInventory(zip)
    const sourceBefore = await zip.file('ppt/slides/one.xml').async('string')
    const uploadsDir = await mkdtemp(join(tmpdir(), 'navslides-blip-source-'))
    const mediaTransaction = createMediaTransaction({ hashScope: {} })
    try {
      const result = await buildGeometryStyleSources(zip, inventory, {
        mediaIndex: createMediaIndex(zip),
        uploadsDir,
        mediaOptions: { mediaTransaction },
      })
      const blip = declaration(result, inventory, '2').properties.fill.value.blip
      expect(Object.keys(blip.value).sort()).toEqual([...keys].sort())
      expect(blip.value.embed.value).toBe('imageOne')
      expect(blip.value.embed.source.partUri).toBe('ppt/slides/one.xml')
      const binding = result.styles[blip.value.bindingId]
      expect(binding.kind).toBe('geometry-blip-binding')
      expect(binding.origin).toBe('source')
      expect(binding.source).toEqual(blip.value.embed.source)
      expect(binding.payload.edge).toMatchObject({
        fromPartUri: 'ppt/slides/one.xml',
        toPartUri: 'ppt/media/source.png',
        relationshipId: 'imageOne',
        type: `${R}/image`,
        source: { partUri: 'ppt/slides/_rels/one.xml.rels' },
      })
      expect(binding.payload.asset).toMatchObject({
        partUri: 'ppt/media/source.png',
        preconditionHash: createHash('sha256').update(png).digest('hex'),
        width: 1,
        height: 1,
        format: 'png',
      })
      expect(binding.payload.asset.src).toMatch(/^\/uploads\/[^/]+\.png$/)
      expect(JSON.parse(JSON.stringify(result))).toEqual(result)
      expect(await zip.file('ppt/slides/one.xml').async('string')).toBe(sourceBefore)
      expect(await zip.file('ppt/media/source.png').async('nodebuffer')).toEqual(png)
    } finally {
      await mediaTransaction.rollback()
      await rm(uploadsDir, { recursive: true, force: true })
    }
  })
  it('binds nested fill-overlay media from theme and native-theme effect styles', async () => {
    const { zip } = await blipFixture(validPaint, true)
    const effect = `<a:effectDag type="tree"><a:cont name="nested" type="tree"><a:fillOverlay blend="over"><a:blipFill><a:blip xmlns:rel="${R}" rel:embed="imageOne"/><a:stretch><a:fillRect/></a:stretch></a:blipFill></a:fillOverlay></a:cont></a:effectDag>`
    const themeXml = await zip.file('ppt/theme/theme.xml').async('string')
    zip.file(
      'ppt/theme/theme.xml',
      themeXml.replace(
        '</a:fmtScheme>',
        `<a:effectStyleLst><a:effectStyle>${effect}</a:effectStyle></a:effectStyleLst></a:fmtScheme>`
      )
    )
    const slideRels = await zip.file('ppt/slides/_rels/one.xml.rels').async('string')
    zip.file(
      'ppt/slides/_rels/one.xml.rels',
      slideRels.replace(
        '</Relationships>',
        `${relationship('themeOverride', '../theme/native.xml', 'nativeOverride')}</Relationships>`
      )
    )
    zip.file(
      'ppt/theme/native.xml',
      `<a:themeOverride xmlns:a="${A}"><a:fmtScheme name="Native"><a:effectStyleLst><a:effectStyle>${effect}</a:effectStyle></a:effectStyleLst></a:fmtScheme></a:themeOverride>`
    )
    zip.file(
      'ppt/theme/_rels/native.xml.rels',
      rels(relationship('image', '../media/source.png', 'imageOne'))
    )
    const inventory = await buildSemanticInventory(zip)
    const uploadsDir = await mkdtemp(join(tmpdir(), 'navslides-overlay-blip-'))
    const mediaTransaction = createMediaTransaction({ hashScope: {} })
    try {
      const result = await buildGeometryStyleSources(zip, inventory, {
        mediaIndex: createMediaIndex(zip),
        uploadsDir,
        mediaOptions: { mediaTransaction },
      })
      const theme = Object.values(result.styles).find((entry) => entry.kind === 'theme')
      const native = Object.values(result.styles).find(
        (entry) => entry.kind === 'native-theme-override'
      )
      const themeBlip =
        theme.payload.effectStyles[0].value.effects.value.effects[0].value.effects[0].value.fill.value.blip.value
      const nativeBlip =
        native.payload.formatScheme.value.effectStyles[0].value.effects.value.effects[0].value.effects[0].value.fill.value.blip.value
      const themeBinding = result.styles[themeBlip.bindingId]
      const nativeBinding = result.styles[nativeBlip.bindingId]
      expect(themeBinding).toMatchObject({
        kind: 'geometry-blip-binding',
        payload: { edge: { fromPartUri: 'ppt/theme/theme.xml', relationshipId: 'imageOne' } },
      })
      expect(nativeBinding).toMatchObject({
        kind: 'geometry-blip-binding',
        payload: { edge: { fromPartUri: 'ppt/theme/native.xml', relationshipId: 'imageOne' } },
      })
    } finally {
      await mediaTransaction.rollback()
      await rm(uploadsDir, { recursive: true, force: true })
    }
  })
})
describe('native pattern fill source contract', () => {
  const presets = [
    'pct5',
    'pct10',
    'pct20',
    'pct25',
    'pct30',
    'pct40',
    'pct50',
    'pct60',
    'pct70',
    'pct75',
    'pct80',
    'pct90',
    'horz',
    'vert',
    'ltHorz',
    'ltVert',
    'dkHorz',
    'dkVert',
    'narHorz',
    'narVert',
    'dashHorz',
    'dashVert',
    'cross',
    'dnDiag',
    'upDiag',
    'ltDnDiag',
    'ltUpDiag',
    'dkDnDiag',
    'dkUpDiag',
    'wdDnDiag',
    'wdUpDiag',
    'dashDnDiag',
    'dashUpDiag',
    'diagCross',
    'smCheck',
    'lgCheck',
    'smGrid',
    'lgGrid',
    'dotGrid',
    'smConfetti',
    'lgConfetti',
    'horzBrick',
    'diagBrick',
    'solidDmnd',
    'openDmnd',
    'dotDmnd',
    'plaid',
    'sphere',
    'weave',
    'divot',
    'shingle',
    'wave',
    'trellis',
    'zigZag',
  ]
  it.each(presets)(
    'retains %s with independent native color and preset provenance',
    async (preset) => {
      const xml = `<a:pattFill prst="${preset}"><a:fgClr><a:schemeClr val="accent1"><a:shade val="50000"/></a:schemeClr></a:fgClr><a:bgClr><a:scrgbClr r="-10000" g="50000" b="150000"><a:alpha val="0"/></a:scrgbClr></a:bgClr></a:pattFill>`
      const { zip, inventory } = await fixture({ slide: shape(2, xml, ph) })
      const before = JSON.stringify(inventory)
      const bytes = await zip.file('ppt/slides/one.xml').async('string')
      const result = await buildGeometryStyleSources(zip, inventory)
      const sourceFill = declaration(result, inventory, '2').properties.fill
      const pattern = sourceFill.value.pattern
      expect(pattern.value.preset.value).toBe(preset)
      expect(pattern.value.preset.source).toEqual(pattern.source)
      expect(pattern.value.foreground.value).toMatchObject({
        kind: 'scheme',
        value: 'accent1',
        transforms: [{ value: { kind: 'shade', value: 50000 } }],
      })
      expect(pattern.value.background.value).toMatchObject({
        kind: 'scrgb',
        value: { r: -10000, g: 50000, b: 150000 },
        transforms: [{ value: { kind: 'alpha', value: 0 } }],
      })
      expect(pattern.value.foreground.source.componentLocator.path).not.toEqual(
        pattern.value.background.source.componentLocator.path
      )
      expect(JSON.stringify(inventory)).toBe(before)
      expect(await zip.file('ppt/slides/one.xml').async('string')).toBe(bytes)
    }
  )
  it.each([
    ['<a:pattFill/>', []],
    ['<a:pattFill prst="pct5"/>', ['preset']],
    ['<a:pattFill><a:fgClr><a:prstClr val="red"/></a:fgClr></a:pattFill>', ['foreground']],
    [
      '<a:pattFill><a:bgClr><a:hslClr hue="0" sat="0" lum="0"/></a:bgClr></a:pattFill>',
      ['background'],
    ],
  ])(
    'preserves omitted pattern fields instead of fabricating source defaults: %s',
    async (xml, keys) => {
      const { zip, inventory } = await fixture({ slide: shape(2, xml, ph) })
      const result = await buildGeometryStyleSources(zip, inventory)
      expect(
        Object.keys(declaration(result, inventory, '2').properties.fill.value.pattern.value)
      ).toEqual(keys)
    }
  )
  it.each([
    '<a:pattFill prst="unknown"/>',
    '<a:pattFill prst="pct5" extra="1"/>',
    '<a:pattFill prst="pct5"><a:fgClr/></a:pattFill>',
    '<a:pattFill prst="pct5"><a:fgClr><a:srgbClr val="123456"/><a:prstClr val="red"/></a:fgClr></a:pattFill>',
    '<a:pattFill prst="pct5"><a:fgClr><a:srgbClr val="123456"/></a:fgClr><a:fgClr><a:srgbClr val="123456"/></a:fgClr></a:pattFill>',
    '<a:pattFill prst="pct5"><a:tileRect/></a:pattFill>',
  ])('rejects malformed pattern declarations atomically: %s', async (xml) => {
    const { zip, inventory } = await fixture({ slide: shape(2, xml, ph) })
    const before = JSON.stringify(inventory)
    await expect(buildGeometryStyleSources(zip, inventory)).rejects.toMatchObject({
      code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
    })
    expect(JSON.stringify(inventory)).toBe(before)
  })
})
describe('native geometry transform source contract', () => {
  const valued = [
    ['tint', 0],
    ['shade', 100000],
    ['alpha', 50000],
    ['alphaOff', -100000],
    ['alphaMod', 2147483647],
    ['hue', 21599999],
    ['hueOff', -2147483648],
    ['hueMod', 2147483647],
    ...['sat', 'lum', 'red', 'green', 'blue'].flatMap((kind) => [
      [kind, -2147483648],
      [kind + 'Off', 2147483647],
      [kind + 'Mod', -1],
    ]),
  ]
  it.each([
    ...valued.map(([kind, value]) => [`<a:${kind} val="${value}"/>`, { kind, value }]),
    ...['comp', 'inv', 'gray', 'gamma', 'invGamma'].map((kind) => [`<a:${kind}/>`, { kind }]),
  ])('retains the native domain and source locator for %s', async (xml, expected) => {
    const { zip, inventory } = await fixture({
      slide: shape(2, `<a:solidFill><a:srgbClr val="123456">${xml}</a:srgbClr></a:solidFill>`, ph),
    })
    const before = JSON.stringify(inventory)
    const bytes = await zip.file('ppt/slides/one.xml').async('string')
    const result = await buildGeometryStyleSources(zip, inventory)
    const color = declaration(result, inventory, '2').properties.fill.value.color
    expect(color.value.transforms[0].value).toEqual(expected)
    expect(color.value.transforms[0].source.componentLocator.path.length).toBe(
      color.source.componentLocator.path.length + 1
    )
    expect(JSON.stringify(inventory)).toBe(before)
    expect(await zip.file('ppt/slides/one.xml').async('string')).toBe(bytes)
  })
  it.each([
    '<a:comp val="0"/>',
    '<a:gamma val="0"/>',
    '<a:hue/>',
    '<a:hue val="21600000"/>',
    '<a:hue val="-1"/>',
    '<a:hueMod val="-1"/>',
    '<a:alphaMod val="-1"/>',
    '<a:alphaOff val="100001"/>',
    '<a:red val="2147483648"/>',
    '<a:satMod val="-2147483649"/>',
    '<a:greenOff val="1.5"/>',
    '<a:blue val="0" extra="1"/>',
    '<a:gray><a:inv/></a:gray>',
  ])('rejects invalid transform shape/domain without changing source: %s', async (xml) => {
    const { zip, inventory } = await fixture({
      slide: shape(2, `<a:solidFill><a:srgbClr val="123456">${xml}</a:srgbClr></a:solidFill>`, ph),
    })
    const before = JSON.stringify(inventory)
    await expect(buildGeometryStyleSources(zip, inventory)).rejects.toMatchObject({
      code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
    })
    expect(JSON.stringify(inventory)).toBe(before)
  })
})
describe('native geometry color declarations', () => {
  it.each([
    [
      '<a:scrgbClr r="50000" g="25000" b="10000"/>',
      { kind: 'scrgb', value: { r: 50000, g: 25000, b: 10000 } },
    ],
    [
      '<a:scrgbClr r="-10000" g="0" b="150000"/>',
      { kind: 'scrgb', value: { r: -10000, g: 0, b: 150000 } },
    ],
    [
      '<a:hslClr hue="12600000" sat="50000" lum="40000"/>',
      { kind: 'hsl', value: { hue: 12600000, sat: 50000, lum: 40000 } },
    ],
    [
      '<a:hslClr hue="21600000" sat="100000" lum="50000"/>',
      { kind: 'hsl', value: { hue: 21600000, sat: 100000, lum: 50000 } },
    ],
    ['<a:prstClr val="cornflowerBlue"/>', { kind: 'preset', value: 'cornflowerBlue' }],
    ['<a:prstClr val="dkSlateGray"/>', { kind: 'preset', value: 'dkSlateGray' }],
  ])(
    'retains exact authored values for %s without rounding source to RGB',
    async (xml, expected) => {
      const { zip, inventory } = await fixture({
        slide: shape(2, `<a:solidFill>${xml}</a:solidFill>`, ph),
      })
      const before = JSON.stringify(inventory)
      const bytes = await zip.file('ppt/slides/one.xml').async('string')
      const result = await buildGeometryStyleSources(zip, inventory)
      const color = declaration(result, inventory, '2').properties.fill.value.color
      expect(color.value).toEqual(expected)
      expect(color.source).toMatchObject({
        partUri: 'ppt/slides/one.xml',
        preconditionHash: createHash('sha256').update(bytes).digest('hex'),
        componentLocator: { path: expect.any(Array) },
      })
      expect(JSON.stringify(inventory)).toBe(before)
      expect(await zip.file('ppt/slides/one.xml').async('string')).toBe(bytes)
    }
  )
  it.each([
    'scrgbClr r="50000" g="25000" b="10000"',
    'hslClr hue="12600000" sat="50000" lum="40000"',
    'prstClr val="cornflowerBlue"',
  ])('keeps ordered transforms and independent provenance on %s', async (tag) => {
    const name = tag.split(' ')[0]
    const xml = `<a:${tag}><a:alpha val="50000"/><a:tint val="50000"/></a:${name}>`
    const { zip, inventory } = await fixture({
      slide: shape(2, `<a:ln w="12700"><a:solidFill>${xml}</a:solidFill></a:ln>`, ph),
    })
    const result = await buildGeometryStyleSources(zip, inventory)
    const color = declaration(result, inventory, '2').properties.stroke.value.color
    expect(color.value.transforms.map((entry) => entry.value)).toEqual([
      { kind: 'alpha', value: 50000 },
      { kind: 'tint', value: 50000 },
    ])
    expect(
      color.value.transforms.every(
        (entry) =>
          entry.source.componentLocator.path.length ===
          color.source.componentLocator.path.length + 1
      )
    ).toBe(true)
  })
  it.each([
    '<a:scrgbClr r="0" g="0"/>',
    '<a:scrgbClr r="0" g="0" b="1.5"/>',
    '<a:scrgbClr r="2147483648" g="0" b="0"/>',
    '<a:scrgbClr r="0" g="0" b="0" extra="1"/>',
    '<a:scrgbClr r="0" r="1" g="0" b="0"/>',
    '<a:hslClr hue="-1" sat="100000" lum="50000"/>',
    '<a:hslClr hue="21600001" sat="100000" lum="50000"/>',
    '<a:hslClr hue="0" sat="50000"/>',
    '<a:prstClr val="unknown"/>',
    '<a:prstClr val=""/>',
    '<a:scrgbClr xmlns:a="urn:foreign" r="0" g="0" b="0"/>',
  ])('rejects malformed native color without mutating source: %s', async (xml) => {
    const { zip, inventory } = await fixture({
      slide: shape(2, `<a:solidFill>${xml}</a:solidFill>`, ph),
    })
    const before = JSON.stringify(inventory)
    await expect(buildGeometryStyleSources(zip, inventory)).rejects.toMatchObject({
      code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
    })
    expect(JSON.stringify(inventory)).toBe(before)
  })
})
describe('relationship-bound geometry declarations', () => {
  it.each([
    [
      'foreign namespace',
      (s) => s.replace('http://schemas.microsoft.com/office/drawing/2010/main', 'urn:foreign'),
    ],
    ['wrong extension URI', (s) => s.replace('91240B29', '91240B28')],
    ['duplicate width', (s) => s.replace('w="12700"', 'w="12700" w="12700"')],
    ['duplicate color', (s) => s.replace('val="accent1"', 'val="accent1" val="accent2"')],
    ['wrong payload', (s) => s.replaceAll('hiddenLine', 'unknown')],
    ['unexpected text', (s) => s.replace('<a:solidFill>', 'unexpected<a:solidFill>')],
    ['extra attribute', (s) => s.replace('w="12700"', 'w="12700" unknown="1"')],
    ['no width', (s) => s.replace(' w="12700"', '')],
    ['negative width', (s) => s.replace('w="12700"', 'w="-1"')],
    [
      'hidden None',
      (s) => s.replace('<a:solidFill><a:schemeClr val="accent1"/></a:solidFill>', '<a:noFill/>'),
    ],
    [
      'duplicate payload',
      (s) =>
        s.replace(
          '</a:ext>',
          '<x:hiddenLine w="12700"><a:solidFill><a:srgbClr val="123456"/></a:solidFill></x:hiddenLine></a:ext>'
        ),
    ],
    ['duplicate extension', (s) => s.replace('</a:extLst>', '<a:ext uri="unknown"/></a:extLst>')],
    ['empty extension', () => '<a:extLst/>'],
    ['duplicate container', (s) => s + s],
    ['unknown compound', (s) => s.replace('w="12700"', 'w="12700" cmpd="unknown"')],
    ['unknown alignment', (s) => s.replace('w="12700"', 'w="12700" algn="unknown"')],
  ])('rejects %s in a latent outline even while active paint is None', async (_name, mutate) => {
    const base =
      '<a:extLst xmlns:x="http://schemas.microsoft.com/office/drawing/2010/main"><a:ext uri="{91240B29-F687-4F45-9708-019B960494DF}"><x:hiddenLine w="12700"><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></x:hiddenLine></a:ext></a:extLst>'
    const { zip, inventory } = await fixture({
      slide: shape(2, '<a:ln><a:noFill/></a:ln>' + mutate(base), ph),
    })
    const before = JSON.stringify(inventory)
    await expect(buildGeometryStyleSources(zip, inventory)).rejects.toMatchObject({
      code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
    })
    expect(JSON.stringify(inventory)).toBe(before)
  })
  it('admits the exact layout latent noFill declaration at its retained locator', async () => {
    const hidden = '<a:extLst><a:ext uri="{909E8E84-426E-40DD-AFC4-6F175D3DCCD1}"><a14:hiddenFill xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main"><a:noFill/></a14:hiddenFill></a:ext></a:extLst>'
    const { zip, inventory } = await fixture({ layout: shape(3, '<a:noFill/>' + hidden, ph) })
    const bytes = await zip.file('ppt/slideLayouts/layout.xml').async('nodebuffer')
    const result = await buildGeometryStyleSources(zip, inventory)
    const payload = declaration(result, inventory, '3', 'ppt/slideLayouts/layout.xml')
    expect(payload.hiddenFill.value.fill.value.color.value).toEqual({ kind: 'none' })
    expect(payload.hiddenFill.source.componentLocator.path).toEqual([0, 0, 0, 0, 1, 1, 0, 0])
    expect(payload.hiddenFill.source.componentLocator.path).not.toEqual(payload.properties.fill.source.componentLocator.path)
    expect(await zip.file('ppt/slideLayouts/layout.xml').async('nodebuffer')).toEqual(bytes)
  })
  it.each([
    ['<a:noFill/>', { kind: 'none' }],
    ['<a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>', { kind: 'srgb', value: 'FFFFFF' }],
    ['<a:solidFill><a:schemeClr val="accent1"/></a:solidFill>', { kind: 'scheme', value: 'accent1' }],
  ].flatMap(([fill, color]) => ['<a:noFill/>', '<a:solidFill><a:srgbClr val="123456"/></a:solidFill>'].map((active) => [fill, color, active])))(
    'retains exact latent fill %s without replacing active paint', async (fill, color, active) => {
      // MS-ODRAWXML 2.3.1.5: invisible fill metadata is ignored for visible fill.
      const hidden = `<a:extLst xmlns:h="http://schemas.microsoft.com/office/drawing/2010/main"><a:ext uri="{909E8E84-426E-40DD-AFC4-6F175D3DCCD1}"><h:hiddenFill>${fill}</h:hiddenFill></a:ext></a:extLst>`
      const { zip } = await fixture({ slide: shape(2, geometry + active + hidden, ph) })
      zip.file('ppt/presentation.xml', (await zip.file('ppt/presentation.xml').async('string')).replace(
        '</p:presentation>', '<p:sldSz cx="9144000" cy="5143500"/></p:presentation>'))
      const bytes = await zip.file('ppt/slides/one.xml').async('nodebuffer')
      const result = await projectSemanticImport({ zip, geometryInheritance: true,
        presentation: { slides: [{ id: 'first', elements: [] }, { id: 'second', elements: [] }] } })
      const model = result.presentation.pptxSemantic
      const instance = Object.values(model.instances).find((item) =>
        model.definitions[item.definitionId].source.nativeId === '2')
      const styleId = model.definitions[instance.definitionId].content.geometrySource.styleId
      const latent = model.styles[styleId].payload.hiddenFill
      expect(latent.value.fill.value.color.value).toEqual(color)
      expect(latent.source.componentLocator.path).toEqual([0, 0, 0, 0, 1, 2, 0, 0])
      expect(latent.value.fill.source.componentLocator.path).toEqual([...latent.source.componentLocator.path, 0])
      const restored = normalizeSemanticPresentation(JSON.parse(JSON.stringify(result.presentation)))
      expect(restored.pptxSemantic.styles).toEqual(model.styles)
      expect(materializeGeometry(restored.pptxSemantic, instance.id).style.fill.color).toEqual(
        active.includes('solidFill') ? { kind: 'srgb', value: '123456' } : { kind: 'none' })
      for (const target of ['wrapper', 'fill']) {
        const forged = structuredClone(result.presentation)
        const record = forged.pptxSemantic.styles[styleId].payload.hiddenFill
        const field = target === 'wrapper' ? record : record.value.fill
        field.source.componentLocator.path.push(99)
        expect(() => normalizeSemanticPresentation(forged)).toThrow()
      }
      for (const mutation of ['equal', 'parent', 'fabricated', 'relocated']) {
        const forged = structuredClone(result.presentation)
        const latent = forged.pptxSemantic.styles[styleId].payload.hiddenFill
        const parent = latent.source.componentLocator.path
        latent.value.fill.source.componentLocator.path = mutation === 'equal' ? [...parent]
          : mutation === 'parent' ? parent.slice(0, -1) : [...parent, 99]
        if (mutation === 'relocated') {
          latent.source.componentLocator.path = [...parent, 99]
          latent.value.fill.source.componentLocator.path = [...parent, 99, 0]
          latent.value.fill.value.color.source.componentLocator.path = [...parent, 99, 0]
        }
        expect(() => normalizeSemanticPresentation(forged)).toThrow()
      }
      const forged = structuredClone(result.presentation)
      forged.pptxSemantic.styles[styleId].payload.hiddenFill.value.fill.value.color.value = { kind: 'system', value: 'window', lastColor: 'FFFFFF' }
      expect(() => normalizeSemanticPresentation(forged)).toThrow()
      expect(await zip.file('ppt/slides/one.xml').async('nodebuffer')).toEqual(bytes)
    }
  )
  it.each([
    ['wrong namespace', (s) => s.replace('drawing/2010/main', 'drawing/2011/main')],
    ['wrong URI', (s) => s.replace('909E8E84', '909E8E85')],
    ['unknown payload', (s) => s.replaceAll('hiddenFill', 'unknown')],
    ['attribute', (s) => s.replace('<h:hiddenFill>', '<h:hiddenFill extra="1">')],
    ['text', (s) => s.replace('<a:noFill/>', 'unexpected<a:noFill/>')],
    ['missing fill', (s) => s.replace('<a:noFill/>', '')],
    ['duplicate fill', (s) => s.replace('<a:noFill/>', '<a:noFill/><a:noFill/>')],
    ['malformed noFill', (s) => s.replace('<a:noFill/>', '<a:noFill bad="1"/>')],
    ['unsupported color form', (s) => s.replace('<a:noFill/>', '<a:solidFill><a:prstClr val="red"/></a:solidFill>')],
    ['unsupported gradient fill', (s) => s.replace('<a:noFill/>', '<a:gradFill/>')],
    ['unsupported pattern fill', (s) => s.replace('<a:noFill/>', '<a:pattFill prst="pct25"/>')],
    ['unsupported blip fill', (s) => s.replace('<a:noFill/>', '<a:blipFill/>')],
    ['unsupported group fill', (s) => s.replace('<a:noFill/>', '<a:grpFill/>')],
    ['wrong fill namespace', (s) => s.replace('<a:noFill/>', '<h:noFill/>')],
    ['duplicate URI', (s) => s.replace('</a:extLst>', '<a:ext uri="{909E8E84-426E-40DD-AFC4-6F175D3DCCD1}"><h:hiddenFill><a:noFill/></h:hiddenFill></a:ext></a:extLst>')],
    ['duplicate payload', (s) => s.replace('</h:hiddenFill>', '</h:hiddenFill><h:hiddenFill><a:noFill/></h:hiddenFill>')],
  ])('rejects hidden fill %s with exact extension location', async (name, mutate) => {
    const hidden = '<a:extLst xmlns:h="http://schemas.microsoft.com/office/drawing/2010/main"><a:ext uri="{909E8E84-426E-40DD-AFC4-6F175D3DCCD1}"><h:hiddenFill><a:noFill/></h:hiddenFill></a:ext></a:extLst>'
    const { zip, inventory } = await fixture({ slide: shape(2, mutate(hidden), ph) })
    const bytes = await zip.file('ppt/slides/one.xml').async('nodebuffer')
    await expect(buildGeometryStyleSources(zip, inventory)).rejects.toMatchObject({
      code: 'PPTX_SEMANTIC_ADMISSION_FAILED', sourceLocation: {
        partUri: 'ppt/slides/one.xml', componentLocator: { path: [0, 0, 0, 0, 1, 0, name === 'duplicate URI' ? 1 : 0] },
      },
    })
    expect(await zip.file('ppt/slides/one.xml').async('nodebuffer')).toEqual(bytes)
  })
  it('keeps a namespace-authenticated native hidden outline separate from active None', async () => {
    const hidden =
      '<a:extLst><a:ext uri="{91240B29-F687-4F45-9708-019B960494DF}"><latent:hiddenLine xmlns:latent="http://schemas.microsoft.com/office/drawing/2010/main" w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="accent1"><a:shade val="50000"/></a:schemeClr></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></latent:hiddenLine></a:ext></a:extLst>'
    const { zip, inventory } = await fixture({
      slide: shape(2, `<a:ln w="12700"><a:noFill/></a:ln>${hidden}`, ph),
    })
    const bytes = await zip.file('ppt/slides/one.xml').async('string')
    const before = JSON.stringify(inventory)
    const result = await buildGeometryStyleSources(zip, inventory)
    const source = declaration(result, inventory, '2')
    expect(source.properties.stroke.value.color.value).toEqual({ kind: 'none' })
    expect(source.hiddenStroke.value.color.value).toEqual({
      kind: 'scheme',
      value: 'accent1',
      transforms: [{ source: expect.any(Object), value: { kind: 'shade', value: 50000 } }],
    })
    expect(source.hiddenStroke.value).toMatchObject({
      width: { value: 12700 },
      cap: { value: 'flat' },
      compound: { value: 'sng' },
      alignment: { value: 'ctr' },
      dash: { value: { kind: 'preset', value: 'solid' } },
      join: { value: { kind: 'miter', limit: { value: 800000 } } },
    })
    expect(source.hiddenStroke.source.partUri).toBe('ppt/slides/one.xml')
    expect(source.hiddenStroke.source.componentLocator.path).not.toEqual(
      source.properties.stroke.source.componentLocator.path
    )
    expect(await zip.file('ppt/slides/one.xml').async('string')).toBe(bytes)
    expect(JSON.stringify(inventory)).toBe(before)
  })
  it.each(['', '<a:effectLst/>', '<a:effectLst><a:blur rad="12700"/></a:effectLst>'])(
    'preserves Office hidden effects separately from active effects: %s',
    async (active) => {
      // MS-ODRAWXML 2.3.1.4: hiddenEffects stores invisible effects, not active paint.
      const hidden =
        '<a:extLst><a:ext uri="{AF507438-7753-43E0-B8FC-AC1667EBCBE1}"><latent:hiddenEffects xmlns:latent="http://schemas.microsoft.com/office/drawing/2010/main"><a:effectLst><a:outerShdw dist="35921" dir="2700000" algn="ctr" rotWithShape="0"><a:schemeClr val="accent1"/></a:outerShdw></a:effectLst></latent:hiddenEffects></a:ext></a:extLst>'
      const { zip, inventory } = await fixture({ slide: shape(2, `${active}${hidden}`, ph) })
      const bytes = await zip.file('ppt/slides/one.xml').async('nodebuffer')
      const before = JSON.stringify(inventory)
      const result = await buildGeometryStyleSources(zip, inventory)
      const source = declaration(result, inventory, '2')
      expect(source.hiddenEffects.value.effects.value).toMatchObject({
        kind: 'list',
        effects: [{ value: { kind: 'outerShdw', dist: { value: 35921 }, dir: { value: 2700000 } } }],
      })
      expect(source.hiddenEffects.source.partUri).toBe('ppt/slides/one.xml')
      expect(source.hiddenEffects.value.effects.source.componentLocator.path).toEqual([
        ...source.hiddenEffects.source.componentLocator.path, 0,
      ])
      if (!active) expect(source.properties).not.toHaveProperty('effects')
      else {
        expect(source.properties.effects.value.effects).toHaveLength(active.includes('blur') ? 1 : 0)
        expect(source.properties.effects.source.componentLocator.path).not.toEqual(
          source.hiddenEffects.source.componentLocator.path
        )
      }
      expect(await zip.file('ppt/slides/one.xml').async('nodebuffer')).toEqual(bytes)
      expect(JSON.stringify(inventory)).toBe(before)
    }
  )
  it.each([
    ['foreign namespace', (s) => s.replace('http://schemas.microsoft.com/office/drawing/2010/main', 'urn:foreign')],
    ['unknown URI', (s) => s.replace('AF507438', 'AF507439')],
    ['unknown payload', (s) => s.replaceAll('hiddenEffects', 'unknown')],
    ['extra attribute', (s) => s.replace('<h:hiddenEffects', '<h:hiddenEffects unknown="1"')],
    ['text content', (s) => s.replace('<a:effectLst>', 'unexpected<a:effectLst>')],
    ['missing program', (s) => s.replace(/<a:effectLst>.*<\/a:effectLst>/, '')],
    ['duplicate program', (s) => s.replace('</h:hiddenEffects>', '<a:effectLst/></h:hiddenEffects>')],
    ['unknown effect', (s) => s.replaceAll('blur', 'unknown')],
    ['malformed effect', (s) => s.replace('rad="12700"', 'rad="-1"')],
    ['duplicate URI', (s) => s.replace('</a:extLst>', '<a:ext uri="{AF507438-7753-43E0-B8FC-AC1667EBCBE1}"><h:hiddenEffects><a:effectLst/></h:hiddenEffects></a:ext></a:extLst>')],
    ['duplicate hiddenEffects payload', (s) => s.replace('</h:hiddenEffects>', '</h:hiddenEffects><h:hiddenEffects><a:effectLst/></h:hiddenEffects>')],
    ['nested unknown container in hiddenEffects', (s) => s.replace('<a:blur rad="12700"/>', '<a:cont name="invalid" type="unknown"/>')],
  ])('rejects %s in hidden effects with a source location', async (_name, mutate) => {
    const hidden = '<a:extLst xmlns:h="http://schemas.microsoft.com/office/drawing/2010/main"><a:ext uri="{AF507438-7753-43E0-B8FC-AC1667EBCBE1}"><h:hiddenEffects><a:effectLst><a:blur rad="12700"/></a:effectLst></h:hiddenEffects></a:ext></a:extLst>'
    const { zip, inventory } = await fixture({ slide: shape(2, mutate(hidden), ph) })
    const bytes = await zip.file('ppt/slides/one.xml').async('nodebuffer')
    const before = JSON.stringify(inventory)
    await expect(buildGeometryStyleSources(zip, inventory)).rejects.toMatchObject({
      code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
      sourceLocation: { partUri: 'ppt/slides/one.xml', componentLocator: { path: expect.any(Array) } },
    })
    expect(await zip.file('ppt/slides/one.xml').async('nodebuffer')).toEqual(bytes)
    expect(JSON.stringify(inventory)).toBe(before)
  })
  it.each(['<a:effectLst/>', '<a:effectLst><a:blur rad="12700"/></a:effectLst>'])(
    'retains latent effect sources across semantic JSON reload without rendering them: %s',
    async (active) => {
      const hidden = '<a:extLst xmlns:h="http://schemas.microsoft.com/office/drawing/2010/main"><a:ext uri="{AF507438-7753-43E0-B8FC-AC1667EBCBE1}"><h:hiddenEffects><a:effectDag type="tree"><a:cont name="latent"><a:glow rad="12700"><a:srgbClr val="445566"/></a:glow></a:cont></a:effectDag></h:hiddenEffects></a:ext></a:extLst>'
      const { zip } = await fixture({ slide: shape(2, geometry + active + hidden, ph) })
      zip.file(
        'ppt/presentation.xml',
        (await zip.file('ppt/presentation.xml').async('string')).replace(
          '</p:presentation>',
          '<p:sldSz cx="9144000" cy="5143500"/></p:presentation>'
        )
      )
      const before = await zip.file('ppt/slides/one.xml').async('nodebuffer')
      const result = await projectSemanticImport({
        zip,
        geometryInheritance: true,
        presentation: { slides: [{ id: 'first', elements: [] }, { id: 'second', elements: [] }] },
      })
      const model = result.presentation.pptxSemantic
      const instances = Object.values(model.instances).filter(
        (entry) => model.definitions[entry.definitionId].source.nativeId === '2'
      )
      const instance = instances[0]
      const styleId = model.definitions[instance.definitionId].content.geometrySource.styleId
      const source = model.styles[styleId].payload.hiddenEffects
      expect(source.value.effects.value.kind).toBe('dag')
      const restored = normalizeSemanticPresentation(JSON.parse(JSON.stringify(result.presentation)))
      expect(restored.pptxSemantic.styles[styleId].payload.hiddenEffects).toEqual(source)
      expect(restored.pptxSemantic.styles).toEqual(model.styles)
      for (const sibling of instances) {
        const paint = materializeGeometry(restored.pptxSemantic, sibling.id).style.effects
        expect(paint.effects.map((effect) => effect.kind)).toEqual(active.includes('blur') ? ['blur'] : [])
      }
      const malformed = structuredClone(result.presentation)
      malformed.pptxSemantic.styles[styleId].payload.hiddenEffects.value.effects.value.unknown = true
      expect(() => normalizeSemanticPresentation(malformed)).toThrow()
      for (const target of ['hiddenEffects', 'program']) {
        const mismatched = structuredClone(result.presentation)
        const latent = mismatched.pptxSemantic.styles[styleId].payload.hiddenEffects
        const field = target === 'hiddenEffects' ? latent : latent.value.effects
        field.source.componentLocator.path.push(99)
        expect(() => normalizeSemanticPresentation(mismatched)).toThrow()
      }
      for (const mutation of ['equal', 'parent', 'fabricated', 'relocated']) {
        const forged = structuredClone(result.presentation)
        const latent = forged.pptxSemantic.styles[styleId].payload.hiddenEffects
        latent.value.effects.value = { kind: 'list', effects: [] }
        const parent = latent.source.componentLocator.path
        latent.value.effects.source.componentLocator.path = mutation === 'equal' ? [...parent]
          : mutation === 'parent' ? parent.slice(0, -1) : [...parent, 99]
        if (mutation === 'relocated') {
          latent.source.componentLocator.path = [...parent, 99]
          latent.value.effects.source.componentLocator.path = [...parent, 99, 0]
        }
        expect(() => normalizeSemanticPresentation(forged)).toThrow()
      }
      expect(model.styles[styleId].payload.hiddenEffects).toEqual(source)
      expect(await zip.file('ppt/slides/one.xml').async('nodebuffer')).toEqual(before)
    }
  )
  it('retains authored single centered outlines from direct and selected matrix source', async () => {
    const line =
      '<a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:srgbClr val="445566"/></a:solidFill></a:ln>'
    const reference = '<p:style><a:lnRef idx="1"><a:srgbClr val="112233"/></a:lnRef></p:style>'
    const source = await fixture({
      slide: shape(2, line, ph).replace('</p:sp>', reference + '</p:sp>'),
      matrix: `<a:lnStyleLst>${line}</a:lnStyleLst>`,
    })
    const before = JSON.stringify(source.inventory)
    const result = await buildGeometryStyleSources(source.zip, source.inventory)
    const direct = declaration(result, source.inventory, '2').properties.stroke.value
    const theme = Object.values(result.styles).find((entry) => entry.kind === 'theme')
    for (const stroke of [direct, theme.payload.lineStyles[0].value]) {
      expect(stroke.compound.value).toBe('sng')
      expect(stroke.alignment.value).toBe('ctr')
      expect(stroke.compound.source.partUri).toBe(stroke.alignment.source.partUri)
      expect(stroke.color.value).toEqual({ kind: 'srgb', value: '445566' })
    }
    expect(JSON.stringify(source.inventory)).toBe(before)
  })
  it('keeps shared master paint symbolic and separate immutable host maps', async () => {
    const { zip, inventory } = await fixture()
    const before = JSON.stringify(inventory)
    const result = await buildGeometryStyleSources(zip, inventory)
    const shared = declaration(result, inventory, '4', 'ppt/slideMasters/master.xml')
    expect(shared.properties.fill.value.color.value).toEqual({ kind: 'scheme', value: 'accent1' })
    const first = context(result, inventory),
      second = context(result, inventory, '2', 'ppt/slides/two.xml')
    expect(first.geometry).toEqual(second.geometry)
    expect(first.colorMapIds).not.toEqual(second.colorMapIds)
    expect(first.relationshipChain).toEqual(['ppt/slides/one.xml'])
    expect(first.edges.map((e) => e.source.partUri)).toEqual([
      'ppt/slides/_rels/one.xml.rels',
      'ppt/slideLayouts/_rels/layout.xml.rels',
      'ppt/slideMasters/_rels/master.xml.rels',
    ])
    expect(JSON.stringify(inventory)).toBe(before)
  })
  it('binds unique templates and exact inherited geometry component without hiding decoration', async () => {
    const { zip, inventory } = await fixture()
    const result = await buildGeometryStyleSources(zip, inventory)
    const bound = context(result, inventory)
    const provider = inventory.definitions.find((d) => d.nativeId === '4')
    const component = inventory.definitions.find(
      (d) => d.parentDefinitionId === provider.id && d.kind === 'preset-geometry'
    )
    expect(bound.geometry).toEqual({ definitionId: provider.id, componentId: component.id })
    expect(bound.declarationIds).toHaveLength(3)
    expect(result.templateOccurrenceIds).toHaveLength(4)
    expect(result.templateOccurrenceIds.every((id) => !id.includes('shape:5'))).toBe(true)
    const raw = declaration(result, inventory, '4', provider.partUri).transform.value
    expect(raw.flipH.value).toBe(false)
    expect(raw.rot.value).toBe(0)
    expect(raw.ext.value.cx.value).toBe(0)
  })
  it('distinguishes missing paint from explicit no fill, no line and empty effects', async () => {
    const { zip, inventory } = await fixture({
      slide: shape(2, '<a:noFill/><a:ln w="0"><a:noFill/></a:ln><a:effectLst/>', ph),
    })
    const result = await buildGeometryStyleSources(zip, inventory)
    const direct = declaration(result, inventory, '2')
    expect(direct.properties.fill.value).toEqual({
      color: { source: expect.any(Object), value: { kind: 'none' } },
    })
    expect(direct.properties.stroke.value.width.value).toBe(0)
    expect(direct.properties.stroke.value.color.value).toEqual({ kind: 'none' })
    expect(direct.properties.effects.value).toEqual({ kind: 'list', effects: [] })
    expect(declaration(result, inventory, '3', 'ppt/slideLayouts/layout.xml').properties).toEqual(
      {}
    )
  })
  it('preserves matrix source indices, phClr and ordered transforms without resolved RGB', async () => {
    const reference =
      '<p:style><a:fillRef idx="1001"><a:schemeClr val="accent1"><a:tint val="0"/></a:schemeClr></a:fillRef><a:lnRef idx="1"><a:srgbClr val="2468AC"/></a:lnRef><a:effectRef idx="1"><a:schemeClr val="accent1"/></a:effectRef></p:style>'
    const slide = shape(2, '', ph).replace('</p:sp>', reference + '</p:sp>')
    const matrix =
      '<a:fillStyleLst><a:pattFill prst="pct5"/></a:fillStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"><a:shade val="50000"/><a:alpha val="0"/></a:schemeClr></a:solidFill></a:bgFillStyleLst><a:lnStyleLst><a:ln w="0"><a:noFill/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>'
    const { zip, inventory } = await fixture({ slide, matrix })
    const result = await buildGeometryStyleSources(zip, inventory)
    const refs = declaration(result, inventory, '2').styleRefs
    expect(refs.fillRef.value.index).toBe(1001)
    const theme = result.styles[context(result, inventory).themeId].payload
    const entry = theme.backgroundFillStyles[0]
    expect(entry.source.partUri).toBe('ppt/theme/theme.xml')
    expect(entry.value.color.value.value).toBe('phClr')
    expect(entry.value.color.value.transforms.map((t) => t.value)).toEqual([
      { kind: 'shade', value: 50000 },
      { kind: 'alpha', value: 0 },
    ])
    expect(theme.fillStyles[0].value.pattern.value.preset.value).toBe('pct5')
  })
  it.each([
    ['ambiguous placeholder', { layout: shape(3, '', ph) + shape(6, '', ph) }],
    [
      'duplicate fill',
      { slide: shape(2, '<a:noFill/><a:solidFill><a:srgbClr val="123456"/></a:solidFill>', ph) },
    ],
    ['unsupported selected fill', { slide: shape(2, '<a:blipFill/>', ph) }],
  ])('rejects %s without falling through', async (_, options) => {
    const { zip, inventory } = await fixture(options)
    await expect(buildGeometryStyleSources(zip, inventory)).rejects.toThrow()
  })
  it.each([
    relationship('slideLayout', '../slideLayouts/layout.xml') +
      relationship('slideLayout', '../slideLayouts/layout.xml', 'second'),
    relationship('slideLayout', '../slideLayouts/layout.xml', 'edge', 'External'),
    relationship('slideLayout', '../../../escape.xml'),
    relationship('slideLayout', '../slides/one.xml'),
    relationship('slideLayout', '../slideLayouts/layout.xml') +
      relationship('themeOverride', '../theme/theme.xml', 'override'),
  ])('rejects ambiguous, external, unsafe, cyclic and override relationships: %s', async (xml) => {
    const { zip, inventory } = await fixture()
    const uri = 'ppt/slides/_rels/one.xml.rels'
    const source = rels(xml)
    zip.file(uri, source)
    inventory.parts.find((p) => p.partUri === uri).preconditionHash = createHash('sha256')
      .update(source)
      .digest('hex')
    await expect(buildGeometryStyleSources(zip, inventory)).rejects.toThrow()
  })
  it('rejects changed source hashes and forged occurrence chains', async () => {
    const first = await fixture()
    first.zip.file('ppt/theme/theme.xml', `<a:theme xmlns:a="${A}"/>`)
    await expect(buildGeometryStyleSources(first.zip, first.inventory)).rejects.toThrow('hash')
    const second = await fixture()
    second.inventory.occurrences.find((o) =>
      o.definitionId.includes('shape:4')
    ).relationshipChain[1] = 'forged'
    await expect(buildGeometryStyleSources(second.zip, second.inventory)).rejects.toThrow('chain')
  })
  it.each(['0', '1000', '1001'])(
    'binds native fill matrix index %s without inventing source entries',
    async (index) => {
      const slide = shape(2, transform + geometry).replace(
        '</p:sp>',
        `<p:style><a:fillRef idx="${index}"><a:schemeClr val="accent1"/></a:fillRef></p:style></p:sp>`
      )
      const matrix = '<a:bgFillStyleLst><a:noFill/></a:bgFillStyleLst>'
      const { zip, inventory } = await fixture({ slide, matrix })
      const result = await buildGeometryStyleSources(zip, inventory)
      const binding = context(result, inventory).matrixBindings.fillRef
      expect(binding.index).toBe(Number(index))
      expect(binding.entryIndex).toBe(index === '1001' ? 0 : null)
      if (index === '1001') expect(binding.source.partUri).toBe('ppt/theme/theme.xml')
      else expect(binding.source).toBeUndefined()
    }
  )
  it.each([
    ['1', '<a:fillStyleLst><a:blipFill/></a:fillStyleLst>'],
    ['2', '<a:fillStyleLst><a:noFill/></a:fillStyleLst>'],
    ['1.5', '<a:fillStyleLst><a:noFill/></a:fillStyleLst>'],
  ])(
    'rejects selected unsupported, out-of-range and fractional matrix indices: %s',
    async (index, matrix) => {
      const slide = shape(2, transform + geometry).replace(
        '</p:sp>',
        `<p:style><a:fillRef idx="${index}"><a:schemeClr val="accent1"/></a:fillRef></p:style></p:sp>`
      )
      const { zip, inventory } = await fixture({ slide, matrix })
      await expect(buildGeometryStyleSources(zip, inventory)).rejects.toThrow()
    }
  )
  it('normalizes numeric placeholder indices for matching while preserving authored lexical values', async () => {
    const { zip, inventory } = await fixture({
      slide: shape(2, '', '<p:ph idx="007"/>'),
      layout: shape(3, '', '<p:ph idx="7"/>'),
    })
    const result = await buildGeometryStyleSources(zip, inventory)
    expect(declaration(result, inventory, '2').placeholder.value.idx).toBe('007')
    expect(context(result, inventory).declarationIds).toHaveLength(3)
  })
  it('retains transformed shadow colors, authored zero and false with independent leaf provenance', async () => {
    const { zip, inventory } = await fixture({
      slide: shape(
        2,
        '<a:effectLst><a:outerShdw dist="0" rotWithShape="false"><a:schemeClr val="accent1"><a:alpha val="0"/></a:schemeClr></a:outerShdw></a:effectLst>',
        ph
      ),
    })
    const result = await buildGeometryStyleSources(zip, inventory)
    const shadow = declaration(result, inventory, '2').properties.effects.value.effects[0]
    expect(shadow.value.dist.value).toBe(0)
    expect(shadow.value.rotWithShape.value).toBe(false)
    expect(shadow.value.color.value.transforms[0].value).toEqual({ kind: 'alpha', value: 0 })
    expect(shadow.source.componentLocator.path).not.toEqual(
      shadow.value.color.source.componentLocator.path
    )
  })
  it('rejects recursive theme palette dependencies rather than treating them as resolved colors', async () => {
    const { zip, inventory } = await fixture()
    const uri = 'ppt/theme/theme.xml'
    const xml = `<a:theme xmlns:a="${A}"><a:themeElements><a:clrScheme name="cycle"><a:accent1><a:schemeClr val="accent1"/></a:accent1></a:clrScheme></a:themeElements></a:theme>`
    zip.file(uri, xml)
    inventory.parts.find((p) => p.partUri === uri).preconditionHash = createHash('sha256')
      .update(xml)
      .digest('hex')
    await expect(buildGeometryStyleSources(zip, inventory)).rejects.toThrow('recursive')
  })
})

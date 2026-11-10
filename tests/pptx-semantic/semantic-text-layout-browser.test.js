import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { inflateSync } from 'node:zlib'
import { chromium } from 'playwright'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { createBrowserTextMeasurer } from '../../shared/src/pptx-text-layout-browser.js'

const hash = 'd0332f52868370fd83ae7fa46470f90c8f2eab2fcf12bc4f88080b340c95a830'
let browser, context, page, fontBytes, shapingBytes
// Decode the existing dependency asset losslessly; no generated glyphs/metrics.
function sfntFromWoff(woff) {
  const count = woff.readUInt16BE(12), bytes = Buffer.alloc(woff.readUInt32BE(16))
  const exponent = Math.floor(Math.log2(count))
  bytes.writeUInt32BE(woff.readUInt32BE(4), 0); bytes.writeUInt16BE(count, 4)
  bytes.writeUInt16BE(16 * 2 ** exponent, 6); bytes.writeUInt16BE(exponent, 8)
  bytes.writeUInt16BE(count * 16 - 16 * 2 ** exponent, 10)
  let offset = 12 + 16 * count, headOffset = 0
  for (let i = 0; i < count; i++) {
    const at = 44 + 20 * i, entry = 12 + 16 * i, source = woff.readUInt32BE(at + 4)
    const compressed = woff.readUInt32BE(at + 8), length = woff.readUInt32BE(at + 12)
    const data = woff.subarray(source, source + compressed)
    woff.copy(bytes, entry, at, at + 4)
    bytes.writeUInt32BE(woff.readUInt32BE(at + 16), entry + 4)
    bytes.writeUInt32BE(offset, entry + 8); bytes.writeUInt32BE(length, entry + 12)
    ;(compressed < length ? inflateSync(data) : data).copy(bytes, offset)
    if (woff.toString('ascii', at, at + 4) === 'head') headOffset = offset
    offset += (length + 3) & ~3
  }
  bytes.writeUInt32BE(0, headOffset + 8)
  let sum = 0
  for (let i = 0; i < bytes.length; i += 4) sum = (sum + bytes.readUInt32BE(i)) >>> 0
  bytes.writeUInt32BE((0xb1b0afba - sum) >>> 0, headOffset + 8)
  return bytes
}
beforeAll(async () => {
  expect(typeof createBrowserTextMeasurer).toBe('function')
  fontBytes = await readFile('server/vendor/katex/dist/fonts/KaTeX_Main-Regular.ttf')
  expect(createHash('sha256').update(fontBytes).digest('hex')).toBe(hash)
  const woff = await readFile('node_modules/reveal.js/css/theme/fonts/source-sans-pro/source-sans-pro-regular.woff')
  expect(createHash('sha256').update(woff).digest('hex')).toBe('d4eaa48ba450f4dd2d024ab5b0e895c73c81475718e5453fd1890254c16b7a57')
  shapingBytes = sfntFromWoff(woff)
  expect(createHash('sha256').update(shapingBytes).digest('hex')).toBe('c1865d89d798bc2119872b17774361c7406974b9568121a617007e02af344981')
  const modules = ['pptx-text-document', 'pptx-text-layout-font', 'pptx-text-layout-plan',
    'pptx-text-layout-browser-line', 'pptx-text-layout-browser', 'pptx-text-layout-wrap', 'pptx-text-layout']
  const source = (await Promise.all(modules.map(async (name) =>
    `factories['${name}']=(module,require)=>{${await readFile(`shared/src/${name}.js`, 'utf8')}\n};`))).join('\n')
  browser = await chromium.launch({ headless: true })
  context = await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1, locale: 'en-US' })
  page = await context.newPage()
  await page.route('http://127.0.0.1/text-layout-unit', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }))
  await page.goto('http://127.0.0.1/text-layout-unit')
  await page.addScriptTag({ content: `const factories={},loaded={}; ${source}
    globalThis.load=(name)=>{name=name.replace(/^\\.\\//,'').replace(/\\.js$/,'');
    if(!loaded[name]){const m={exports:{}};loaded[name]=m;factories[name](m,globalThis.load)}return loaded[name].exports};` })
}, 30000)
afterAll(async () => { await context?.close(); await browser?.close() })

async function measure(change = {}, bytes = fontBytes) {
  return page.evaluate(async ({ bytes, hash, change }) => {
    const fontProfile = { schemaVersion: 1, faces: [{ id: 'main', typeface: 'Fixture Main', assetHash: change.assetHash ?? hash }] }
    const boundary = await globalThis.load('pptx-text-layout-browser').createBrowserTextMeasurer({
      document, fontProfile, assets: [{ faceId: 'main',
        bytes: Uint8Array.from(atob(bytes), (character) => character.charCodeAt(0)).buffer }],
    })
    const input = {
      document: { schemaVersion: 1, componentId: 'body',
        body: { insetLeftEmu: 12700, insetRightEmu: 0, insetTopEmu: 25400, insetBottomEmu: 0,
          wrap: false, verticalText: 'horz', verticalAlign: 't', autofit: { mode: 'none' }, ...change.body },
        paragraphs: [{ componentId: 'p', properties: change.paragraph ?? {},
          defaultRunProperties: { fontSizePt: 12, fontLatin: { typeface: 'Fixture Main' }, ...change.defaults },
          runs: change.runs ?? [{ componentId: 'small', kind: 'text', text: 'M' },
            { componentId: 'large', kind: 'text', text: 'M', properties: { fontSizePt: 24 } }] }] },
      shape: { widthEmu: change.widthEmu ?? 1905000, heightEmu: 952500, textRectEmu: { l: 1000, t: 2000, r: change.widthEmu ?? 1905000, b: 952500 } },
      fontProfile, rendererProfile: boundary.profile,
    }
    const before = JSON.stringify(input), engine = globalThis.load('pptx-text-layout')
    try {
      const result = engine.layoutTextDocument(input, boundary)
      const again = engine.layoutTextDocument(input, boundary)
      const intact = before === JSON.stringify(input)
      if (result.lines.length) result.lines[0].width = -1
      const pristine = engine.layoutTextDocument(input, boundary)
      let comparisons
      if (change.compareShaping) {
        const split = structuredClone(input)
        split.document.paragraphs[0].runs = ['A', 'V'].map((text) => ({ componentId: text, kind: 'text', text }))
        const splitWidth = engine.layoutTextDocument(split, boundary).lines[0].width
        split.document.paragraphs[0].defaultRunProperties.kerningPt = 24
        comparisons = { splitWidth, disabledWidth: engine.layoutTextDocument(split, boundary).lines[0].width }
      }
      if (change.stale === 'dpr') input.rendererProfile = { ...boundary.profile, devicePixelRatio: 2 }
      if (change.stale === 'font') input.fontProfile.faces[0].assetHash = 'a'.repeat(64)
      if (change.invalidate) {
        const frame = document.querySelector('iframe[data-pptx-text-measurement]')
        frame.contentDocument.fonts.clear()
      }
      const after = engine.layoutTextDocument(input, boundary)
      return { result: again, intact, pristine, after, profile: boundary.profile, comparisons }
    } finally { boundary.dispose() }
  }, { bytes: bytes.toString('base64'), hash: createHash('sha256').update(bytes).digest('hex'), change })
}

describe('actual Chromium shaping at the pinned asset font and DPR', () => {
  it('preserves Source Sans Pro kerning across same-style canonical run boundaries', async () => {
    const { result, comparisons } = await measure({ defaults: { kerningPt: 0 }, compareShaping: true,
      runs: [{ componentId: 'whole', kind: 'text', text: 'AV' }] }, shapingBytes)
    expect(result.status).toBe('measured')
    expect(comparisons.splitWidth).toBeCloseTo(result.lines[0].width, 2)
    expect(result.lines[0].width).toBeLessThan(comparisons.disabledWidth)
  })

  it.each(['dpr', 'font'])('refuses a stale %s identity before cache reuse', async (stale) => {
    const { after } = await measure({ stale })
    expect(after).toMatchObject({ status: 'unsupported', qualified: false, lines: [],
      issues: [expect.objectContaining({ code: 'measurement-profile-mismatch' })] })
  })

  it('refuses a declared hash that does not match the actual loaded asset bytes', async () => {
    const { result } = await measure({ assetHash: 'b'.repeat(64) })
    expect(result.status).toBe('unsupported')
    expect(result.issues.every((issue) => issue.code === 'font-asset-hash-mismatch')).toBe(true)
  })

  it('measures mixed 12/24pt runs from 917/1000-em M advances with one actual baseline', async () => {
    const { result, intact, pristine, profile } = await measure()
    expect(result).toMatchObject({ status: 'measured', qualified: false, issues: [] })
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].width).toBeCloseTo(917 / 1000 * (16 + 32), 1)
    const [small, large] = result.lines[0].runs
    expect(small.baseline).toBeCloseTo(large.baseline, 5)
    expect(small.rects[0].y).toBeGreaterThan(large.rects[0].y)
    expect(small.sourceFontSizePt).toBe(12)
    expect(large.sourceFontSizePt).toBe(24)
    expect(intact).toBe(true)
    expect(pristine.lines[0].width).toBeGreaterThan(0)
    expect(profile.devicePixelRatio).toBe(1)
    expect(profile.userAgent).toMatch(/Chrome/)
  })

  it('honors explicit breaks, exact point spacing and cached field text', async () => {
    const { result } = await measure({
      paragraph: { lineSpacing: { unit: 'points', value: 24 } },
      runs: [{ componentId: 'a', kind: 'text', text: 'M' }, { componentId: 'br', kind: 'break' },
        { componentId: 'f', kind: 'field', text: '08/07', field: { id: 'date', type: 'datetime' } }],
    })
    expect(result.lines).toHaveLength(2)
    expect(result.lines[1].baseline - result.lines[0].baseline).toBeCloseTo(32, 5)
    expect(result.lines[1].runs[0].text).toBe('08/07')
  })

  it('uses only declared normal autofit scaling, including less than 8px, without source mutation', async () => {
    const { result, intact } = await measure({
      body: { autofit: { mode: 'normal', fontScale: 50000, lineSpaceReduction: 0 } },
      runs: [{ componentId: 'tiny', kind: 'text', text: 'M', properties: { fontSizePt: 5.125 } }],
    })
    expect(result.status).toBe('measured')
    expect(result.lines[0].runs[0]).toMatchObject({ sourceFontSizePt: 5.125, fontSizePt: 2.5625 })
    expect(result.lines[0].width).toBeCloseTo(917 / 1000 * 2.5625 * 4 / 3, 1)
    expect(intact).toBe(true)
  })

  it.each(['l', 'ctr', 'r'])('positions a measured %s tab field without text-length estimates', async (alignment) => {
    const { result } = await measure({
      paragraph: { tabs: [{ positionEmu: 914400, alignment }] },
      runs: [{ componentId: 'r', kind: 'text', text: 'M\tM' }],
    })
    expect(result.status).toBe('measured')
    const afterTab = result.lines[0].runs.filter((run) => run.text === 'M')[1]
    const width = 917 / 1000 * 16, adjust = alignment === 'ctr' ? width / 2 : alignment === 'r' ? width : 0
    expect(afterTab.rects[0].x).toBeCloseTo(13700 / 9525 + 96 - adjust, 1)
  })

  it('measures authored character bullets at hanging indent and reports real overflow without shrink', async () => {
    const { result } = await measure({ widthEmu: 300000,
      paragraph: { marginLeftEmu: 127000, indentEmu: -127000, bullet: { kind: 'character', character: '+' } } })
    expect(result.status).toBe('measured')
    expect(result.overflow.horizontal).toBe(true)
    expect(result.lines[0].bullet.text).toBe('+')
    expect(result.lines[0].bullet.rects[0].x).toBeLessThan(result.lines[0].runs[0].rects[0].x)
    expect(result.lines[0].runs[1].fontSizePt).toBe(24)
  })

  it('refuses glyph fallback even when FontFaceSet reports the exact family loaded', async () => {
    const { result } = await measure({ defaults: { fontEastAsian: { typeface: 'Fixture Main' } },
      runs: [{ componentId: 'missing', kind: 'text', text: '\u6f22' }] })
    expect(result).toMatchObject({ status: 'unsupported', qualified: false, lines: [],
      issues: [expect.objectContaining({ code: 'font-glyph-missing', componentId: 'missing' })] })
  })

  it('checks live font membership before serving cached measurement', async () => {
    const { result, after } = await measure({ invalidate: true })
    expect(result.status).toBe('measured')
    expect(after).toMatchObject({ status: 'unsupported', qualified: false, lines: [],
      issues: [expect.objectContaining({ code: 'stale-browser-profile' })] })
  })
})

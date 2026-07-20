const crypto = require('node:crypto')
const JSZip = require('jszip')
const { inspectEmbeddedWorkbook } = require('./embedded-workbook-inventory')

const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
const esc = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')

function patchCell(xml, cell, value) {
  const pattern = new RegExp(
    `(<(?:\\w+:)?c\\b[^>]*\\br=["']${cell}["'][^>]*>)([\\s\\S]*?)(<\\/(?:\\w+:)?c>)`, 'i'
  )
  const match = xml.match(pattern)
  if (!match) throw new Error(`Workbook cell ${cell} is missing`)
  if (/<(?:\w+:)?f\b/i.test(match[2])) {
    const error = new Error(`Workbook cell ${cell} contains a formula`)
    error.code = 'FORMULA_CELL_BLOCKED'
    throw error
  }
  if (!Number.isFinite(Number(value))) throw new TypeError('Chart MVP values must be numeric literals')
  const body = /<(?:\w+:)?v>[\s\S]*?<\/(?:\w+:)?v>/i.test(match[2])
    ? match[2].replace(/(<(?:\w+:)?v>)[\s\S]*?(<\/(?:\w+:)?v>)/i, `$1${value}$2`)
    : `${match[2]}<v>${value}</v>`
  return xml.replace(pattern, `$1${body}$3`)
}

function patchCache(xml, formula, values) {
  const refs = [...xml.matchAll(
    /<(?:\w+:)?numRef\b[^>]*>[\s\S]*?<\/(?:\w+:)?numRef>/gi
  )]
  const ref = refs.find((match) => {
    const own = match[0].match(/<(?:\w+:)?f>([\s\S]*?)<\/(?:\w+:)?f>/i)?.[1]?.trim()
    return own === formula
  })
  if (!ref) throw new Error(`Chart cache formula ${formula} is missing`)
  const points = values.map((value, index) =>
    `<c:pt idx="${index}"><c:v>${esc(value)}</c:v></c:pt>`).join('')
  let patched = ref[0].replace(
    /<(?:\w+:)?ptCount\b[^>]*\/>/i, `<c:ptCount val="${values.length}"/>`
  )
  const cache = patched.match(/<(?:\w+:)?numCache\b[^>]*>([\s\S]*?)<\/(?:\w+:)?numCache>/i)
  if (!cache) throw new Error(`Chart cache for ${formula} is missing`)
  const body = cache[1].replace(/<(?:\w+:)?pt\b[\s\S]*?<\/(?:\w+:)?pt>/gi, '')
  patched = patched.replace(cache[0], `<c:numCache>${body}${points}</c:numCache>`)
  return xml.slice(0, ref.index) + patched + xml.slice(ref.index + ref[0].length)
}

function blocked(reason) {
  return { ok: false, status: 'preserve-only', reason }
}

function createNativeChartAdapter() {
  return Object.freeze({
    async applyDataPatch(bytes, request) {
      if (request.shared) return blocked('shared-workbook')
      if (request.external) return blocked('external-workbook-link')
      const zip = await JSZip.loadAsync(bytes, { checkCRC32: true })
      const workbookFile = zip.file(request.workbookPath)
      const chartFile = zip.file(request.chartPath)
      if (!workbookFile || !chartFile) return blocked('malformed-workbook')
      const workbookBytes = await workbookFile.async('nodebuffer')
      const inventory = await inspectEmbeddedWorkbook(workbookBytes)
      if (!inventory.editable) return blocked(inventory.reason)
      try {
        const workbookZip = await JSZip.loadAsync(workbookBytes, { checkCRC32: true })
        for (const update of request.cells || []) {
          const sheet = inventory.sheets.find((item) => item.name === update.sheet)
          const file = sheet && workbookZip.file(sheet.part)
          if (!file) throw new Error(`Workbook sheet ${update.sheet} is missing`)
          let xml = await file.async('string')
          xml = patchCell(xml, update.cell, update.value)
          workbookZip.file(sheet.part, xml)
        }
        let chartXml = await chartFile.async('string')
        for (const update of request.caches || []) {
          chartXml = patchCache(chartXml, update.formula, update.values)
        }
        const outputWorkbook = await workbookZip.generateAsync({
          type: 'nodebuffer', compression: 'DEFLATE',
        })
        zip.file(request.workbookPath, outputWorkbook)
        zip.file(request.chartPath, chartXml)
        const output = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
        return {
          ok: true,
          bytes: output,
          sourceHash: hash(Buffer.from(chartXml)),
          impactClosure: [request.workbookPath, request.chartPath],
          authority: 'embedded-workbook',
        }
      } catch (error) {
        return { ...blocked(error.code || 'atomic-update-failed'), error: error.message }
      }
    },
    async applyStylePatch(bytes, request) {
      const zip = await JSZip.loadAsync(bytes, { checkCRC32: true })
      const chart = zip.file(request.chartPath)
      if (!chart) return blocked('missing-chart')
      const before = request.workbookPath
        ? await zip.file(request.workbookPath)?.async('nodebuffer') : null
      const xml = await chart.async('string')
      const patched = request.patch(xml)
      zip.file(request.chartPath, patched)
      const output = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
      return {
        ok: true, bytes: output, impactClosure: [request.chartPath],
        workbookHash: before ? hash(before) : null,
      }
    },
  })
}

module.exports = { createNativeChartAdapter, patchCache, patchCell }

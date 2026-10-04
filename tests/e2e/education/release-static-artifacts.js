import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import JSZip from 'jszip'
import { createWorker, OEM, PSM } from 'tesseract.js'
import localEnglish from '@tesseract.js-data/eng'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import jsQR from 'jsqr'

function bluePixels(context, width, height) {
  const bytes = context.getImageData(0, 0, width, height).data
  let count = 0
  for (let index = 0; index < bytes.length; index += 4) {
    if (bytes[index + 2] > 170 && bytes[index + 2] > bytes[index] * 1.4 && bytes[index + 1] < 170)
      count++
  }
  return count
}
export async function decodeQrRaster(path) {
  const image = await loadImage(await fs.readFile(path)),
    canvas = createCanvas(image.width, image.height)
  const context = canvas.getContext('2d')
  context.drawImage(image, 0, 0)
  return (
    jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)
      ?.data || null
  )
}

const clientRequire = createRequire(path.resolve(__dirname, '../../../client/package.json'))
function greenPixels(context, width, height) {
  const bytes = context.getImageData(0, 0, width, height).data
  let count = 0
  for (let index = 0; index < bytes.length; index += 4) {
    const [r, g, b] = bytes.subarray(index, index + 3)
    if ((r > 205 && r < 230 && g > 240 && b > 220 && b < 240) || (g > r * 1.5 && g > b * 1.1))
      count++
  }
  return count
}
function createEnglishWorker() {
  return createWorker('eng', OEM.LSTM_ONLY, {
    langPath: localEnglish.langPath,
    gzip: localEnglish.gzip,
    cacheMethod: 'none',
  })
}

function xmlText(value) {
  return value.replace(/&#(x[\da-f]+|\d+);|&(amp|lt|gt|quot|apos);/gi, (_match, number, name) =>
    number
      ? String.fromCodePoint(
          number[0].toLowerCase() === 'x' ? parseInt(number.slice(1), 16) : Number(number)
        )
      : { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[name.toLowerCase()]
  )
}

async function visibleChartText(zip, slide, xml) {
  const ids = new Set(
    [...xml.matchAll(/<c:chart\b[^>]*\br:id="([^"]+)"/g)].map((match) => match[1])
  )
  if (!ids.size) return []
  const rels = zip.file(`ppt/slides/_rels/${path.posix.basename(slide)}.rels`)
  if (!rels) throw new Error(`Slide chart relationships are missing: ${slide}`)
  const texts = []
  for (const match of (await rels.async('string')).matchAll(/<Relationship\b[^>]*\/>/g)) {
    const attributes = Object.fromEntries(
      [...match[0].matchAll(/\b([\w:]+)="([^"]*)"/g)].map((attribute) => [
        attribute[1],
        xmlText(attribute[2]),
      ])
    )
    if (
      !ids.has(attributes.Id) ||
      !attributes.Type?.endsWith('/chart') ||
      attributes.TargetMode === 'External'
    )
      continue
    const target = path.posix.resolve('/', path.posix.dirname(slide), attributes.Target).slice(1)
    const entry = zip.file(target)
    if (!entry) throw new Error(`Referenced chart is missing: ${target}`)
    const chart = await entry.async('string')
    const legend = chart.match(/<c:legend\b[\s\S]*?<\/c:legend>/)?.[0] || ''
    const hiddenEntries = new Set(
      [...legend.matchAll(/<c:legendEntry\b[\s\S]*?<\/c:legendEntry>/g)]
        .filter((entry) => /<c:delete\b[^>]*val="(?:1|true)"/.test(entry[0]))
        .map((entry) => entry[0].match(/<c:idx\b[^>]*val="(\d+)"/)?.[1])
    )
    const pie = /<c:(?:pie|doughnut)Chart\b/.test(chart)
    const categoryAxis = [...chart.matchAll(/<c:catAx\b[\s\S]*?<\/c:catAx>/g)].some(
      (axis) => !/<c:delete\b[^>]*val="(?:1|true)"|<c:tickLblPos\b[^>]*val="none"/.test(axis[0])
    )
    const categoriesVisible = (pie && legend) || categoryAxis
    if (legend && !pie) {
      for (const series of chart.matchAll(/<c:ser\b[\s\S]*?<\/c:ser>/g)) {
        if (hiddenEntries.has(series[0].match(/<c:idx\b[^>]*val="(\d+)"/)?.[1])) continue
        const title = series[0].match(/<c:tx\b[\s\S]*?<\/c:tx>/)?.[0] || ''
        texts.push(
          ...[...title.matchAll(/<c:v>([\s\S]*?)<\/c:v>/g)].map((value) => xmlText(value[1]))
        )
      }
    }
    if (categoriesVisible) {
      for (const category of chart.matchAll(/<c:cat\b[\s\S]*?<\/c:cat>/g)) {
        for (const point of category[0].matchAll(
          /<c:pt\b[^>]*idx="(\d+)"[^>]*>[\s\S]*?<\/c:pt>/g
        )) {
          if (pie && hiddenEntries.has(point[1])) continue
          texts.push(
            ...[...point[0].matchAll(/<c:v>([\s\S]*?)<\/c:v>/g)].map((value) => xmlText(value[1]))
          )
        }
      }
    }
    for (const title of chart.matchAll(/<c:title\b[\s\S]*?<\/c:title>/g)) {
      texts.push(
        ...[...title[0].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((value) => xmlText(value[1]))
      )
    }
  }
  return texts
}
export async function decodePdf(filePath, rasterPath) {
  const pdfjs = await import(
    pathToFileURL(clientRequire.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href
  )
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await fs.readFile(filePath)),
    useSystemFonts: true,
  })
  let worker
  try {
    const document = await loadingTask.promise
    const pages = [],
      artifacts = [filePath],
      ocr = []
    let solutions = 0,
      authoredBluePixels = 0
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number)
      const nativeText = (await page.getTextContent()).items
        .filter((item) => typeof item.str === 'string')
        .map((item) => item.str)
        .join(' ')
      const viewport = page.getViewport({ scale: 1.5 })
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
      const context = canvas.getContext('2d')
      await page.render({ canvasContext: context, viewport }).promise
      solutions += greenPixels(context, canvas.width, canvas.height)
      authoredBluePixels += bluePixels(context, canvas.width, canvas.height)
      const raster = `${rasterPath}-${number}.png`
      await fs.writeFile(raster, canvas.toBuffer('image/png'))
      artifacts.push(raster)
      let text = nativeText
      if (!nativeText.trim()) {
        worker ||= await createEnglishWorker()
        const result = await worker.recognize(canvas.toBuffer('image/png'))
        text = result.data.text
        ocr.push({ page: number, text, confidence: result.data.confidence })
      }
      pages.push(text)
    }
    return {
      text: pages.join('\n'),
      ocr,
      pageCount: document.numPages,
      solutionPixels: solutions,
      authoredBluePixels,
      artifacts,
    }
  } finally {
    try {
      if (worker) await worker.terminate()
    } finally {
      await loadingTask.destroy()
    }
  }
}
export async function decodePptx(filePath, outputPrefix) {
  const zip = await JSZip.loadAsync(await fs.readFile(filePath))
  const slides = Object.values(zip.files).filter((entry) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(entry.name)
  )
  const nativePalette = new Set()
  const texts = await Promise.all(
    slides.map(async (entry) => {
      const xml = await entry.async('string')
      for (const match of xml.matchAll(/<a:srgbClr\s+val="([0-9a-f]{6})"/gi))
        nativePalette.add(match[1].toLowerCase())
      const text = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((match) => xmlText(match[1]))
      text.push(...(await visibleChartText(zip, entry.name, xml)))
      return text.join(' ')
    })
  )
  const media = Object.values(zip.files).filter(
    (entry) => entry.name.startsWith('ppt/media/') && /\.(png|jpe?g)$/i.test(entry.name)
  )
  const worker = media.length ? await createEnglishWorker() : null
  const artifacts = [filePath],
    recognized = []
  let solutions = 0,
    authoredBluePixels = 0
  try {
    if (worker) await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT })
    for (const [index, entry] of media.entries()) {
      const bytes = await entry.async('nodebuffer')
      const file = `${outputPrefix}-${index}.${entry.name.split('.').at(-1)}`
      await fs.writeFile(file, bytes)
      artifacts.push(file)
      const image = await loadImage(bytes),
        canvas = createCanvas(image.width, image.height)
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0)
      solutions += greenPixels(context, canvas.width, canvas.height)
      authoredBluePixels += bluePixels(context, canvas.width, canvas.height)
      const result = await worker.recognize(bytes)
      recognized.push({
        media: entry.name,
        text: result.data.text,
        confidence: result.data.confidence,
      })
    }
  } finally {
    if (worker) await worker.terminate()
  }
  return {
    text: [...texts, ...recognized.map((item) => item.text)].join('\n'),
    solutionPixels: solutions,
    authoredBluePixels,
    nativeText: texts,
    nativePalette: [...nativePalette],
    ocr: recognized,
    slideCount: slides.length,
    artifacts,
  }
}

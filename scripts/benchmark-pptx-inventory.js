#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { ensureDir, writeJson } = require('./pptx-parser-benchmark/json-utils')
const {
  assertInsidePlanResearch,
  loadPptxWithBudget,
} = require('./pptx-parser-benchmark/pptx-guards')

const EMU_PER_INCH = 914400
const PX_PER_INCH = 96

function parseArgs(argv) {
  const args = { input: 'PPTX', out: 'plans/20260424-1508-pptx-parser-benchmark-hard/research/corpus-inventory' }
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--input') args.input = argv[(i += 1)]
    else if (argv[i] === '--out') args.out = argv[(i += 1)]
  }
  return args
}

function countMatches(text, regex) {
  return (text.match(regex) || []).length
}

function slideNumber(fileName) {
  const match = fileName.match(/slide(\d+)\.xml$/)
  return match ? Number(match[1]) : 0
}

function sortSlideFiles(files) {
  return files.sort((a, b) => slideNumber(a) - slideNumber(b))
}

function getPackageCounts(entries) {
  return {
    slides: entries.filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry)).length,
    slideLayouts: entries.filter((entry) => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(entry)).length,
    slideMasters: entries.filter((entry) => /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(entry)).length,
    notesSlides: entries.filter((entry) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(entry)).length,
    media: entries.filter((entry) => /^ppt\/media\//.test(entry)).length,
    charts: entries.filter((entry) => /^ppt\/charts\//.test(entry)).length,
    embeddings: entries.filter((entry) => /^ppt\/embeddings\//.test(entry)).length,
  }
}

function getMediaExtensions(entries) {
  return entries
    .filter((entry) => /^ppt\/media\//.test(entry))
    .reduce((extensions, entry) => {
      const ext = path.extname(entry).slice(1).toLowerCase() || 'none'
      extensions[ext] = (extensions[ext] || 0) + 1
      return extensions
    }, {})
}

function getSlideSize(presentationXml) {
  const match = presentationXml.match(/<p:sldSz[^>]*\scx="(\d+)"[^>]*\scy="(\d+)"/)
  if (!match) return { emu: null, px: null }
  const emu = { width: Number(match[1]), height: Number(match[2]) }
  return {
    emu,
    px: {
      width: Math.round((emu.width / EMU_PER_INCH) * PX_PER_INCH),
      height: Math.round((emu.height / EMU_PER_INCH) * PX_PER_INCH),
    },
  }
}

function countSlideObjects(xml) {
  return {
    shapes: countMatches(xml, /<p:sp\b/g),
    pictures: countMatches(xml, /<p:pic\b/g),
    graphicFrames: countMatches(xml, /<p:graphicFrame\b/g),
    groups: countMatches(xml, /<p:grpSp\b/g),
    connectors: countMatches(xml, /<p:cxnSp\b/g),
    tables: countMatches(xml, /<a:tbl\b/g),
    charts: countMatches(xml, /c:chart/g),
    placeholders: countMatches(xml, /<p:ph\b/g),
    hyperlinks: countMatches(xml, /<a:hlinkClick\b/g),
    mathNodes: countMatches(xml, /<m:oMath/g),
    oleObjects: countMatches(xml, /<p:oleObj\b/g),
    smartArtRefs: countMatches(xml, /<dgm:relIds\b/g),
  }
}

function riskReasons(counts) {
  const reasons = []
  if (counts.tables) reasons.push('table')
  if (counts.groups) reasons.push('group')
  if (counts.connectors) reasons.push('connector')
  if (counts.oleObjects) reasons.push('ole')
  if (counts.mathNodes) reasons.push('equation')
  if (counts.smartArtRefs) reasons.push('smart-art')
  if (counts.graphicFrames || counts.charts) reasons.push('graphic-frame')
  return reasons
}

async function analyzeDeck(filePath) {
  const { buffer, zip } = await loadPptxWithBudget(filePath)
  const entries = Object.keys(zip.files).filter((entry) => !zip.files[entry].dir).sort()
  const slideFiles = sortSlideFiles(entries.filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry)))
  const presentationXml = zip.file('ppt/presentation.xml')
    ? await zip.file('ppt/presentation.xml').async('string')
    : ''
  const slides = []

  for (const slidePath of slideFiles) {
    const xml = await zip.file(slidePath).async('string')
    const counts = countSlideObjects(xml)
    const reasons = riskReasons(counts)
    slides.push({
      slideIndex: slideNumber(slidePath),
      slidePath,
      counts,
      riskScore: reasons.length + counts.tables + counts.oleObjects + counts.mathNodes,
      riskReasons: reasons,
    })
  }

  return {
    deck: path.basename(filePath, '.pptx'),
    fileName: path.basename(filePath),
    fileSizeBytes: buffer.byteLength,
    slideCount: slideFiles.length,
    size: getSlideSize(presentationXml),
    packageCounts: getPackageCounts(entries),
    mediaExtensions: getMediaExtensions(entries),
    slides,
    highRiskSlides: [...slides]
      .sort((a, b) => b.riskScore - a.riskScore || a.slideIndex - b.slideIndex)
      .slice(0, 3),
  }
}

function totals(decks) {
  return decks.reduce(
    (sum, deck) => {
      sum.slideCount += deck.slideCount
      for (const [key, value] of Object.entries(deck.packageCounts)) {
        sum.packageCounts[key] = (sum.packageCounts[key] || 0) + value
      }
      return sum
    },
    { deckCount: decks.length, slideCount: 0, packageCounts: {} }
  )
}

function writeReport(planDir, summary) {
  const lines = [
    '# Corpus Ground Truth',
    '',
    `Generated: ${summary.generatedAt}`,
    '',
    '| Deck | Slides | Layouts | Masters | Notes | Media | Charts | Embeddings | High-risk slides |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
  ]
  for (const deck of summary.decks) {
    const risky = deck.highRiskSlides
      .map((slide) => `${slide.slideIndex} (${slide.riskReasons.join(', ') || 'mixed'})`)
      .join('; ')
    lines.push(`| ${deck.fileName} | ${deck.slideCount} | ${deck.packageCounts.slideLayouts} | ${deck.packageCounts.slideMasters} | ${deck.packageCounts.notesSlides} | ${deck.packageCounts.media} | ${deck.packageCounts.charts} | ${deck.packageCounts.embeddings} | ${risky} |`)
  }
  lines.push('', '## Totals', '', `- Decks: ${summary.totals.deckCount}`, `- Slides: ${summary.totals.slideCount}`, `- Media: ${summary.totals.packageCounts.media || 0}`, `- Embeddings: ${summary.totals.packageCounts.embeddings || 0}`)
  lines.push('', '## Manual QA Targets', '')
  for (const deck of summary.decks) {
    for (const slide of deck.highRiskSlides) {
      lines.push(`- ${deck.fileName} slide ${slide.slideIndex}: inspect ${slide.riskReasons.join(', ') || 'mixed object coverage'}.`)
    }
  }
  const reportPath = path.join(planDir, 'reports', 'corpus-ground-truth.md')
  ensureDir(path.dirname(reportPath))
  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`)
}

async function main() {
  const args = parseArgs(process.argv)
  const inputDir = path.resolve(args.input)
  const outDir = assertInsidePlanResearch(args.out)
  const planDir = path.dirname(path.dirname(outDir))
  const decks = []

  ensureDir(outDir)
  for (const fileName of fs.readdirSync(inputDir).filter((file) => file.endsWith('.pptx')).sort()) {
    const deck = await analyzeDeck(path.join(inputDir, fileName))
    decks.push(deck)
    writeJson(path.join(outDir, `${deck.deck}.json`), deck)
  }

  const summary = { generatedAt: new Date().toISOString(), decks, totals: totals(decks) }
  writeJson(path.join(outDir, 'summary.json'), summary)
  writeReport(planDir, summary)
  console.log(`Wrote inventory for ${decks.length} decks and ${summary.totals.slideCount} slides.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

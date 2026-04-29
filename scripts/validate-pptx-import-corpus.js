#!/usr/bin/env node
const fs = require('fs').promises
const path = require('path')
const { importPptxFile } = require('../server/services/pptx-import/importer')

const EXPECTED_COUNTS = new Map([
  ['Bai_2_1.pptx', 41],
  ['Bai_2_2.pptx', 39],
  ['Bai_2_5.pptx', 45],
  ['STTre_Duc.pptx', 20],
])

function getInputDir() {
  const index = process.argv.indexOf('--input')
  return index >= 0 ? process.argv[index + 1] : 'PPTX'
}

async function pathExists(target) {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

async function main() {
  const inputDir = path.resolve(getInputDir())
  if (!(await pathExists(inputDir))) {
    console.log(`PPTX corpus not found at ${inputDir}; skipping optional corpus validation.`)
    return
  }

  const tempUploads = path.resolve('server/data/tmp-pptx-corpus-validation')
  await fs.rm(tempUploads, { recursive: true, force: true })
  await fs.mkdir(tempUploads, { recursive: true })

  let totalSlides = 0
  const failures = []
  for (const [deck, expectedSlides] of EXPECTED_COUNTS.entries()) {
    const filePath = path.join(inputDir, deck)
    try {
      const result = await importPptxFile(filePath, { originalName: deck, uploadsDir: tempUploads })
      const actual = result.stats.slideCount
      totalSlides += actual
      if (actual !== expectedSlides) {
        failures.push(`${deck}: expected ${expectedSlides} slides, got ${actual}`)
      }
      console.log(`${deck}: ${actual} slides, ${result.warnings.length} warning(s)`)
    } catch (err) {
      failures.push(`${deck}: ${err.message}`)
    }
  }

  await fs.rm(tempUploads, { recursive: true, force: true })
  if (totalSlides !== 145) failures.push(`total slides: expected 145, got ${totalSlides}`)
  if (failures.length) {
    console.error(failures.join('\n'))
    process.exitCode = 1
    return
  }
  console.log('PPTX corpus validation passed: 4 decks, 145 slides, no process crash.')
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

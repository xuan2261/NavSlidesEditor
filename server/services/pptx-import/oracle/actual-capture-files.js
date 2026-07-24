const crypto = require('node:crypto')
const fs = require('fs-extra')
const path = require('node:path')
const { decodePng } = require('./png-rgba')
const { coded } = require('./http-boundary')

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')

async function collectActualSlides(files, outDir, deckStem) {
  if (!Array.isArray(files) || files.length === 0) throw coded('missing-actual-captures')
  const deckDir = path.resolve(outDir, deckStem)
  const slides = []
  for (let index = 0; index < files.length; index += 1) {
    const expected = path.join(deckDir, `slide-${index}.png`)
    if (path.resolve(files[index]) !== expected) throw coded('invalid-actual-capture-path')
    const bytes = await fs.readFile(expected).catch(() => { throw coded('actual-capture-read-failed') })
    let decoded
    try { decoded = decodePng(bytes) } catch { throw coded('invalid-actual-capture-png') }
    slides.push({
      index, path: `${deckStem}/slide-${index}.png`, sha256: sha256(bytes), byteLength: bytes.length,
      width: decoded.width, height: decoded.height,
    })
  }
  return slides
}

module.exports = { collectActualSlides }

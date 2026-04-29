const fs = require('fs-extra')
const { classifyError, sanitizeDiagnostic } = require('./diagnostics')
const { FAILURE_TYPES } = require('./constants')

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
}

function needsFallbackInspector(output) {
  const slides = Array.isArray(output?.slides) ? output.slides : []
  return slides.length === 0 || slides.every((slide) => (slide.elements || []).length === 0)
}

async function inspectWithPptx2Json(filePath, reason) {
  try {
    const PPTX2Json = require('pptx2json')
    const pkg = require('pptx2json/package.json')
    const raw = await new PPTX2Json({ jszipBinary: 'nodebuffer' }).toJson(filePath)
    const keys = Object.keys(raw || {})
    return {
      parser: 'pptx2json',
      reason,
      packageVersion: pkg.version,
      slideXmlCount: keys.filter((key) => /^ppt\/slides\/slide\d+\.xml$/.test(key)).length,
      mediaCount: keys.filter((key) => key.startsWith('ppt/media/')).length,
      chartCount: keys.filter((key) => key.startsWith('ppt/charts/')).length,
    }
  } catch (err) {
    return {
      parser: 'pptx2json',
      reason,
      error: { type: classifyError(err), message: sanitizeDiagnostic(err) },
    }
  }
}

async function parseFile(filePath) {
  const { parse } = require('pptxtojson/dist/index.cjs')
  const pkg = require('pptxtojson/package.json')
  const buffer = await fs.readFile(filePath)
  const output = await parse(toArrayBuffer(buffer), {
    imageMode: 'base64',
    videoMode: 'none',
    audioMode: 'none',
  })
  const fallback = needsFallbackInspector(output)
    ? await inspectWithPptx2Json(filePath, 'primary-output-missing-object-evidence')
    : null

  return {
    ok: true,
    parser: 'pptxtojson',
    packageVersion: pkg.version,
    output,
    fallback,
  }
}

process.on('message', async ({ filePath }) => {
  try {
    const result = await parseFile(filePath)
    if (!Array.isArray(result.output?.slides) || result.output.slides.length === 0) {
      process.send({
        ok: false,
        error: {
          type: FAILURE_TYPES.outputEmpty,
          message: 'PPTX parser returned no slides',
        },
        fallback: result.fallback,
      })
      return
    }
    process.send(result)
  } catch (err) {
    process.send({
      ok: false,
      error: {
        type: classifyError(err),
        message: sanitizeDiagnostic(err),
      },
    })
  }
})

const fs = require('fs-extra')
const { classifyError, sanitizeDiagnostic } = require('./diagnostics')
const { assertUsableParserOutput } = require('./output-usability')
const { validatePptxPackage } = require('./pptx-guards')
const { assertParsedOutputBudget } = require('./resource-budgets')

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
}

async function parseFile(filePath, originalName, signal) {
  const validated = await validatePptxPackage(filePath, originalName, { signal })
  const { parse } = require('pptxtojson/dist/index.cjs')
  const pkg = require('pptxtojson/package.json')
  const buffer = await fs.readFile(filePath, signal ? { signal } : undefined)
  signal?.throwIfAborted?.()
  sendProgress('parsing', 5, 'Reading PPTX archive')
  let heartbeatPercent = 10
  const heartbeat = setInterval(() => {
    heartbeatPercent = Math.min(75, heartbeatPercent + 5)
    sendProgress('parsing', heartbeatPercent, 'Parsing PPTX content')
  }, 2000)
  let output
  try {
    output = await parse(toArrayBuffer(buffer), {
      imageMode: 'base64',
      videoMode: 'blob',
      audioMode: 'blob',
    })
    signal?.throwIfAborted?.()
  } finally {
    clearInterval(heartbeat)
  }
  sendProgress('parsing', 80, 'PPTX parsed')

  return {
    ok: true,
    parser: 'pptxtojson',
    packageVersion: pkg.version,
    output,
    parsedOutputBytes: assertParsedOutputBudget(output),
    packageInfo: {
      entryCount: validated.entryCount,
      decompressedBytes: validated.decompressedBytes,
      fileSize: validated.fileSize,
    },
  }
}

let activeAbortController = null

async function handleMessage(message) {
  if (message?.type === 'abort') {
    activeAbortController?.abort()
    process.send?.({ type: 'abort-ack' })
    return
  }

  const controller = new AbortController()
  activeAbortController = controller
  const { filePath, originalName } = message || {}
  try {
    const result = await parseFile(filePath, originalName || filePath, controller.signal)
    assertUsableParserOutput(result.output)
    process.send?.(result)
  } catch (err) {
    process.send?.({
      ok: false,
      error: {
        type: classifyError(err),
        message: sanitizeDiagnostic(err),
        status: Number.isInteger(err?.status) ? err.status : undefined,
      },
    })
  } finally {
    if (activeAbortController === controller) activeAbortController = null
  }
}

function sendProgress(stage, percent, message) {
  process.send?.({ type: 'progress', stage, percent, message })
}

if (require.main === module) {
  process.on('message', handleMessage)
  process.send?.({ type: 'ready' })
}

module.exports = { parseFile }

const fs = require('fs')
const path = require('path')
const { createSandboxRequire, toArrayBuffer, withSilencedConsole } = require('../package-utils')

async function runParser({ inputPath, sandboxRoot }) {
  const sandboxRequire = createSandboxRequire(sandboxRoot)
  const packageRoot = path.dirname(sandboxRequire.resolve('pptxtojson/package.json'))
  const pptxtojson = sandboxRequire(path.join(packageRoot, 'dist', 'index.cjs'))
  const buffer = await fs.promises.readFile(inputPath)

  const output = await withSilencedConsole(() => pptxtojson.parse(toArrayBuffer(buffer), {
    imageMode: 'none',
    videoMode: 'none',
    audioMode: 'none',
  }))

  return { output, warnings: ['Parsed with media payload extraction disabled.'] }
}

module.exports = { runParser }

const fs = require('fs')
const { createSandboxRequire, toArrayBuffer, withSilencedConsole } = require('../package-utils')

async function runParser({ inputPath, sandboxRoot }) {
  const sandboxRequire = createSandboxRequire(sandboxRoot)
  const pptParser = sandboxRequire('ppt-parser')
  const buffer = await fs.promises.readFile(inputPath)

  const output = await withSilencedConsole(() => pptParser.parse(toArrayBuffer(buffer), {
    slideFactor: 96 / 914400,
    fontsizeFactor: 100 / 75,
  }))

  return { output, warnings: [] }
}

module.exports = { runParser }

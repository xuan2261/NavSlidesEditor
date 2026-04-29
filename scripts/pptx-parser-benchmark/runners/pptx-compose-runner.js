const { createSandboxRequire } = require('../package-utils')

async function runParser({ inputPath, sandboxRoot }) {
  const sandboxRequire = createSandboxRequire(sandboxRoot)
  const loaded = sandboxRequire('pptx-compose')
  const Composer = loaded.default || loaded
  const parser = new Composer({ jszipBinary: 'nodebuffer' })
  const output = await parser.toJSON(inputPath)

  return { output, warnings: ['Raw OOXML JSON baseline; package is older.'] }
}

module.exports = { runParser }

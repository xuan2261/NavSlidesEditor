const { createSandboxRequire } = require('../package-utils')

async function runParser({ inputPath, sandboxRoot }) {
  const sandboxRequire = createSandboxRequire(sandboxRoot)
  const PPTX2Json = sandboxRequire('pptx2json')
  const parser = new PPTX2Json({ jszipBinary: 'nodebuffer' })
  const output = await parser.toJson(inputPath)

  return { output, warnings: ['Raw OOXML JSON; mapper complexity expected high.'] }
}

module.exports = { runParser }

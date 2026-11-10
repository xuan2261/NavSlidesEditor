const fs = require('node:fs')
const path = require('node:path')
const { build } = require('esbuild')

async function buildPptxSemanticOutputRuntime(outDir) {
  if (!outDir) throw new Error('Provide a semantic output runtime directory')
  fs.mkdirSync(outDir, { recursive: true })
  const output = path.join(outDir, 'runtime.js')
  await build({
    entryPoints: [path.resolve(__dirname, '../shared/src/pptx-semantic-output-browser.js')],
    outfile: output, bundle: true, platform: 'browser', format: 'iife',
    globalName: 'NavSlidesSemanticOutput', target: 'es2022',
    minify: true, legalComments: 'none',
  })
  return [{ source: output, sourceLabel: 'generated canonical semantic output runtime',
    destination: 'navslides-semantic-output/runtime.js' }]
}
if (require.main === module) {
  const args = process.argv.slice(2), index = args.indexOf('--out-dir')
  buildPptxSemanticOutputRuntime(index < 0 ? undefined : args[index + 1])
    .then(() => console.log('Semantic output runtime built: 1 asset'))
    .catch((error) => { console.error(error.message); process.exitCode = 1 })
}
module.exports = { buildPptxSemanticOutputRuntime }

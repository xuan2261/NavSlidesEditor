const fs = require('node:fs')
const path = require('node:path')
const { build } = require('esbuild')
async function buildEducationRuntime(outDir) {
  if (!outDir) throw new Error('Provide an education runtime output directory')
  fs.mkdirSync(outDir, { recursive: true })
  const sourceDir = path.resolve(__dirname, '../shared/src/education/browser')
  const js = path.join(outDir, 'runtime.js'),
    css = path.join(outDir, 'runtime.css')
  await build({
    entryPoints: [path.join(sourceDir, 'runtime-entry.js')],
    outfile: js,
    bundle: true,
    platform: 'browser',
    format: 'iife',
    globalName: 'NavSlidesEducation',
    target: 'es2018',
    minify: true,
    legalComments: 'none',
  })
  fs.copyFileSync(path.join(sourceDir, 'runtime.css'), css)
  return [
    {
      source: js,
      sourceLabel: 'generated education runtime',
      destination: 'navslides-education/runtime.js',
    },
    {
      source: css,
      sourceLabel: 'education runtime stylesheet',
      destination: 'navslides-education/runtime.css',
    },
  ]
}
if (require.main === module) {
  const args = process.argv.slice(2),
    at = args.indexOf('--out-dir')
  buildEducationRuntime(at < 0 ? undefined : args[at + 1])
    .then((files) => console.log(`Education runtime built: ${files.length} assets`))
    .catch((error) => {
      console.error(error.message)
      process.exitCode = 1
    })
}
module.exports = { buildEducationRuntime }

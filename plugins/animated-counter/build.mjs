import { build } from 'esbuild'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const { escapeInlineScript } = require('../../shared/src/education/config-serialization.js')
const root = new URL('./', import.meta.url)
try {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('src/counter.js', root))],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    write: false,
    minify: true,
    legalComments: 'none',
  })
  const template = await readFile(new URL('src/sandbox.html', root), 'utf8')
  const marker = '<!-- COUNTER_SCRIPT -->'
  if (template.split(marker).length !== 2)
    throw new Error('Counter template must have exactly one script insertion point.')
  const document = template.replace(
    marker,
    `<script>${escapeInlineScript(result.outputFiles[0].text)}</script>`
  )
  await mkdir(new URL('dist/', root), { recursive: true })
  await writeFile(new URL('dist/sandbox.html', root), document)
  console.log('Animated Counter peer bundled from canonical source and shared message contract.')
} catch (failure) {
  console.error('Animated Counter build failed:', failure)
  process.exitCode = 1
}

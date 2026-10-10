import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import closure from './verify-runtime-closure.js'
import reveal from '../shared/src/reveal-runtime-assets.js'

const require = createRequire(import.meta.url)
const defaultRoot = fileURLToPath(new URL('../', import.meta.url))
const documents = ['README.md', 'README_vi.md']
const start = '<!-- navslides-facts:start -->'
const end = '<!-- navslides-facts:end -->'
const json = async (root, file) => JSON.parse(await fs.readFile(path.join(root, file), 'utf8'))

function parseCatalog(text, file) {
  if (text.split(start).length !== 2 || text.split(end).length !== 2 || text.indexOf(end) < text.indexOf(start)) {
    throw new Error(`${file}: expected exactly one bounded facts catalog`)
  }
  const rows = text.slice(text.indexOf(start) + start.length, text.indexOf(end)).trim().split(/\r?\n/)
  const values = {}
  for (const row of rows) {
    const cells = row.trim().split('|')
    if (cells.length !== 4 || cells[0].trim() || cells[3].trim()) throw new Error(`${file}: invalid facts table row`)
    const key = cells[1].trim()
    const value = cells[2].trim()
    if (key === 'Fact' && value === 'Value') continue
    if (/^-+$/.test(key) && /^-+$/.test(value)) continue
    if (!key || !value || Object.hasOwn(values, key)) throw new Error(`${file}: invalid or repeated fact ${key}`)
    values[key] = value
  }
  return values
}

export async function verifyDocumentationFacts({ rootDir = defaultRoot } = {}) {
  const root = path.resolve(rootDir)
  const [pkg, runtime, client, server] = await Promise.all([
    json(root, 'package.json'), json(root, 'runtime-versions.json'),
    json(root, 'client/package.json'), json(root, 'server/package.json'),
  ])
  if (!Array.isArray(pkg.workspaces) || pkg.workspaces.some((item) => typeof item !== 'string')) {
    throw new Error('Canonical workspace list is invalid')
  }
  if (!/^>=\d+\.\d+\.\d+$/.test(runtime.nodeFloor) || pkg.engines?.node !== runtime.nodeFloor) {
    throw new Error('Node minimum owner mismatch')
  }
  const importedReveal = require(path.join(root, 'shared/src/reveal-runtime-assets.js')).REVEAL_RUNTIME_VERSION
  if (server.devDependencies?.['reveal.js'] !== importedReveal || importedReveal !== reveal.REVEAL_RUNTIME_VERSION) {
    throw new Error('Reveal owner mismatch')
  }
  const tiptap = Object.entries(client.dependencies || {}).filter(([name]) => name.startsWith('@tiptap/'))
  if (!tiptap.length || tiptap.some(([, pin]) => pin !== runtime.tiptap)) throw new Error('TipTap owner mismatch')
  const { ELEMENT_DEFAULTS } = await import(pathToFileURL(path.join(root, 'client/src/data/element-defaults.js')).href)
  if (!ELEMENT_DEFAULTS || typeof ELEMENT_DEFAULTS !== 'object' || Array.isArray(ELEMENT_DEFAULTS)) {
    throw new Error('Canonical element defaults are invalid')
  }
  const facts = {
    version: pkg.version,
    workspaces: pkg.workspaces.join(','),
    'node.minimum': runtime.nodeFloor.slice(2),
    reveal: importedReveal,
    tiptap: runtime.tiptap,
    elements: String(Object.keys(ELEMENT_DEFAULTS).length),
  }
  for (const file of documents) {
    const actual = parseCatalog(await fs.readFile(path.join(root, file), 'utf8'), file)
    for (const [key, value] of Object.entries(facts)) {
      if (typeof value !== 'string' || !value || actual[key] !== value) {
        throw new Error(`${file}: ${key} must match canonical owner (${value}), got ${actual[key]}`)
      }
    }
    const extra = Object.keys(actual).filter((key) => !Object.hasOwn(facts, key))
    if (extra.length) throw new Error(`${file}: unknown facts ${extra.join(', ')}`)
  }
  const vendor = closure.verifyRuntimeClosure({ rootDir: root, requiredServerModules: [] })
  return { facts, documents, vendorFiles: vendor.vendorFiles }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2)
    if (args.length && (args.length !== 2 || args[0] !== '--root' || !args[1])) {
      throw new Error('Usage: node scripts/verify-documentation-facts.mjs [--root directory]')
    }
    console.log(JSON.stringify(await verifyDocumentationFacts({ rootDir: args[1] || defaultRoot })))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join, relative, sep } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '../..')

// Capability ids are dotted/hyphenated and may be camelCase (e.g.
// shortcut.blackScreen, control.format.lineHeight) — match upper+lower so the
// id is not truncated at the first uppercase letter.
const CAP_RE = /\[cap:([A-Za-z0-9.\-]+)([^\]]*)\]/g
const TEST_DECL_RE =
  /\b(it|test|describe)(\.[a-z]+)?\s*\(\s*(['"`])((?:\\.|(?!\3).)*)\3/g

const EXCLUDE_DIRS = new Set([
  'node_modules',
  'dist',
  'dist-electron',
  'coverage',
  'feature-inventory', // our own fixtures contain [cap:*] strings — never scan them
])

export function deriveLayer(filePath) {
  const p = filePath.replace(/\\/g, '/')
  if (p.includes('tests/e2e/')) return 'e2e'
  if (p.includes('/integration/') || p.includes('.integration.')) return 'integration'
  return 'unit'
}

// `.skip`/`.fixme` mean the test never runs → never counts as verified.
// `.only` still runs, so it is NOT skipped.
function isSkippedModifier(mod) {
  return mod === '.skip' || mod === '.fixme'
}

export function extractTagsFromSource(source, filePath) {
  const layer = deriveLayer(filePath)
  const out = {}
  for (const decl of source.matchAll(TEST_DECL_RE)) {
    const modifier = decl[2] || ''
    const title = decl[4]
    if (!title.includes('[cap:')) continue
    const skipped = isSkippedModifier(modifier)
    const standaloneDeep = /\[tier:deep\]/.test(title)
    for (const cap of title.matchAll(CAP_RE)) {
      const id = cap[1]
      const inlineDeep = /\btier:deep\b/.test(cap[2] || '')
      const tier = inlineDeep || standaloneDeep ? 'deep' : 'smoke'
      ;(out[id] ||= []).push({ file: filePath, title, tier, layer, skipped })
    }
  }
  return out
}

function walk(dir, matcher, acc) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return acc
  }
  for (const name of entries) {
    if (EXCLUDE_DIRS.has(name)) continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, matcher, acc)
    else if (matcher(name)) acc.push(full)
  }
  return acc
}

const UNIT_RE = /\.(test)\.(jsx?|mjs)$/
const E2E_RE = /\.spec\.jsx?$/

export function collectTestFiles(root = REPO_ROOT) {
  const files = []
  for (const sub of ['client/src', 'server', 'shared']) {
    walk(resolve(root, sub), (n) => UNIT_RE.test(n), files)
  }
  walk(resolve(root, 'tests/e2e'), (n) => E2E_RE.test(n), files)
  return files
}

export function extractAllTags(root = REPO_ROOT) {
  const merged = {}
  for (const file of collectTestFiles(root)) {
    const rel = relative(root, file).split(sep).join('/')
    const tags = extractTagsFromSource(readFileSync(file, 'utf8'), rel)
    for (const [id, occ] of Object.entries(tags)) {
      ;(merged[id] ||= []).push(...occ)
    }
  }
  return merged
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  const { writeFileSync } = await import('node:fs')
  const tags = extractAllTags()
  const outPath = resolve(HERE, 'tags.json')
  writeFileSync(outPath, JSON.stringify(tags, null, 2) + '\n')
  const totalOcc = Object.values(tags).reduce((n, a) => n + a.length, 0)
  console.log(`[tags] ${Object.keys(tags).length} capability ids, ${totalOcc} occurrences → tags.json`)
}

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const EDITOR_PAGE = resolve(HERE, '../../client/src/pages/EditorPage.jsx')
const MANIFEST_PATH = resolve(HERE, 'feature-manifest.json')

// The inline `commands = [ { id: '...' } ]` array in EditorPage is a manual,
// registry-less source — a new command there would otherwise stay invisible.
// Parse its ids so the completeness check forces a matching manifest entry.
export function parseCommandIds(source) {
  const block = source.match(/const\s+commands\s*=\s*\[([\s\S]*?)\n\s*\]/)
  if (!block) return []
  return [...block[1].matchAll(/\{\s*id:\s*['"]([A-Za-z0-9_]+)['"]/g)].map(
    (m) => `command.${m[1]}`
  )
}

// Pure diff: every discovered id MUST be present in the manifest. A discovered
// id with no manifest entry means a new control/command went invisible.
export function checkManifestCompleteness({ discovered, manifestIds }) {
  const manifestSet = new Set(manifestIds)
  const missing = [...new Set(discovered)].filter((id) => !manifestSet.has(id)).sort()
  return { ok: missing.length === 0, missing }
}

function loadManifestIds() {
  const raw = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
  const ids = []
  for (const entries of Object.values(raw)) {
    for (const e of entries) ids.push(e.id)
  }
  return ids
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  const manifestIds = loadManifestIds()
  const discovered = existsSync(EDITOR_PAGE)
    ? parseCommandIds(readFileSync(EDITOR_PAGE, 'utf8'))
    : []
  const result = checkManifestCompleteness({ discovered, manifestIds })
  if (result.ok) {
    console.log(
      `[manifest-completeness] PASS — ${discovered.length} discovered command(s) all mapped`
    )
    process.exit(0)
  } else {
    for (const id of result.missing) {
      console.error(
        `[manifest-completeness] FAIL ${id} discovered in source but missing from feature-manifest.json`
      )
    }
    process.exit(1)
  }
}

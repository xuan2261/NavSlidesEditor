import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const MANIFEST_PATH = resolve(HERE, 'feature-manifest.json')

// Hand-written capabilities with no code registry: canvas ops, ribbon controls,
// the inline EditorPage command array, and cross-cutting flows. Each manifest
// section name is the capability category. All manifest caps are editor-core.
export function loadManifest() {
  const raw = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
  const out = []
  for (const [category, entries] of Object.entries(raw)) {
    for (const e of entries) {
      out.push({
        id: e.id,
        category,
        source: 'manifest',
        risk: e.risk ?? 'low',
        tiers: e.tiers ?? ['smoke'],
        scope: e.scope ?? 'editor-core',
      })
    }
  }
  return out
}

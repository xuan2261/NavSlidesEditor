import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import {
  loadElements,
  loadShortcuts,
  extractRendererKeys,
  crossCheckRenderers,
} from './load-auto-sources.mjs'
import { loadManifest } from './load-manifest.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = resolve(HERE, 'inventory.json')

// Canonical capability inventory: everything that MUST be verified. A capability
// absent here is invisible forever, so completeness is the load-bearing concern.
// Auto-sourced categories self-heal (a new registry key auto-enters); manifest
// categories are guarded by the Phase 6 manifest-completeness check.
export async function buildInventory() {
  const elements = await loadElements()
  const shortcuts = await loadShortcuts()
  const manifest = loadManifest()

  const elementTypes = elements.map((e) => e.id.replace(/^element\./, ''))
  const rendererKeys = await extractRendererKeys()
  const warnings = crossCheckRenderers(elementTypes, rendererKeys)
  for (const w of warnings) console.warn(`[inventory] WARN ${w}`)

  const byId = new Map()
  for (const cap of [...elements, ...shortcuts, ...manifest]) {
    if (byId.has(cap.id)) {
      console.warn(`[inventory] WARN duplicate id ${cap.id} — keeping first`)
      continue
    }
    byId.set(cap.id, cap)
  }

  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id))
}

export async function writeInventory() {
  const inv = await buildInventory()
  writeFileSync(OUTPUT_PATH, JSON.stringify(inv, null, 2) + '\n')
  return inv
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  writeInventory().then((inv) => {
    const counts = inv.reduce((acc, c) => {
      acc[c.category] = (acc[c.category] || 0) + 1
      return acc
    }, {})
    console.log(`[inventory] wrote ${inv.length} capabilities to inventory.json`)
    console.log(`[inventory] by category:`, counts)
  })
}

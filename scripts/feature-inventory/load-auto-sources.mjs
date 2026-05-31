import { readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const CLIENT_SRC = resolve(HERE, '../../client/src')

const ELEMENT_DEFAULTS_PATH = resolve(CLIENT_SRC, 'data/element-defaults.js')
const SHORTCUTS_PATH = resolve(
  CLIENT_SRC,
  'utils/default-keyboard-shortcut-definitions-registry.js'
)
const REGISTRY_PATH = resolve(
  CLIENT_SRC,
  'components/canvas/element-renderers/registry.js'
)

// Behavior logic likely to be subtly wrong → deserves deep tests, not just smoke.
const HIGH_RISK_ELEMENTS = new Set(['table', 'chart', 'timeline'])
// These render via TipTap/media/embed paths, NOT the renderer registry —
// registry-less BY DESIGN. The 13-vs-19 key delta is exactly this set.
const NO_REGISTRY_BY_DESIGN = new Set([
  'text',
  'image',
  'code',
  'html',
  'video',
  'audio',
])

export async function loadElements() {
  const mod = await import(pathToFileURL(ELEMENT_DEFAULTS_PATH).href)
  return Object.keys(mod.ELEMENT_DEFAULTS).map((type) => ({
    id: `element.${type}`,
    category: 'element',
    source: 'ELEMENT_DEFAULTS',
    risk: HIGH_RISK_ELEMENTS.has(type) ? 'high' : 'low',
    tiers: HIGH_RISK_ELEMENTS.has(type) ? ['smoke', 'deep'] : ['smoke'],
    // element.game is a game-mode element, out of editor-core element scope.
    scope: type === 'game' ? 'game' : 'editor-core',
    targetLayer: type === 'game' ? 'e2e' : 'unit',
    coverageMode: 'executable',
  }))
}

export async function loadShortcuts() {
  const mod = await import(pathToFileURL(SHORTCUTS_PATH).href)
  // All 44 shortcuts enter the inventory + gate denominator (decided 2026-05-30);
  // deep behavior is owned by the canvas.*/flow.* caps they map to.
  return mod.DEFAULT_SHORTCUTS.map((s) => ({
    id: `shortcut.${s.id}`,
    category: 'shortcut',
    source: 'DEFAULT_SHORTCUTS',
    risk: 'low',
    tiers: ['smoke'],
    scope: 'editor-core',
    targetLayer: 'unit',
    coverageMode: 'executable',
  }))
}

// registry.js imports JSX renderers — executing it in Node fails. Read as text,
// regex the object-literal keys. Used only for the cross-check warning below.
export async function extractRendererKeys() {
  const text = await readFile(REGISTRY_PATH, 'utf8')
  const block = text.match(/elementRendererRegistry\s*=\s*\{([\s\S]*?)\n\}/)
  if (!block) return []
  return [...block[1].matchAll(/^\s*([a-zA-Z][\w-]*)\s*:/gm)].map((m) => m[1])
}

export function crossCheckRenderers(elementTypes, rendererKeys) {
  const rendererSet = new Set(rendererKeys)
  const elementSet = new Set(elementTypes)
  const warnings = []
  for (const type of elementTypes) {
    if (NO_REGISTRY_BY_DESIGN.has(type)) continue
    if (!rendererSet.has(type)) {
      warnings.push(`element.${type}: no renderer-registry entry (unexpected)`)
    }
  }
  for (const key of rendererKeys) {
    if (!elementSet.has(key)) {
      warnings.push(`renderer.${key}: no ELEMENT_DEFAULTS entry (orphan renderer)`)
    }
  }
  return warnings
}

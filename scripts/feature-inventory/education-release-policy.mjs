import { pathToFileURL, fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { digest } from './education-evidence-files.mjs'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export async function loadRequiredCells(root = ROOT, elementDefaults) {
  const require = createRequire(resolve(root, 'package.json'))
  const defaults =
    elementDefaults ??
    (await import(pathToFileURL(resolve(root, 'client/src/data/element-defaults.js')).href))
      .ELEMENT_DEFAULTS
  const { GAME_CATALOG } = require('./shared/src/education/game-registry.js')
  const { QUESTION_KINDS } = require('./shared/src/education/question-shape.js')
  const { EDUCATION_PRESETS } = require('./shared/src/education/presets/catalog.js')
  const { buildRequiredCells } = require('./shared/src/education/release-capabilities.js')
  return buildRequiredCells({
    elementDefaults: defaults,
    gameCatalog: GAME_CATALOG,
    questionKinds: QUESTION_KINDS,
    presets: EDUCATION_PRESETS,
  })
}
export async function policyIdentity(root = ROOT) {
  const cells = await loadRequiredCells(root)
  return { cells, policyHash: digest(cells) }
}

import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { expandTextContext } = require('../../shared/src/pptx-semantic-text-context-codec')

// Mutable legacy fixtures retain all source values but need no shared dictionary.
export function expandedTextContextDocument(document) {
  const result = structuredClone(document)
  for (const entry of Object.values(result.styles))
    if (entry.kind === 'text-context')
      entry.payload = JSON.parse(
        JSON.stringify(expandTextContext(entry.payload, { styles: result.styles }))
      )
  for (const [id, entry] of Object.entries(result.styles))
    if (entry.kind === 'text-context-resources') delete result.styles[id]
  return result
}

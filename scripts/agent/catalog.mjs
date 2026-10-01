import { readTools } from './read-tools.mjs'
import { deckTools } from './deck-tools.mjs'
import { lifecycleTools } from './lifecycle-tools.mjs'
import { fileTools } from './file-tools.mjs'

export const tools = [...readTools, ...deckTools, ...lifecycleTools, ...fileTools]
export function findTool(name) { return tools.find((t) => t.name === name.replaceAll('-', '_')) }

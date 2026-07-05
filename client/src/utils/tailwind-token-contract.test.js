import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import tailwindConfig from '../../tailwind.config.js'

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..')
const SCOPED_FILES = [
  'client/src/pages/game-player-join-page.jsx',
  'client/src/components/ribbon/ribbon-panel.jsx',
  'client/src/components/ribbon/tab-bar-with-scroll-and-icons.jsx',
  'client/src/App.jsx',
]

function colorKeys(colors, prefix = '') {
  return Object.entries(colors).flatMap(([key, value]) => {
    const nextKey = prefix ? `${prefix}-${key}` : key
    if (typeof value === 'string') return [nextKey]
    return [nextKey, ...colorKeys(value, nextKey)]
  })
}

describe('Tailwind app chrome token contract', () => {
  it('does not use undefined background color aliases in scoped UI chrome', () => {
    const supported = new Set(colorKeys(tailwindConfig.theme.extend.colors))
    const offenders = []

    for (const relativePath of SCOPED_FILES) {
      const source = fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
      for (const match of source.matchAll(/\bbg-([a-z][a-z0-9-]*)\b/g)) {
        const token = match[1]
        if (!supported.has(token) && !token.includes('/')) {
          offenders.push(`${relativePath}:bg-${token}`)
        }
      }
    }

    expect(offenders).not.toContain('client/src/pages/game-player-join-page.jsx:bg-editor-bg')
    expect(offenders).not.toContain('client/src/components/ribbon/ribbon-panel.jsx:bg-background')
    expect(offenders).not.toContain('client/src/components/ribbon/tab-bar-with-scroll-and-icons.jsx:bg-background')
  })
})

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..')
const INDEX_CSS_PATH = path.join(REPO_ROOT, 'client/src/index.css')
const SCOPED_FILES = [
  'client/src/pages/game-player-join-page.jsx',
  'client/src/components/ribbon/ribbon-panel.jsx',
  'client/src/components/ribbon/tab-bar-with-scroll-and-icons.jsx',
  'client/src/App.jsx',
]

function themeColorTokens(css) {
  const tokens = []
  for (const block of css.matchAll(/@theme(?:\s+inline)?\s*\{([\s\S]*?)\n\}/g)) {
    for (const match of block[1].matchAll(/--color-([a-z0-9-]+)\s*:/g)) {
      tokens.push(match[1])
    }
  }
  return tokens
}

describe('Tailwind app chrome token contract', () => {
  it('does not use undefined background color aliases in scoped UI chrome', () => {
    const supported = new Set(themeColorTokens(fs.readFileSync(INDEX_CSS_PATH, 'utf8')))
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

  it('[red defect:token.focus] does not use undefined focus ring aliases in scoped UI chrome', () => {
    const supported = new Set(themeColorTokens(fs.readFileSync(INDEX_CSS_PATH, 'utf8')))
    const offenders = []

    for (const relativePath of SCOPED_FILES) {
      const source = fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
      for (const match of source.matchAll(/\bring-([a-z][a-z0-9-]*)\b/g)) {
        const token = match[1]
        if (!supported.has(token) && !token.includes('/')) {
          offenders.push(`${relativePath}:ring-${token}`)
        }
      }
    }

    expect(offenders).toEqual([])
  })
})

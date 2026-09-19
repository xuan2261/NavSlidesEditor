import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..')
// HomePage.jsx was split into pages/home/* — scan the page plus its modules.
const HOME_SOURCE = [
  'HomePage.jsx',
  ...fs
    .readdirSync(path.join(REPO_ROOT, 'client', 'src', 'pages', 'home'))
    .filter((f) => /\.(js|jsx)$/.test(f))
    .map((f) => path.join('home', f)),
]
  .map((f) => fs.readFileSync(path.join(REPO_ROOT, 'client', 'src', 'pages', f), 'utf8'))
  .join('\n')

describe('home dashboard card semantics', () => {
  it('uses a dedicated open button for presentation grid cards instead of nested interactive role buttons', () => {
    expect(HOME_SOURCE).toContain('aria-label={`Open ${pres.title ||')
    expect(HOME_SOURCE).toContain('<article')
    expect(HOME_SOURCE).not.toContain('className={`${DASHBOARD_CARD_CLASS} flex h-full cursor-pointer flex-col`}\n                            role="button"')
  })
})

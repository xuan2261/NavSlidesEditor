import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..')
const HOME_SOURCE = fs.readFileSync(path.join(REPO_ROOT, 'client', 'src', 'pages', 'HomePage.jsx'), 'utf8')

describe('home dashboard card semantics', () => {
  it('uses a dedicated open button for presentation grid cards instead of nested interactive role buttons', () => {
    expect(HOME_SOURCE).toContain('aria-label={`Open ${pres.title ||')
    expect(HOME_SOURCE).toContain('<article')
    expect(HOME_SOURCE).not.toContain('className={`${DASHBOARD_CARD_CLASS} flex h-full cursor-pointer flex-col`}\n                            role="button"')
  })
})

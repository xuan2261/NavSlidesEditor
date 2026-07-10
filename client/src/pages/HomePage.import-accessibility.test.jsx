import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cwd } from 'node:process'
import { describe, expect, it } from 'vitest'

describe('HomePage import accessibility', () => {
  it('[F3] exposes import actions as buttons that trigger hidden file inputs through refs', () => {
    const source = readFileSync(join(cwd(), 'client/src/pages/HomePage.jsx'), 'utf8')

    expect(source).toContain('data-testid="home-import-pptx-btn"')
    expect(source).toContain('onClick={() => pptxInputRef.current?.click()}')
    expect(source).toContain('onClick={() => markdownInputRef.current?.click()}')
    expect(source).not.toContain('<label\n              data-testid="home-import-pptx-btn"')
    expect(source).not.toContain('<label\n              data-testid="home-import-markdown-btn"')
  })
})

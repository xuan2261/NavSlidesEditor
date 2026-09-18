import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cwd } from 'node:process'
import { describe, expect, it } from 'vitest'

describe('HomePage import accessibility', () => {
  it('[F3] exposes import actions as buttons that trigger hidden file inputs through refs', () => {
    // HomePage.jsx was split into pages/home/* — scan the page plus its modules.
    const source = [
      'client/src/pages/HomePage.jsx',
      ...readdirSync(join(cwd(), 'client/src/pages/home'))
        .filter((f) => /\.(js|jsx)$/.test(f))
        .map((f) => `client/src/pages/home/${f}`),
    ]
      .map((f) => readFileSync(join(cwd(), f), 'utf8'))
      .join('\n')

    expect(source).toContain('data-testid="home-import-pptx-btn"')
    expect(source).toContain('onClick={() => pptxInputRef.current?.click()}')
    expect(source).toContain('onClick={() => markdownInputRef.current?.click()}')
    expect(source).not.toContain('<label\n              data-testid="home-import-pptx-btn"')
    expect(source).not.toContain('<label\n              data-testid="home-import-markdown-btn"')
  })
})

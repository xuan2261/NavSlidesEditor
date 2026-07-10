import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const CSS_PATH = path.resolve(import.meta.dirname, '../index.css')

describe('editor chrome typography tokens', () => {
  it('uses DESIGN.md serif and sans fallbacks without changing slide content styles', () => {
    const css = fs.readFileSync(CSS_PATH, 'utf8')

    expect(css).toMatch(/--font-ui-sans:\s*'Anthropic Sans',\s*'Inter'/)
    expect(css).toMatch(/--font-ui-serif:\s*'Anthropic Serif',\s*Georgia/)
    expect(css).toMatch(/body\s*\{[\s\S]*?font-family:\s*var\(--font-ui-sans\)/)
    expect(css).toMatch(/#root\s+:is\(h1,\s*h2\)(?::not\([^)]*\)){3}[^{]*\{[\s\S]*?font-family:\s*var\(--font-ui-serif\)/)
    expect(css).toMatch(/#root\s+:is\(h1,\s*h2\)(?::not\([^)]*\)){3}[^{]*\{[\s\S]*?font-weight:\s*500/)
    expect(css).toContain(':not(.slide-canvas *)')
    expect(css).not.toMatch(/\.slide-text-content\s*\{[^}]*var\(--font-ui-/)
  })
})

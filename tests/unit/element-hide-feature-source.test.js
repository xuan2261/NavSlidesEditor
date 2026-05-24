import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('element hide/show source contract', () => {
  it('SelectionPane exposes per-element visibility toggle testid', () => {
    const source = readFileSync('client/src/components/SelectionPane.jsx', 'utf8')
    expect(source).toMatch(/selection-pane-toggle-visibility-\$\{el\.id\}/)
  })

  it('SlideCanvas filters hidden elements from canvas rendering', () => {
    const source = readFileSync('client/src/components/SlideCanvas.jsx', 'utf8')
    expect(source).toMatch(/filter\(\(el\) => !\(el\.hidden \|\| false\)\)/)
  })
})

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const homeSource = () => readFileSync(path.resolve(HERE, 'HomePage.jsx'), 'utf8')
const editorSource = () => readFileSync(path.resolve(HERE, 'EditorPage.jsx'), 'utf8')
const statusBarSource = () =>
  readFileSync(path.resolve(HERE, '../components/layout/StatusBar.jsx'), 'utf8')

describe('responsive source contracts', () => {
  it('Home page switches the fixed sidebar into a mobile-friendly layout', () => {
    const src = homeSource()

    expect(src).toContain('md:w-[var(--sidebar-width)]')
    expect(src).toContain('overflow-x-auto')
    expect(src).toContain('md:flex-col')
  })

  it('Editor shows a deliberate small-screen guard instead of hiding the canvas', () => {
    const src = editorSource()

    expect(src).toContain('editor-small-screen-guard')
    expect(src).toContain('Tablet or desktop required')
  })

  it('Status bar wraps or hides long attribution text on narrow screens', () => {
    const src = statusBarSource()

    expect(src).toContain('hidden sm:inline-flex')
    expect(src).toContain('min-w-0')
  })
})

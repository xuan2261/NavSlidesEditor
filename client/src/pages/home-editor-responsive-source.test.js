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

  it('[red defect:home.mobile] gives the Home header a two-row mobile layout with reachable actions', () => {
    const src = homeSource()

    expect(src).toContain('flex-col gap-3')
    expect(src).toContain('sm:h-14 sm:flex-row')
    expect(src).toContain('min-h-10 w-10')
    expect(src).toContain('sm:min-h-8 sm:w-8')
    expect(src).toContain('min-h-10 px-3 sm:min-h-8')
    expect(src).toContain('aria-label="New presentation"')
    expect(src).toContain('min-[360px]:inline')
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

describe('HomePage teaching UX polish source contracts', () => {
  it('keeps dashboard/template empty states distinct and actionable', () => {
    const src = homeSource()

    expect(src).toMatch(/No built-in templates in this category/)
    expect(src).toMatch(/No marketplace templates match/)
    expect(src).toMatch(/Clear filters/)
    expect(src).toMatch(/Create your first presentation/)
  })

  it('highlights teaching-friendly starter presets without changing template schema', () => {
    const src = homeSource()

    expect(src).toMatch(/function getPresetTeachingBadge/)
    expect(src).toMatch(/Teaching starter/)
    expect(src).not.toMatch(/teachingBadge:\s*['"]/)
  })
})

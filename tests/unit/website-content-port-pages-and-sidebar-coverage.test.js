import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '..', '..')
const r = (...p) => resolve(root, ...p)

// 23 ports + 5 NavSlides-only stubs (live, game, AI, PPTX, sync)
const ported = {
  guide: ['getting-started', 'installation', 'keyboard-shortcuts'],
  features: ['overview', 'text-formatting', 'shapes', 'charts', 'latex', 'export'],
  tutorials: [
    'first-presentation', 'text-typography', 'images', 'media',
    'shapes-drawing', 'charts-tables', 'code-math', 'using-latex',
    'animations', 'transitions', 'kinetic-text', 'html-embeds',
    'academic-slides', 'presenting',
  ],
}

const navSlidesOnly = [
  'live-presentations', 'game-mode', 'ai-authoring',
  'pptx-import-export', 'cloud-sync',
]

describe('website content port', () => {
  it.each(
    Object.entries(ported).flatMap(([dir, slugs]) =>
      slugs.map((slug) => [dir, slug])
    )
  )('ports docs/%s/%s.md', (dir, slug) => {
    const path = r('website', dir, `${slug}.md`)
    expect(existsSync(path), `missing ${dir}/${slug}.md`).toBe(true)
    const body = readFileSync(path, 'utf8')
    expect(body.length).toBeGreaterThan(50)
  })

  it.each(navSlidesOnly)('has NavSlides-only stub features/%s.md', (slug) => {
    const path = r('website', 'features', `${slug}.md`)
    expect(existsSync(path), `missing features/${slug}.md`).toBe(true)
  })

  it('substitutes the parallax brand in ported pages', () => {
    const sample = readFileSync(r('website', 'guide', 'getting-started.md'), 'utf8')
    expect(sample).toMatch(/NavSlides Editor/)
    expect(sample).not.toMatch(/\bParallax\b/)
  })

  it('totals 23 ported + 5 NavSlides-only pages', () => {
    const portedCount =
      ported.guide.length + ported.features.length + ported.tutorials.length
    expect(portedCount).toBe(23)
    expect(navSlidesOnly.length).toBe(5)
  })

  it('each ported page starts with a markdown heading or frontmatter', () => {
    for (const [dir, slugs] of Object.entries(ported)) {
      for (const slug of slugs) {
        const body = readFileSync(r('website', dir, `${slug}.md`), 'utf8')
        const ok = body.startsWith('#') || body.startsWith('---')
        expect(ok, `${dir}/${slug}.md does not start with heading or frontmatter`).toBe(true)
      }
    }
  })

  it('exposes every page in the sidebar config', () => {
    const cfg = readFileSync(r('website', '.vitepress', 'config.mjs'), 'utf8')
    for (const [dir, slugs] of Object.entries(ported)) {
      for (const slug of slugs) {
        expect(cfg, `sidebar missing /${dir}/${slug}`).toContain(`/${dir}/${slug}`)
      }
    }
    for (const slug of navSlidesOnly) {
      expect(cfg, `sidebar missing /features/${slug}`).toContain(`/features/${slug}`)
    }
  })
})

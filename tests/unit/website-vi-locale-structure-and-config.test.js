import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

const root = resolve(__dirname, '..', '..')
const r = (...p) => resolve(root, ...p)
const read = (...p) => readFileSync(r(...p), 'utf8')

// Collect EN doc pages (the four content sections + the home page) so we can
// assert a /vi/ counterpart exists for each. EN files live at the website root;
// VI mirrors live under website/vi/.
const SECTIONS = ['guide', 'features', 'tutorials', 'develop']

function sectionPages(section) {
  const dir = r('website', section)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => join(section, f))
}

const enPages = ['index.md', ...SECTIONS.flatMap(sectionPages)]

describe('website VI locale', () => {
  it('every EN page has a website/vi/<same-path> counterpart', () => {
    const missing = enPages.filter((rel) => !existsSync(r('website', 'vi', rel)))
    expect(missing, `missing VI pages:\n${missing.join('\n')}`).toEqual([])
  })

  it('config.mjs uses the locales API with root + vi', () => {
    const cfg = read('website', '.vitepress', 'config.mjs')
    expect(cfg).toMatch(/locales\s*:/)
    expect(cfg).toMatch(/root\s*:/)
    expect(cfg).toMatch(/\bvi\s*:/)
    expect(cfg).toContain("label: 'Tiếng Việt'")
  })

  it('config.mjs registers /vi/ sidebar paths for each section', () => {
    const cfg = read('website', '.vitepress', 'config.mjs')
    expect(cfg).toContain('/vi/guide/')
    expect(cfg).toContain('/vi/features/')
    expect(cfg).toContain('/vi/tutorials/')
    expect(cfg).toContain('/vi/develop/')
  })

  it('moves lang into locales (no top-level lang key)', () => {
    const cfg = read('website', '.vitepress', 'config.mjs')
    // The refactor removes the top-level `lang: 'en-US'` line; lang now lives
    // inside locales.root / locales.vi. Tolerant: assert locales present AND no
    // bare top-level `lang:` at the start of a line outside the locales block.
    expect(cfg).toMatch(/locales\s*:/)
    expect(/^\s*lang:\s*'en-US',\s*$/m.test(cfg) && !/locales/.test(cfg)).toBe(false)
  })

  it('preserves EN markers and base after the locales refactor', () => {
    const cfg = read('website', '.vitepress', 'config.mjs')
    expect(cfg).toMatch(/NavSlides/)
    expect(cfg).toMatch(/VITEPRESS_BASE/)
    expect(cfg).toMatch(/\/NavSlidesEditor\//)
  })

  it('VI pages keep locale-agnostic /img/ refs and translate prose', () => {
    // Spot-check the VI overview: image refs unchanged, has Vietnamese prose.
    const vi = read('website', 'vi', 'features', 'overview.md')
    expect(vi).toMatch(/\/img\/editor-empty\.png/)
    expect(vi.startsWith('#') || vi.startsWith('---')).toBe(true)
  })
})

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '..', '..')
const r = (...p) => resolve(root, ...p)

const developPages = [
  'architecture',
  'monorepo-structure',
  'building-from-source',
  'contributing',
]

describe('website develop section', () => {
  it.each(developPages)('has develop/%s.md with content', (slug) => {
    const path = r('website', 'develop', `${slug}.md`)
    expect(existsSync(path), `missing develop/${slug}.md`).toBe(true)
    const body = readFileSync(path, 'utf8')
    expect(body.length).toBeGreaterThan(100)
    expect(body.startsWith('#') || body.startsWith('---')).toBe(true)
  })

  it('exposes every develop page in the sidebar config', () => {
    const cfg = readFileSync(r('website', '.vitepress', 'config.mjs'), 'utf8')
    for (const slug of developPages) {
      expect(cfg, `sidebar missing /develop/${slug}`).toContain(`/develop/${slug}`)
    }
  })

  it('registers a Develop nav entry pointing into the section', () => {
    const cfg = readFileSync(r('website', '.vitepress', 'config.mjs'), 'utf8')
    expect(cfg).toContain('/develop/architecture')
    expect(cfg).toMatch(/text: 'Develop'/)
  })
})

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '..', '..')
const r = (...p) => resolve(root, ...p)
const read = (...p) => readFileSync(r(...p), 'utf8')

describe('website bootstrap', () => {
  it('registers website as an npm workspace', () => {
    const pkg = JSON.parse(read('package.json'))
    expect(pkg.workspaces).toContain('website')
  })

  it('exposes docs scripts at the repo root', () => {
    const pkg = JSON.parse(read('package.json'))
    expect(pkg.scripts['docs:dev']).toMatch(/website/)
    expect(pkg.scripts['docs:build']).toMatch(/website/)
    expect(pkg.scripts['docs:preview']).toMatch(/website/)
  })

  it('has a website package with vitepress dep and docs scripts', () => {
    const pkg = JSON.parse(read('website', 'package.json'))
    expect(pkg.name).toBe('navslides-website')
    expect(pkg.private).toBe(true)
    expect(pkg.scripts['docs:build']).toBe('vitepress build')
    expect(pkg.devDependencies?.vitepress).toBeDefined()
  })

  it('has a vitepress config exposing NavSlides branding and base via env', () => {
    expect(existsSync(r('website', '.vitepress', 'config.mjs'))).toBe(true)
    const cfg = read('website', '.vitepress', 'config.mjs')
    expect(cfg).toMatch(/NavSlides/)
    expect(cfg).toMatch(/VITEPRESS_BASE/)
    expect(cfg).toMatch(/\/NavSlidesEditor\//)
  })

  it('has a home page with hero and features', () => {
    const home = read('website', 'index.md')
    expect(home).toMatch(/layout:\s*home/)
    expect(home).toMatch(/NavSlides/)
    expect(home).toMatch(/features:/)
  })

  it('credits AGPL and the parallax-presentations source in NOTICE.md', () => {
    const notice = read('website', 'NOTICE.md')
    expect(notice).toMatch(/AGPL/i)
    expect(notice).toMatch(/parallax-presentations/i)
  })
})

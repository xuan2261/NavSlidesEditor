import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '..', '..')
const r = (...p) => resolve(root, ...p)
const read = (...p) => readFileSync(r(...p), 'utf8')
const mdFiles = (dir) =>
  readdirSync(r('website', dir))
    .filter((f) => f.endsWith('.md'))
    .map((f) => r('website', dir, f))

// Pins the most error-prone v1.15.0 facts against doc drift. Cheap + bounded
// (YAGNI — not a full doc-vs-code generator). Source of truth: README.md +
// client/src/data/element-defaults.js (19 types) + shared/src/theme-presets.js
// (39 presets / 7 categories) + game constants (10 subtypes). Charts per README:
// bar/line/pie/doughnut/radar/polar area (NO scatter). Present shortcut is F5,
// not bare F.
describe('website content accuracy (v1.15.0)', () => {
  it('features/overview.md lists current chart types, not scatter', () => {
    const body = read('website', 'features', 'overview.md')
    // "scattergories" (a game type) is allowed; a bare "scatter" chart claim is not.
    expect(/scatter(?!gories)/i.test(body), 'overview.md still claims a scatter chart').toBe(false)
    expect(body).toMatch(/doughnut/i)
    expect(body).toMatch(/radar/i)
    expect(body).toMatch(/polar area/i)
  })

  it('no guide/features page still says "6 design presets"', () => {
    for (const dir of ['guide', 'features']) {
      for (const f of mdFiles(dir)) {
        const body = readFileSync(f, 'utf8')
        expect(/6 design presets/i.test(body), `${f} still says "6 design presets"`).toBe(false)
      }
    }
  })

  it('first-presentation.md uses F5 to present, not bare "press F"', () => {
    const body = read('website', 'tutorials', 'first-presentation.md')
    expect(body).toMatch(/`F5`/)
    expect(/press `F`/.test(body), 'still tells reader to press bare F to present').toBe(false)
  })

  it('keyboard-shortcuts.md uses F5 to start a presentation, not bare "F or Enter"', () => {
    for (const path of [
      ['website', 'guide', 'keyboard-shortcuts.md'],
      ['website', 'vi', 'guide', 'keyboard-shortcuts.md'],
    ]) {
      const body = read(...path)
      expect(body, `${path.join('/')} missing F5 present shortcut`).toMatch(/`F5`/)
      expect(
        /`F`\s*(or|hoặc)\s*`?Enter`?/i.test(body),
        `${path.join('/')} still claims bare F/Enter starts a presentation`,
      ).toBe(false)
    }
  })

  it('features/overview.md documents 19 element types', () => {
    const body = read('website', 'features', 'overview.md')
    expect(body).toMatch(/19\s+(canonical\s+)?element types/i)
  })

  it('features/overview.md reflects v1.15.0 surface (FX, vertical slides, layouts, game)', () => {
    const body = read('website', 'features', 'overview.md')
    expect(body).toMatch(/8 animated/i)
    expect(body).toMatch(/vertical/i)
    expect(body).toMatch(/35 layouts/i)
    expect(body).toMatch(/10 interactive game/i)
  })

  it('English and Vietnamese feature pages document 10 game subtypes', () => {
    for (const path of [
      ['website', 'features', 'overview.md'],
      ['website', 'vi', 'features', 'overview.md'],
      ['website', 'features', 'game-mode.md'],
      ['website', 'vi', 'features', 'game-mode.md'],
    ]) {
      const body = read(...path)
      expect(body, `${path.join('/')} missing 10-game claim`).toMatch(
        /10\s+(interactive game|loại phần tử game tương tác)/i
      )
      expect(body, `${path.join('/')} still claims 7 games`).not.toMatch(/7\s+interactive game/i)
    }
  })
})

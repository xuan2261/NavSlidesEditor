import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

const root = resolve(__dirname, '..', '..')
const r = (...p) => resolve(root, ...p)

// Recursively collect files matching a predicate under a directory.
function walk(dir, pred, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, pred, acc)
    else if (pred(full)) acc.push(full)
  }
  return acc
}

describe('website screenshot assets', () => {
  it('every /img/*.png referenced in markdown exists in website/public/img', () => {
    const mdFiles = walk(r('website'), (f) => f.endsWith('.md'))
    const imgRefRe = /\/img\/([A-Za-z0-9._-]+\.png)/g
    const missing = []
    for (const file of mdFiles) {
      const body = readFileSync(file, 'utf8')
      let m
      while ((m = imgRefRe.exec(body)) !== null) {
        const asset = r('website', 'public', 'img', m[1])
        if (!existsSync(asset)) missing.push(`${m[1]} (referenced in ${file})`)
      }
    }
    expect(missing, `missing image assets:\n${missing.join('\n')}`).toEqual([])
  })

  it('the capture script exists under scripts/', () => {
    expect(existsSync(r('scripts', 'capture-docs-screenshots.js'))).toBe(true)
  })

  it('every /demos/*.html embedded in markdown exists in website/public/demos', () => {
    const mdFiles = walk(r('website'), (f) => f.endsWith('.md'))
    const demoRefRe = /\/demos\/([A-Za-z0-9._-]+\.html)/g
    const missing = []
    for (const file of mdFiles) {
      const body = readFileSync(file, 'utf8')
      let m
      while ((m = demoRefRe.exec(body)) !== null) {
        const asset = r('website', 'public', 'demos', m[1])
        if (!existsSync(asset)) missing.push(`${m[1]} (referenced in ${file})`)
      }
    }
    expect(missing, `missing demo assets:\n${missing.join('\n')}`).toEqual([])
  })

  it('no markdown still points demo embeds at the upstream /revealjs_gui/ base', () => {
    const mdFiles = walk(r('website'), (f) => f.endsWith('.md'))
    const offenders = mdFiles.filter((f) => /\/revealjs_gui\/demos\//.test(readFileSync(f, 'utf8')))
    expect(offenders, `stale upstream demo base:\n${offenders.join('\n')}`).toEqual([])
  })

  it('no tests/** spec imports the capture script (keeps it out of the CI gate)', () => {
    const specs = walk(r('tests'), (f) => /\.(test|spec)\.[jt]sx?$/.test(f))
    // Match an actual import/require of the script, not a bare mention (this
    // guard file names the script in its own assertions).
    const importRe = /(?:import|require)\s*\(?\s*['"][^'"]*capture-docs-screenshots[^'"]*['"]/
    const offenders = specs.filter((f) => importRe.test(readFileSync(f, 'utf8')))
    expect(offenders, `capture script must not be imported by tests:\n${offenders.join('\n')}`).toEqual([])
  })
})

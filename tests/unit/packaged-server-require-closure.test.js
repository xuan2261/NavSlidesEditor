import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { createRequire } from 'node:module'

const require_ = createRequire(import.meta.url)
const { verifyLocalRequireClosure } = require_('../../scripts/verify-runtime-closure.js')

const root = resolve(__dirname, '..', '..')

const makeTree = (files) => {
  const dir = mkdtempSync(join(tmpdir(), 'closure-'))
  for (const [name, content] of Object.entries(files)) {
    const filePath = join(dir, name)
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, content)
  }
  return dir
}

describe('packaged server require closure', () => {
  it('rejects relative requires whose target is missing in the packaged tree', () => {
    const dir = makeTree({
      'server/routes/a.js': "module.exports = require('../../shared/src/missing.js')",
    })
    try {
      expect(() => verifyLocalRequireClosure(join(dir, 'server'), dir)).toThrow(
        /unresolved require '\.\.\/\.\.\/shared\/src\/missing\.js'/
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('rejects relative requires resolving outside the packaged root', () => {
    const parent = mkdtempSync(join(tmpdir(), 'closure-parent-'))
    try {
      writeFileSync(join(parent, 'outside.js'), 'module.exports = {}')
      const dir = join(parent, 'pkg')
      mkdirSync(join(dir, 'server'), { recursive: true })
      writeFileSync(join(dir, 'server', 'a.js'), "module.exports = require('../../outside.js')")
      expect(() => verifyLocalRequireClosure(join(dir, 'server'), dir)).toThrow(
        /escapes packaged root/
      )
    } finally {
      rmSync(parent, { recursive: true, force: true })
    }
  })

  it('accepts relative requires that resolve inside the root', () => {
    const dir = makeTree({
      'server/routes/a.js': "module.exports = require('../util/b.js')",
      'server/util/b.js': 'module.exports = 1',
      'shared/src/x.js': 'module.exports = 2',
      'server/routes/c.js': "module.exports = require('../../shared/src/x.js')",
    })
    try {
      expect(() => verifyLocalRequireClosure(join(dir, 'server'), dir)).not.toThrow()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('keeps server source free of relative requires into shared/', () => {
    const escaped = []
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const entryPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules') walk(entryPath)
        } else if (entry.name.endsWith('.js')) {
          const source = readFileSync(entryPath, 'utf8')
          for (const match of source.matchAll(/require\(\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
            if (/^(\.\.\/)+shared\//.test(match[1])) escaped.push(`${entryPath}: ${match[1]}`)
          }
        }
      }
    }
    walk(join(root, 'server'))
    expect(escaped).toEqual([])
  })
})

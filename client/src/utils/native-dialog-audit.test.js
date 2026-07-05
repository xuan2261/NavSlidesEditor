import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..')
const CLIENT_SRC_ROOT = path.join(REPO_ROOT, 'client', 'src')
const EXCLUDED_DIRS = new Set(['__tests__'])
const EXCLUDED_SUFFIXES = ['.test.js', '.test.jsx', '.test.ts', '.test.tsx']

function collectSourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) return []
      return collectSourceFiles(fullPath)
    }
    if (!/\.(js|jsx)$/.test(entry.name)) return []
    if (EXCLUDED_SUFFIXES.some((suffix) => entry.name.endsWith(suffix))) return []
    return [fullPath]
  })
}

describe('native dialog audit', () => {
  it('keeps production UI flows on themed feedback surfaces', () => {
    const offenders = collectSourceFiles(CLIENT_SRC_ROOT).flatMap((filePath) => {
      const relativePath = path.relative(REPO_ROOT, filePath).replaceAll('\\', '/')
      const source = fs.readFileSync(filePath, 'utf8')
      return [...source.matchAll(/\b(alert|confirm)\s*\(/g)].map(
        (match) => `${relativePath}:${match[1]}`
      )
    })

    expect(offenders).toEqual([])
  })
})

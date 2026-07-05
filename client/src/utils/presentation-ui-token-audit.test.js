import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..')
const FILES = [
  'client/src/components/command-palette.jsx',
  'client/src/pages/RemoteControlPage.jsx',
  'client/src/pages/SpeakerViewPage.jsx',
]

describe('presentation UI token audit', () => {
  it('keeps app chrome color literals out of command and presentation shells', () => {
    const blocked = [/#1e1e2e/i, /#fff\b/i, /\btext-slate-400\b/, /\bhover:text-white\b/]
    const offenders = FILES.flatMap((relativePath) => {
      const source = fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
      return blocked
        .filter((pattern) => pattern.test(source))
        .map((pattern) => `${relativePath}:${pattern}`)
    })

    expect(offenders).toEqual([])
  })
})

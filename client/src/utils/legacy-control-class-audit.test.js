import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const CLIENT_SRC = path.resolve(import.meta.dirname, '..')
const LEGACY_CONTROL_CLASS = /\b(?:prop-input|btn-primary|btn-secondary)\b/

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(fullPath)
    return /\.(?:js|jsx|ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.js')
      ? [fullPath]
      : []
  })
}

describe('legacy control class audit', () => {
  it('does not use undefined prop-input or btn variant classes', () => {
    const offenders = sourceFiles(CLIENT_SRC)
      .filter((file) => LEGACY_CONTROL_CLASS.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(CLIENT_SRC, file))

    expect(offenders).toEqual([])
  })
})

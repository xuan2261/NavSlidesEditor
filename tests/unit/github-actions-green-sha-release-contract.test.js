import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..', '..')
const read = (file) => readFileSync(resolve(root, file), 'utf8').replace(/\r\n/g, '\n')

describe('exact green-SHA release workflow contract', () => {
  it('accepts only an existing tag and contains no synthetic tag path', () => {
    const workflow = read('.github/workflows/release.yml')
    expect(workflow).toContain('tag:')
    expect(workflow).not.toMatch(/(?<![a-z0-9_-])version:/)
    expect(workflow).not.toContain('v0.0.0-dev')
    expect(workflow).not.toMatch(/date \+%Y/)
    expect(workflow).toContain('git rev-parse "${TAG}^{commit}"')
    expect(workflow).toContain('refs/tags/${TAG}')
  })

  it('stages a draft on the existing tag before protected publication', () => {
    const workflow = read('.github/workflows/release.yml')
    const reusable = read('.github/workflows/reusable-green-sha-verification.yml')
    expect(workflow).toContain('draft: true')
    expect(workflow).toContain('environment: release-publication')
    expect(workflow).toContain('target_commitish:')
    expect(workflow).toContain('release-subject.mjs')
    expect(workflow).toContain('green-sha-root-receipt.json')
    expect(workflow).toContain('$manifest.subject.sha')
    expect(reusable).toContain('Import successful main-CI Linux receipt')
    for (const job of ['unit', 'e2e', 'load', 'docker', 'linux-receipt']) {
      const block = reusable.slice(reusable.indexOf(`  ${job}:`))
      expect(block).toContain("if: inputs.mode == 'ci'")
    }
  })
})

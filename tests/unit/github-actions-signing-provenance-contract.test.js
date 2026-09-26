import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..', '..')
const files = [
  '.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml',
  '.github/workflows/reusable-client-artifact.yml',
  '.github/workflows/reusable-container-supply-chain.yml',
  '.github/workflows/reusable-ci-quality.yml',
  '.github/workflows/reusable-docker-qualification.yml',
  '.github/workflows/reusable-green-sha-verification.yml',
  '.github/workflows/reusable-load-consumer.yml',
  '.github/workflows/reusable-playwright-consumer.yml',
  '.github/workflows/reusable-windows-qualification.yml',
  '.github/workflows/release.yml',
]
const read = (file) => readFileSync(resolve(root, file), 'utf8').replace(/\r\n/g, '\n')

describe('release signing and provenance contract', () => {
  it('pins every third-party action to an immutable commit', () => {
    for (const file of files) {
      for (const line of read(file)
        .split('\n')
        .filter((entry) => /\buses:/.test(entry))) {
        if (line.includes('./.github/workflows/')) continue
        expect(line, `${file}: ${line}`).toMatch(/uses:\s*[^@\s]+@[0-9a-f]{40}(?:\s+#.+)?$/)
      }
    }
  })

  it('keeps signing and publication protected and verifies downloaded assets', () => {
    const windows = read('.github/workflows/reusable-windows-qualification.yml')
    const release = read('.github/workflows/release.yml')
    expect(windows).toContain('environment: release-windows-signing')
    expect(windows).toContain('Get-AuthenticodeSignature')
    expect(windows).toContain('authenticode-policy.mjs')
    expect(release).toContain('post-download')
    expect(release).toContain('New-Item -ItemType Directory -Force evidence')
    expect(release).toContain('attestation-policy.mjs')
    expect(release).toContain('permissions:\n      contents: write')
  })
})

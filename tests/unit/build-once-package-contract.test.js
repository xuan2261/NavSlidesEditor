import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const dockerfile = readFileSync('Dockerfile', 'utf8')
const gitignore = readFileSync('.gitignore', 'utf8')

describe('build-once package contract', () => {
  it('makes the normal root build produce the verified client manifest', () => {
    expect(packageJson.scripts.build).toContain('npm run build --workspace=client')
    expect(packageJson.scripts.build).toContain(
      'scripts/ci/create-client-dist-manifest.mjs'
    )
    expect(packageJson.scripts.prestart).toContain('--require-client-dist')
    expect(gitignore).toMatch(/^client-dist-manifest\.json$/m)
  })

  it('keeps Docker source compilation single-pass before explicit manifest creation', () => {
    const sourceStage = dockerfile.match(
      /FROM vendor-builder AS source-client([\s\S]*?)FROM vendor-builder AS prebuilt-client/
    )?.[1]
    expect(sourceStage).toContain('BUILD_SUBJECT_SHA=')
    expect(sourceStage?.match(/npm run build/g)).toHaveLength(1)
    expect(sourceStage).not.toContain('create-client-dist-manifest.mjs')
  })
})

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..', '..')
const read = (...parts) => readFileSync(resolve(root, ...parts), 'utf8').replace(/\r\n/g, '\n')

describe('container supply-chain workflow contract', () => {
  it('scans the exact saved image with pinned SBOM and vulnerability tooling', () => {
    const docker = read('.github', 'workflows', 'reusable-docker-qualification.yml')
    const scan = read('.github', 'workflows', 'reusable-container-supply-chain.yml')

    expect(docker).toContain('docker save navslides-editor:ci')
    expect(docker).toContain('docker-image-digest.txt')
    expect(scan).toContain('anchore/sbom-action@3ad7283483fc7af8ff2b4ea19663c2d5ca935e26')
    expect(scan).toContain('aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25')
    expect(scan).toContain('syft-version: v1.52.0')
    expect(scan).toContain('version: v0.74.0')
    expect(scan).toContain('ignore-unfixed: false')
    expect(scan).toContain('verify-container-supply-chain.js')
  })

  it('makes scanning required in main CI and reruns it before release', () => {
    const main = read(
      '.github',
      'workflows',
      'github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml'
    )
    const release = read('.github', 'workflows', 'release.yml')
    const policy = JSON.parse(read('config', 'release-target-policy.json'))

    expect(main).toContain('container-supply-chain:')
    expect(main).toMatch(/required-checks:[\s\S]*- container-supply-chain/)
    expect(main).toContain('container-supply-chain-v1-')
    expect(main).toContain('release-target-policy-v1 evidence')
    expect(release).toContain('container-supply-chain:')
    expect(release).toMatch(/verification:[\s\S]*needs: \[resolve, container-supply-chain\]/)
    expect(policy.targets['linux-ci'].requiredGates).toContain('supply-chain')
  })
})

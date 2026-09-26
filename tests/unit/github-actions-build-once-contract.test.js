import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..', '..')
const read = (file) => readFileSync(resolve(root, file), 'utf8').replace(/\r\n/g, '\n')
const jobBlock = (workflow, name) => {
  const start = workflow.indexOf(`  ${name}:\n`)
  if (start < 0) return ''
  const next = workflow.slice(start + 1).match(/\n {2}[a-z0-9_-]+:\n/)
  return next ? workflow.slice(start, start + 1 + next.index) : workflow.slice(start)
}

describe('build-once reusable workflow contract', () => {
  it('compiles the client once and consumers verify downloaded bytes', () => {
    const workflow = read('.github/workflows/reusable-green-sha-verification.yml')
    const clientWorkflow = read('.github/workflows/reusable-client-artifact.yml')
    expect(`${workflow}\n${clientWorkflow}`.match(/\bnpm run build\b/g)).toHaveLength(1)
    expect(workflow).toContain('uses: ./.github/workflows/reusable-client-artifact.yml')
    for (const marker of ['e2e:', 'load:', 'docker:']) {
      const block = workflow.slice(workflow.indexOf(`  ${marker}`))
      expect(block).toContain('actions/download-artifact@')
      expect(block).toContain('verify-client-dist-manifest.mjs')
    }
    expect(workflow).toContain('production-prebuilt')
    expect(workflow).toContain('path: .tmp/ci-client-artifact')
    expect(workflow).not.toContain('path: .ci-prebuilt-client')
    expect(workflow.split('\n').length).toBeLessThan(200)
    expect(clientWorkflow.split('\n').length).toBeLessThan(200)
  })

  it('binds checkout and artifact names to the full subject SHA', () => {
    const workflow = read('.github/workflows/reusable-green-sha-verification.yml')
    const clientWorkflow = read('.github/workflows/reusable-client-artifact.yml')
    expect(clientWorkflow).toContain("ref: '${{ inputs.subject_sha }}'")
    expect(clientWorkflow).toContain('client-dist-v1-${{ inputs.subject_sha }}')
    expect(workflow).toContain('git rev-parse HEAD')
  })

  it('makes main CI consume one manifest-bound client artifact', () => {
    const ci = read(
      '.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml'
    )
    const clientWorkflow = read('.github/workflows/reusable-client-artifact.yml')
    const playwright = read('.github/workflows/reusable-playwright-consumer.yml')
    const load = read('.github/workflows/reusable-load-consumer.yml')
    const docker = read('.github/workflows/reusable-docker-qualification.yml')

    expect(ci).toContain('uses: ./.github/workflows/reusable-client-artifact.yml')
    expect(
      `${clientWorkflow}\n${ci}\n${playwright}\n${load}\n${docker}`.match(/\bnpm run build\b/g)
    ).toHaveLength(1)
    expect(ci).not.toContain('pull-requests: write')

    for (const name of ['e2e-chromium', 'e2e-pptx-import', 'e2e-live', 'e2e-mobile', 'e2e-visual']) {
      const block = jobBlock(ci, name)
      expect(block).toContain('uses: ./.github/workflows/reusable-playwright-consumer.yml')
      expect(block).toContain('client_artifact:')
      expect(block).not.toContain('npm run build')
    }
    expect(playwright).toContain(
      'actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093'
    )
    expect(playwright).toContain('verify-client-dist-manifest.mjs')
    expect(jobBlock(ci, 'load-smoke')).toContain(
      'uses: ./.github/workflows/reusable-load-consumer.yml'
    )
    expect(load).toContain('verify-client-dist-manifest.mjs')

    expect(jobBlock(ci, 'docker-artifact')).toContain(
      'uses: ./.github/workflows/reusable-docker-qualification.yml'
    )
    expect(docker).toContain('path: .tmp/ci-client-artifact')
    expect(docker).toContain('verify-client-dist-manifest.mjs')
    expect(docker).toContain('docker build --target production-prebuilt')

    const receipt = jobBlock(ci, 'linux-ci-receipt')
    expect(receipt).toContain('linux-ci-receipt-v1-${{ inputs.subject_sha || github.sha }}')
    expect(receipt).toContain('release-receipt-workflow.mjs linux')
    expect(receipt).toContain('needs.build.outputs.client_digest')
  })
})

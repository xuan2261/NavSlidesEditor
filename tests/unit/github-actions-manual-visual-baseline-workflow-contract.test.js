import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '..', '..')
const workflowPath = resolve(
  root,
  '.github',
  'workflows',
  'manual-update-playwright-visual-baselines.yml'
)

const readWorkflow = () => readFileSync(workflowPath, 'utf8').replace(/\r\n/g, '\n')

const getStepBlock = (workflow, marker) => {
  const start = workflow.indexOf(marker)
  if (start === -1) {
    return ''
  }

  const nextStep = workflow.indexOf('\n      - name:', start + marker.length)
  return nextStep === -1 ? workflow.slice(start) : workflow.slice(start, nextStep)
}

describe('manual visual baseline update workflow contract', () => {
  it('exists at the expected GitHub Actions path', () => {
    expect(existsSync(workflowPath), `${workflowPath} is missing`).toBe(true)
  })

  it('is a manual-only read-only workflow in the canonical Playwright container', () => {
    const workflow = readWorkflow()

    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).not.toMatch(/\n\s+(push|pull_request|schedule):/)
    expect(workflow).toContain('contents: read')
    expect(workflow).not.toContain('contents: write')
    expect(workflow).toContain('image: mcr.microsoft.com/playwright:v1.59.1-jammy')
  })

  it('updates and verifies both visual suites without weakening the command scope', () => {
    const workflow = readWorkflow()
    const updateIndex = workflow.indexOf('--update-snapshots')
    const verifyIndex = workflow.indexOf('Verify regenerated visual baselines')
    const updateStep = getStepBlock(workflow, '- name: Update visual baselines')
    const verifyStep = getStepBlock(workflow, '- name: Verify regenerated visual baselines')

    expect(workflow).toContain('npm ci')
    expect(workflow).toContain('npm run build')
    expect(updateIndex).toBeGreaterThan(-1)
    expect(verifyIndex).toBeGreaterThan(updateIndex)

    for (const step of [updateStep, verifyStep]) {
      expect(step).toContain('npx playwright test')
      expect(step).toContain('tests/e2e/visual/')
      expect(step).toContain('tests/e2e/visual-regression.spec.js')
    }

    expect(verifyStep).not.toContain('--update-snapshots')
  })

  it('uploads only approved snapshot PNGs as the baseline artifact', () => {
    const workflow = readWorkflow()
    const snapshotArtifactStep = getStepBlock(
      workflow,
      '- name: Upload Linux visual baseline snapshots'
    )

    expect(snapshotArtifactStep).toContain('actions/upload-artifact@v4')
    expect(snapshotArtifactStep).toContain('name: linux-playwright-visual-baseline-snapshots')
    expect(snapshotArtifactStep).toContain('tests/e2e/visual/**/*-snapshots/*.png')
    expect(snapshotArtifactStep).toContain(
      'tests/e2e/visual-regression.spec.js-snapshots/*.png'
    )
    expect(snapshotArtifactStep).not.toContain('tests/e2e/**')
    expect(snapshotArtifactStep).not.toContain('playwright-report/')
  })
})

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

const getTopLevelBlock = (workflow, key) => {
  const start = workflow.indexOf(`${key}:\n`)
  if (start === -1) {
    return ''
  }

  const nextTopLevel = workflow.slice(start + key.length + 2).match(/\n\S[^:\n]*:\n/)
  if (!nextTopLevel?.index) {
    return workflow.slice(start)
  }

  return workflow.slice(start, start + key.length + 2 + nextTopLevel.index)
}

const getLiteralBlockLines = (block, key) => {
  const lines = block.split('\n')
  const keyIndex = lines.findIndex((line) => line.trim() === `${key}: |`)
  if (keyIndex === -1) {
    return []
  }

  const literalLines = []
  for (const line of lines.slice(keyIndex + 1)) {
    if (!line.startsWith('            ')) {
      break
    }
    literalLines.push(line.trim())
  }

  return literalLines
}

describe('manual visual baseline update workflow contract', () => {
  it('exists at the expected GitHub Actions path', () => {
    expect(existsSync(workflowPath), `${workflowPath} is missing`).toBe(true)
  })

  it('is a manual-only read-only workflow in the canonical Playwright container', () => {
    const workflow = readWorkflow()
    const triggerBlock = getTopLevelBlock(workflow, 'on')

    expect(triggerBlock.trim()).toBe('on:\n  workflow_dispatch:')
    expect(workflow).toContain('contents: read')
    expect(workflow).not.toContain('contents: write')
    expect(workflow).toContain('image: mcr.microsoft.com/playwright:v1.59.1-jammy')
    expect(workflow).not.toMatch(/\bgit\s+(push|commit|tag)\b/)
    expect(workflow).not.toMatch(/\bgh\s+(pr|release)\b/)
    expect(workflow).not.toMatch(/peter-evans\/create-pull-request/i)
    expect(workflow).not.toMatch(/secrets\.[A-Z0-9_]*(PAT|TOKEN|GITHUB_TOKEN)/i)
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
    expect(getLiteralBlockLines(snapshotArtifactStep, 'path')).toEqual([
      'tests/e2e/visual/**/*-snapshots/*.png',
      'tests/e2e/visual-regression.spec.js-snapshots/*.png',
    ])
    expect(snapshotArtifactStep).not.toContain('playwright-report/')
  })
})

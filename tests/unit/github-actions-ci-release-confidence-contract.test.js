import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '..', '..')
const workflowPath = resolve(
  root,
  '.github',
  'workflows',
  'github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml'
)
const readText = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n')

const getJobBlock = (workflow, jobName) => {
  const start = workflow.indexOf(`  ${jobName}:\n`)
  if (start === -1) return ''
  const nextJob = workflow.slice(start + 1).match(/\n {2}[a-z0-9_-]+:\n/)
  return nextJob?.index ? workflow.slice(start, start + 1 + nextJob.index) : workflow.slice(start)
}

describe('CI release confidence contract', () => {
  it('keeps the feature matrix gate wired but warn-first during rollout', () => {
    const workflow = readText(workflowPath)
    const matrixGate = getJobBlock(workflow, 'feature-coverage-gate')
    const requiredChecks = getJobBlock(workflow, 'required-checks')

    expect(matrixGate).toContain('npm run matrix:gate')
    expect(matrixGate).toContain('warn-first, non-required')
    expect(requiredChecks).not.toMatch(/-\s*feature-coverage-gate\b/)
  })

  it('fans required-checks into the established blocking CI jobs', () => {
    const workflow = readText(workflowPath)
    const requiredChecks = getJobBlock(workflow, 'required-checks')

    for (const job of [
      'lint',
      'unit-coverage',
      'build',
      'e2e-chromium',
      'e2e-live',
      'e2e-mobile',
      'e2e-visual',
      'pptx-corpus',
      'load-smoke',
    ]) {
      expect(requiredChecks).toMatch(new RegExp(`- ${job}\\b`))
    }
  })

  it('keeps destructive load smoke scoped to loopback targets', () => {
    const workflow = readText(workflowPath)
    const loadSmoke = getJobBlock(workflow, 'load-smoke')
    const apiLoad = readText(resolve(root, 'tests', 'load', 'k6-load-test-api-presentations-post-endpoint-with-profiles.js'))
    const wsLoad = readText(resolve(root, 'tests', 'load', 'k6-load-test-socketio-websocket-room-join-and-slide-change-broadcast.js'))

    expect(loadSmoke).toContain("API_BASE_URL: 'http://127.0.0.1:3002/api'")
    expect(loadSmoke).toContain("WS_URL: 'ws://127.0.0.1:3002/ws/?EIO=4&transport=websocket'")
    expect(apiLoad).toContain('assertLoopbackUrl(BASE_URL')
    expect(wsLoad).toContain("assertLoopbackUrl(WS_URL, 'WS_URL'")
  })

  it('keeps the visual gate aligned with the documented Linux-only visual suites', () => {
    const workflow = readText(workflowPath)
    const visualJob = getJobBlock(workflow, 'e2e-visual')

    expect(visualJob).toContain('image: mcr.microsoft.com/playwright:v1.59.1-jammy')
    expect(visualJob).toContain('npx playwright test tests/e2e/visual/ tests/e2e/visual-regression.spec.js')
    expect(visualJob).not.toContain('--update-snapshots')
  })

  it('documents lanes, branch-protection rollout, rollback, quarantine, and scans', () => {
    const guide = readText(resolve(root, 'docs', 'navslides-editor-vitest-playwright-k6-testing-guide.md'))
    const checklist = readText(resolve(root, 'docs', 'manual-smoke-checklist.md'))
    const docs = `${guide}\n${checklist}`

    for (const requiredText of [
      'PR fast lane',
      'Merge full lane',
      'Release strict lane',
      'Branch protection mapping',
      'Rollback path',
      'Quarantine policy',
      'Secret and artifact scanning',
      'Operator action required',
      'operator-approved required-check behavior change',
      'rg --no-ignore --hidden',
    ]) {
      expect(docs).toContain(requiredText)
    }

    expect(docs).not.toContain('git grep')
  })
})

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '..', '..')
const readText = (...parts) => readFileSync(resolve(root, ...parts), 'utf8').replace(/\r\n/g, '\n')
const readJson = (...parts) => JSON.parse(readText(...parts))

const getRowsAfterHeading = (markdown, heading) => {
  const start = markdown.indexOf(`## ${heading}`)
  if (start === -1) return []
  const nextHeading = markdown.indexOf('\n## ', start + heading.length + 3)
  const section = nextHeading === -1 ? markdown.slice(start) : markdown.slice(start, nextHeading)
  return section
    .split('\n')
    .filter((line) => line.startsWith('| ') && !line.includes('---') && !line.includes('Mapping'))
}

const getTimeMinutes = (row) => {
  const timeCell = row.split('|')[3]?.trim() ?? ''
  const match = timeCell.match(/^(\d+)m$/)
  return match ? Number(match[1]) : Number.NaN
}

const getMappings = (row) => row.split('|')[2]?.trim() ?? ''

describe('release verification docs contract', () => {
  it('keeps manual smoke checklist bounded and mapped to capability IDs or manual risks', () => {
    const checklist = readText('docs', 'manual-smoke-checklist.md')
    const inventoryIds = new Set(readJson('scripts', 'feature-inventory', 'inventory.json').map((row) => row.id))
    const alwaysRows = getRowsAfterHeading(checklist, 'Always Run')
    const rotatingRows = getRowsAfterHeading(checklist, 'Rotating Domain Sample')
    const rows = [...alwaysRows, ...rotatingRows]
    const alwaysMinutes = alwaysRows.reduce((sum, row) => sum + getTimeMinutes(row), 0)
    const maxRotatingMinutes = Math.max(...rotatingRows.map(getTimeMinutes))

    expect(checklist).toContain('Target runtime: 35-45 minutes')
    expect(checklist).toContain('manual-risk: secret/artifact leak')
    expect(rows.length).toBeGreaterThanOrEqual(10)
    expect(alwaysMinutes + maxRotatingMinutes).toBeLessThanOrEqual(45)

    for (const row of rows) {
      const mapping = getMappings(row)
      const capIds = [...mapping.matchAll(/`([^`]+)`/g)].map((match) => match[1])

      expect(mapping).toMatch(/(`[^`]+`|manual-risk:)/)
      expect(Number.isNaN(getTimeMinutes(row))).toBe(false)

      for (const capId of capIds) {
        expect(inventoryIds.has(capId), `Unknown manual checklist capability ID: ${capId}`).toBe(true)
      }
    }
  })

  it('keeps release summary honest about matrix evidence, stale results, contract-only coverage, and debt', () => {
    const summary = readText(
      'plans',
      '260531-0511-full-feature-verification-gap-closure-tdd',
      'reports',
      'release-verification-summary.md'
    )

    for (const requiredText of [
      '90/100 editor-core verified',
      '10 ALLOWED',
      'run results are stale/missing',
      'Release-Blocking MVP',
      'Contract-Only Coverage',
      'full Playwright suite',
      'canvas.lock',
      'command.startSlideshow',
      'shortcut.penTool',
    ]) {
      expect(summary).toContain(requiredText)
    }
  })

  it('links final operating docs from the testing guide', () => {
    const guide = readText('docs', 'navslides-editor-vitest-playwright-k6-testing-guide.md')

    expect(guide).toContain('ci-gate-verification.md')
    expect(guide).toContain('manual-smoke-checklist.md')
  })
})

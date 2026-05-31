import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const PLAN_ID = '260524-0959-e2e-cleanup-and-coverage-tdd'
const PLAN_DIR_CANDIDATES = [
  process.env.PLAN_GATE_DIR,
  join('plans', PLAN_ID),
  join('plans', 'archive', PLAN_ID),
].filter(Boolean)
const runPlanGate = Boolean(process.env.RUN_PLAN_GATE)

function resolvePlanDir() {
  const planDir = PLAN_DIR_CANDIDATES.find((candidate) => existsSync(candidate))
  if (!planDir) {
    throw new Error(
      `RUN_PLAN_GATE=1 but no plan directory exists. Tried: ${PLAN_DIR_CANDIDATES.join(', ')}`
    )
  }
  return planDir
}

function parseFrontmatterStatus(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return null
  const statusMatch = match[1].match(/^status:\s*(.+)$/m)
  return statusMatch ? statusMatch[1].trim().replace(/^["']|["']$/g, '') : null
}

if (!runPlanGate) {
  describe.skip('plan completion gate', () => {
    it('is skipped unless RUN_PLAN_GATE is set', () => {})
  })
} else {
  describe('plan completion gate', () => {
    const planDir = resolvePlanDir()
    const phases = readdirSync(planDir)
      .filter((file) => /^phase-\d+.*\.md$/.test(file))
      .sort()

    for (const phase of phases) {
      it(`${phase} status=completed`, () => {
        const content = readFileSync(join(planDir, phase), 'utf8')
        expect(parseFrontmatterStatus(content)).toBe('completed')
      })
    }
  })
}

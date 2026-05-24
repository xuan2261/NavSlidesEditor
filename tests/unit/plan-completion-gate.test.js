import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const PLAN_DIR = 'plans/260524-0959-e2e-cleanup-and-coverage-tdd'

function parseFrontmatterStatus(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return null
  const statusMatch = match[1].match(/^status:\s*(.+)$/m)
  return statusMatch ? statusMatch[1].trim().replace(/^["']|["']$/g, '') : null
}

describe.skipIf(!process.env.RUN_PLAN_GATE)('plan completion gate', () => {
  const phases = readdirSync(PLAN_DIR)
    .filter((file) => /^phase-\d+.*\.md$/.test(file))
    .sort()

  for (const phase of phases) {
    it(`${phase} status=completed`, () => {
      const content = readFileSync(join(PLAN_DIR, phase), 'utf8')
      expect(parseFrontmatterStatus(content)).toBe('completed')
    })
  }
})

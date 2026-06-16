import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { ALLOWED_DEPTHS } from './extract-tags.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const policy = JSON.parse(
  readFileSync(resolve(HERE, 'coverage-depth-policy.json'), 'utf8')
)

describe('coverage depth policy', () => {
  it('keeps parser depth labels aligned with policy evidence definitions', () => {
    expect(Object.keys(policy.allowedDepths).sort()).toEqual(
      [...ALLOWED_DEPTHS].sort()
    )
  })

  it('uses only allowed depth labels in requirements', () => {
    for (const requirement of policy.requirements) {
      for (const depth of requirement.requiredDepths) {
        expect(ALLOWED_DEPTHS.has(depth)).toBe(true)
      }
    }
  })

  it('keeps requirements actionable and owned', () => {
    for (const requirement of policy.requirements) {
      expect(requirement.id).toMatch(/^[A-Za-z0-9._-]+$/)
      expect(requirement.owner).toBeTruthy()
      expect(Number.isInteger(requirement.resolutionPhase)).toBe(true)
      expect(requirement.requiredDepths.length).toBeGreaterThan(0)
    }
  })
})

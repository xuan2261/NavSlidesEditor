import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkCorpusEvidence, checkOracleBaseline, main } from './pptx-sla-1to1-cli.js'

describe('pptx-sla-1to1-cli (T8.7)', () => {
  it('T8.7 fails debt/module-only evidence for the product 1:1 milestone', async () => {
    const code = await main(['--milestone', 'phase08_full', '--json'])
    expect(code).toBe(1)
  })

  it('requires versioned numeric corpus evidence instead of module presence', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-sla-evidence-'))
    const baselinePath = path.join(dir, 'baseline.json')
    const milestone = {
      sceneGraphUnmappedMax: 0,
      chartGapMax: 0,
      smartArtGapMax: 0,
      permanentPlaceholderMax: 0,
      roundTripMin: 0.99,
    }
    try {
      await fs.writeFile(baselinePath, JSON.stringify({
        evidenceVersion: 2,
        summary: {
          avgRoundTripStability: 0.98,
          corpusEvidence: {
            sceneGraphUnmapped: 0,
            chartCoverageGapCount: 1,
            smartArtCoverageGapCount: 0,
            permanentPlaceholderCount: 0,
          },
        },
      }))
      const checks = await checkCorpusEvidence(milestone, baselinePath)
      expect(checks.find((check) => check.id === 'E2')?.ok).toBe(false)
      expect(checks.find((check) => check.id === 'R1')?.ok).toBe(false)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('rejects null, empty, and missing corpus metrics instead of coercing them to zero', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-sla-missing-evidence-'))
    const baselinePath = path.join(dir, 'baseline.json')
    try {
      await fs.writeFile(baselinePath, JSON.stringify({
        evidenceVersion: 2,
        summary: {
          avgRoundTripStability: 1,
          corpusEvidence: {
            sceneGraphUnmapped: null,
            chartCoverageGapCount: '',
            permanentPlaceholderCount: 0,
          },
        },
      }))
      const checks = await checkCorpusEvidence({
        sceneGraphUnmappedMax: 0,
        chartGapMax: 0,
        smartArtGapMax: 0,
        permanentPlaceholderMax: 0,
        roundTripMin: 0.99,
      }, baselinePath)
      expect(checks.find((check) => check.id === 'E1')?.ok).toBe(false)
      expect(checks.find((check) => check.id === 'E2')?.ok).toBe(false)
      expect(checks.find((check) => check.id === 'E3')?.ok).toBe(false)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('rejects non-numeric oracle metrics instead of coercing them', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-sla-oracle-evidence-'))
    const baselinePath = path.join(dir, 'baseline.json')
    try {
      await fs.writeFile(baselinePath, JSON.stringify({
        debt: false,
        deckCount: 1,
        meanSsim: null,
        minSsim: '',
      }))
      const checks = await checkOracleBaseline({}, baselinePath)
      expect(checks.every((check) => check.ok === false)).toBe(true)

      await fs.writeFile(baselinePath, JSON.stringify({
        debt: false,
        deckCount: '1',
        meanSsim: 1,
        minSsim: 1,
      }))
      const stringCountChecks = await checkOracleBaseline({}, baselinePath)
      expect(stringCountChecks.every((check) => check.ok === false)).toBe(true)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})

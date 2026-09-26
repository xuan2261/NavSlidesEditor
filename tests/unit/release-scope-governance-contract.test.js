import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  forbiddenClaims,
  openOwnerStatuses,
  requiredAuthorities,
  requiredClassifications,
} from './release-scope-governance-fixtures'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const manifestPath = resolve(
  root,
  'plans/260925-0631-single-user-powerpoint-native-fidelity-release-deep-tdd/reports/release-scope-manifest.json'
)
const readManifest = () => JSON.parse(readFileSync(manifestPath, 'utf8'))

describe('release scope governance contract', () => {
  it('publishes a canonical schema-version-one governance manifest', () => {
    expect(existsSync(manifestPath), `Missing ${manifestPath}`).toBe(true)
    const manifest = readManifest()

    expect(manifest.schemaVersion).toBe(1)
    expect(manifest.subject).toMatchObject({
      commit: expect.stringMatching(/^[0-9a-f]{40}$/),
      description: expect.any(String),
    })
    expect(manifest.baselineReport).toBe(
      'plans/260925-0631-single-user-powerpoint-native-fidelity-release-deep-tdd/reports/baseline-characterization.md'
    )
    expect(existsSync(resolve(root, manifest.baselineReport))).toBe(true)
  })

  it('classifies each explicit source exactly once and keeps every path reviewable', () => {
    const { entries } = readManifest()

    for (const [sourcePath, classification] of requiredClassifications) {
      const matches = entries.filter((entry) => entry.sourcePath === sourcePath)
      expect(matches, sourcePath).toHaveLength(1)
      expect(matches[0].classification).toBe(classification)
    }

    for (const entry of entries) {
      expect(existsSync(resolve(root, entry.sourcePath)), entry.sourcePath).toBe(true)
      for (const field of [
        'recordedStatus',
        'authoritativeOwner',
        'relationship',
        'reusableOutcome',
        'openWork',
        'claimCeiling',
        'freshnessRule',
        'subject',
      ]) {
        expect(entry[field], `${entry.sourcePath}: ${field}`).toEqual(expect.any(String))
        expect(entry[field].trim(), `${entry.sourcePath}: ${field}`).not.toBe('')
      }
    }
  })

  it('assigns one implementation authority per open release capability', () => {
    const { entries } = readManifest()

    for (const capability of requiredAuthorities) {
      const owners = entries.filter((entry) =>
        entry.authoritativeCapabilities?.includes(capability)
      )
      expect(
        owners.map((entry) => entry.sourcePath),
        capability
      ).toHaveLength(1)
      expect(owners[0].implementationScope).toBe(true)
    }
  })

  it('prevents contradictory status, completed-work duplication, and UI scope expansion', () => {
    const { entries } = readManifest()
    const completed = entries.filter((entry) => entry.classification === 'reuse-completed')
    const excludedUi = entries.filter((entry) => entry.classification.startsWith('excluded-'))
    const prerequisite = entries.find((entry) => entry.classification === 'open-prerequisite')
    const upstream = entries.find((entry) =>
      entry.sourcePath.includes('260523-0500-upstream-parity-verification-tdd')
    )

    expect(completed.length).toBeGreaterThan(0)
    for (const entry of completed) {
      expect(entry.recordedStatus).toMatch(/completed|implemented/i)
      expect(entry.relationship).toBe('reuse')
      expect(entry.implementationScope).toBe(false)
    }
    for (const entry of excludedUi) expect(entry.implementationScope).toBe(false)
    const openOwners = entries.filter((entry) => entry.classification === 'open-owner')
    expect(openOwners.map(({ sourcePath }) => sourcePath).sort()).toEqual(
      [...openOwnerStatuses.keys()].sort()
    )
    for (const [sourcePath, status] of openOwnerStatuses) {
      const matches = openOwners.filter((entry) => entry.sourcePath === sourcePath)
      expect(matches, sourcePath).toHaveLength(1)
      expect(matches[0].recordedStatus).toMatch(status)
    }
    expect(prerequisite?.recordedStatus).toMatch(/in-progress|pending/i)
    expect(prerequisite?.recordedStatus).not.toMatch(/^completed$/i)
    expect(upstream).toMatchObject({ relationship: 'historical', implementationScope: false })
  })

  it('locks single-user scope and blocks unsupported fidelity claim promotion', () => {
    const manifest = readManifest()

    expect(manifest.scopeLock).toMatchObject({
      productScope: 'single-user-self-hosted',
      builtInMultiTenantIdentity: false,
      trustedAuthorHtmlCssJs: true,
      externalAuthenticationRequiredForPublicExposure: true,
    })
    expect(manifest.fidelityVocabulary.map(({ id }) => id)).toEqual([
      'importer-corpus-qualification',
      'exact-original-recovery',
      'valid-edited-package',
      'exact-promoted-editable-rows',
      'environment-bound-powerpoint-evidence',
    ])
    expect(manifest.claims.forbidden).toEqual(expect.arrayContaining(forbiddenClaims))
    expect(manifest.claims.allowedAtPhaseEntry).not.toEqual(expect.arrayContaining(forbiddenClaims))
    expect(manifest.claims.conditionalAfterNamedGate).not.toEqual(
      expect.arrayContaining(forbiddenClaims)
    )
    for (const entry of manifest.entries) {
      expect(entry.provenClaims ?? []).not.toEqual(expect.arrayContaining(forbiddenClaims))
    }
  })

  it('stops before G0 while the physical OfficeCLI receipt is absent', () => {
    const { officeCliPreG0Decision } = readManifest()
    const receiptExists = existsSync(resolve(root, officeCliPreG0Decision.receiptPath))

    expect(receiptExists).toBe(false)
    expect(officeCliPreG0Decision).toMatchObject({
      status: 'blocked',
      observedReceipt: expect.stringMatching(/absent/i),
      decision: expect.stringMatching(/stop before G0/i),
    })
  })

  it('keeps deterministic ordering and reproducible baseline commands', () => {
    const manifest = readManifest()
    const keys = manifest.entries.map(
      ({ capability, sourcePath }) => `${capability}\0${sourcePath}`
    )
    const requiredCommands = [
      'git status --short',
      'git rev-parse HEAD',
      'git describe --tags --always --dirty',
      'npm run lint',
      'npm run build',
      'npm run test:coverage',
      'npm run test:pptx:importer-qualification',
      'npm run test:pptx:browser-audit:full',
      'npm run test:pptx:oracle:integrity',
    ]

    expect(keys).toEqual([...keys].sort())
    expect(manifest.baselineCommands.map(({ command }) => command)).toEqual(requiredCommands)
    for (const row of manifest.baselineCommands) {
      expect(row.outputLocation).toEqual(expect.any(String))
      expect(row.outputLocation.trim()).not.toBe('')
      expect(row.durationMs).toEqual(expect.any(Number))
      expect(row.durationMs).toBeGreaterThanOrEqual(0)
    }
  })
})

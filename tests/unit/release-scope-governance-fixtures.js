export const requiredClassifications = new Map([
  [
    'plans/260917-1500-pptx-native-strict-11-of-11-qualification-deep-tdd/plan.md',
    'reuse-completed',
  ],
  ['plans/260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd/plan.md', 'open-owner'],
  [
    'plans/260810-0921-verified-production-readiness-remediation-deep-tdd/plan.md',
    'open-prerequisite',
  ],
  ['plans/260821-1631-controls-elements-reveal-upgrade-deep-tdd/plan.md', 'reuse-completed'],
  ['plans/260820-0235-full-codebase-review/plan.md', 'reuse-completed'],
  [
    'plans/260726-0616-pptx-import-reliability-ux-evidence-hardening-deep-tdd/plan.md',
    'reuse-completed',
  ],
  ['plans/260724-1444-pptx-import-p1-p3-readiness-remediation-deep-tdd/plan.md', 'reuse-completed'],
  [
    'plans/260722-1630-pptx-import-p0-readiness-remediation-deep-tdd/plan.md',
    'blocked-evidence-owner',
  ],
  [
    'plans/260808-1700-pptx-export-fidelity-all-surfaces/plan.md',
    'characterize-then-reuse-or-residual',
  ],
  ['server/services/pptx-import/officecli/qualification-manifest.json', 'pinned-physical-input'],
  [
    'plans/260531-0511-full-feature-verification-gap-closure-tdd/reports',
    'informative-report-container',
  ],
  ['plans/260617-0739-element-control-audit-matrix-tdd/reports', 'informative-report-container'],
  [
    'plans/260708-1900-verified-ui-accessibility-ux-remediation-deep-tdd/plan.md',
    'excluded-ui-backlog',
  ],
  ['plans/260709-0913-verified-ui-findings-remediation-deep-tdd/plan.md', 'excluded-ui-backlog'],
  ['plans/260711-1038-editorpage-ui-ux-remediation-deep-tdd/plan.md', 'excluded-ui-backlog'],
  [
    'plans/archive/260522-0922-windows-electron-v1-9-1-release/plan.md',
    'historical-release-pattern',
  ],
  [
    'plans/archive/260521-2330-github-actions-visual-baseline-regeneration-tdd/plan.md',
    'historical-test-evidence',
  ],
  [
    'plans/archive/260522-1339-qa-confidence-uplift-5-phase-tdd/plan.md',
    'historical-test-evidence',
  ],
  ['plans/archive/260523-0900-smoke-test-bug-fixes-tdd/plan.md', 'historical-test-evidence'],
  ['plans/archive/260524-0959-e2e-cleanup-and-coverage-tdd/plan.md', 'historical-test-evidence'],
  [
    'plans/archive/260530-0854-feature-coverage-traceability-matrix-system-tdd/plan.md',
    'historical-test-evidence',
  ],
  [
    'plans/archive/260531-2013-test-system-governance-and-matrix-debt-tdd/plan.md',
    'historical-test-evidence',
  ],
  ['plans/archive/260611-0902-monorepo-review-remediation-tdd/plan.md', 'historical-test-evidence'],
  [
    'plans/archive/260615-1641-long-term-automated-coverage-expansion-tdd/plan.md',
    'historical-test-evidence',
  ],
  [
    'plans/archive/260629-2154-full-application-qa-verification-deep-tdd/plan.md',
    'historical-test-evidence',
  ],
  ['plans/archive/260524-1729-pptx-import-review/plan.md', 'historical-pptx-evidence'],
  [
    'plans/archive/260525-1450-pptx-import-unit-conversion-and-scale-fixes/plan.md',
    'historical-pptx-evidence',
  ],
  [
    'plans/archive/260527-1131-pptx-import-real-browser-fidelity-fixes/plan.md',
    'historical-pptx-evidence',
  ],
  [
    'plans/archive/260529-1942-pptx-import-parser-convention-fidelity-fixes-tdd/plan.md',
    'historical-pptx-evidence',
  ],
  [
    'plans/archive/260617-0814-pptx-import-strict-gates-and-ooxml-inspection-tdd/plan.md',
    'historical-pptx-evidence',
  ],
  [
    'plans/archive/260617-0815-pptx-import-gates-and-parser-coverage-tdd/plan.md',
    'historical-pptx-evidence',
  ],
  [
    'plans/archive/260709-1306-pptx-import-native-ooxml-1to1-fidelity-deep-tdd/plan.md',
    'historical-pptx-evidence',
  ],
  [
    'plans/archive/260523-0500-upstream-parity-verification-tdd/plan.md',
    'historical-upstream-only',
  ],
])

export const requiredAuthorities = [
  'package-first-edited-export',
  'production-readiness-prerequisite',
  'release-version-docs',
  'vitest-topology',
  'green-sha-release',
]

export const forbiddenClaims = [
  'multi-tenant-security',
  'universal-powerpoint-compatibility',
  'one-to-one-visual-fidelity-without-exact-oracle-evidence',
  'officecli-qualification-from-importer-corpus-evidence',
]

export const openOwnerStatuses = new Map([
  ['plans/260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd/plan.md', /in-progress/i],
  [
    'plans/260925-0631-single-user-powerpoint-native-fidelity-release-deep-tdd/phase-02-release-state-and-documentation-governance.md',
    /pending|implemented/i,
  ],
  [
    'plans/260925-0631-single-user-powerpoint-native-fidelity-release-deep-tdd/phase-03-vitest-topology-and-full-suite-performance.md',
    /pending/i,
  ],
  [
    'plans/260925-0631-single-user-powerpoint-native-fidelity-release-deep-tdd/phase-04-build-once-ci-and-green-sha-release.md',
    /pending/i,
  ],
])

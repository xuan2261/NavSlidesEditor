---
phase: 8
title: "CI Evidence Governance"
status: completed
priority: P1
dependencies: [1, 2, 3, 4, 5, 6, 7]
---

# Phase 8: CI Evidence Governance

## Overview
Turn the QA system into enforceable release gates with fast/full/nightly lanes, machine-readable evidence, and clear failure ownership.

## Requirements
- Functional: define what runs on PR, main, manual release, visual baseline refresh, nightly/full verification, and Electron desktop/package readiness.
- Non-functional: keep PR lane practical, make full lane comprehensive, and avoid blocking developers on slow optional tests unless release-targeted.

## Architecture
Use existing npm scripts and GitHub Actions contracts. Add evidence reports under plan/report outputs or CI artifacts, not source docs unless explicitly requested.

## Related Code Files
- Modify: `.github/workflows/*.yml`
- Modify: `package.json`
- Modify: `tests/unit/github-actions-ci-release-confidence-contract.test.js`
- Modify: `tests/unit/release-verification-docs-contract.test.js`
- Modify: `scripts/feature-inventory/*`
- Modify: `electron/main.js` tests or desktop smoke harness if missing
- Modify: `electron/preload.js` tests or preload contract harness if missing
- Create: `plans/260629-2154-full-application-qa-verification-deep-tdd/reports/release-evidence-template.md`

## Implementation Steps
1. Define lanes:
   - PR fast: lint, unit, matrix gate, focused E2E smoke.
   - Main/full: coverage, full E2E, visual/a11y, corpus, PPTX strict.
   - Nightly/manual: load smoke, Electron readiness, full browser PPTX audit, optional external-provider checks.
   - Desktop release: Electron startup smoke, preload contract, embedded server behavior, packaged app launch, data directory persistence, and offline/no-network smoke where feasible.
2. Add CI contract tests ensuring required commands stay wired.
3. Emit evidence: matrix summary, coverage summary, E2E report, visual diff status, a11y status, corpus status, load status.
4. Add triage rules: P1 failures block release; P2 failures require explicit waiver; P3 failures become backlog.
5. Validate from clean checkout where feasible.

## TDD Gate
- Red: add CI contract tests that fail when a required gate is missing.
- Green: wire scripts/workflows until contract tests pass.

## Success Criteria
- [x] Release gate cannot pass with missing P1 matrix coverage.
- [x] CI artifacts identify exact failing capability IDs through matrix rows.
- [x] Developers can run the same gates locally with documented npm commands in plan evidence.
- [x] Desktop release artifacts are now represented by Electron inventory rows and remain warning-gated until executable smoke evidence exists.

## Risk Assessment
Risk: full QA suite becomes too slow. Mitigation: separate fast/full/nightly lanes and enforce only the right depth at the right time.

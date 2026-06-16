---
title: "Red Team Review Report"
type: report
created: 2026-06-15
plan: ../plan.md
---

# Red Team Review Report

## Summary

Reviewed the plan with four hostile lenses: Security Adversary, Failure Mode Analyst, Assumption Destroyer, and Scope & Complexity Critic. Found 8 actionable issues. Accepted all 8 and patched plan files.

## Red Team Findings

### Finding 1: Coverage-depth taxonomy can become a vanity metric - High

Reviewer: Scope & Complexity Critic  
Location: Phase 2, Requirements / Architecture  
Flaw: The plan added depth labels without strict evidence definitions.  
Failure scenario: Tests get tagged `depth:persistence` without asserting reload/serialization, making the new matrix as shallow as the old one.  
Disposition: Accept  
Applied: Added allowed depth labels and required evidence table.

### Finding 2: E2E expansion lacks test-count/time budget - High

Reviewer: Failure Mode Analyst  
Location: Phase 4, Requirements  
Flaw: "Add durable Playwright workflows" can grow without bound.  
Failure scenario: CI gets slower and flakier, then teams weaken or skip E2E checks.  
Disposition: Accept  
Applied: Added default cap of 8 new E2E specs / 12 browser tests and runtime buckets.

### Finding 3: External-boundary phase may create production abstractions only for tests - High

Reviewer: Scope & Complexity Critic  
Location: Phase 5, Implementation Steps  
Flaw: Injectable seams were allowed too casually.  
Failure scenario: Production service code becomes harder to read just to satisfy mocks.  
Disposition: Accept  
Applied: Added public-boundary-first testing and exception documentation.

### Finding 4: Visual/a11y/perf phase can destabilize CI - High

Reviewer: Failure Mode Analyst  
Location: Phase 6, Success Criteria / Risk  
Flaw: Promotion criteria were too vague for snapshot/perf gates.  
Failure scenario: A flaky visual or k6 threshold blocks unrelated PRs.  
Disposition: Accept  
Applied: Added lane ownership, reproduction command, and two-green-run promotion proof.

### Finding 5: Baseline audit can produce a report but no actionable backlog - High

Reviewer: Assumption Destroyer  
Location: Phase 1, Success Criteria  
Flaw: "Baseline report lists concrete gaps" was not structured enough.  
Failure scenario: Cook starts Phase 2 with narrative notes but no prioritized implementation queue.  
Disposition: Accept  
Applied: Added required backlog columns.

### Finding 6: Manual smoke shrinkage can hide real manual-only risks - Medium

Reviewer: Assumption Destroyer  
Location: Phase 7, Implementation Steps  
Flaw: The plan encouraged shrinking manual smoke without equivalence rules.  
Failure scenario: A visual/manual risk is removed because one unrelated automated assertion exists.  
Disposition: Accept  
Applied: Added row-level manual disposition and equivalence requirement.

### Finding 7: Security testing boundary is under-specified for trusted author content - Medium

Reviewer: Security Adversary  
Location: Phase 3 and Phase 5, Security Considerations  
Flaw: Tests could attack intentional trusted-author HTML instead of real trust boundaries.  
Failure scenario: Implementer "fixes" tests by breaking HTML embeds or programmable slide content.  
Disposition: Accept  
Applied: Added trust-boundary-only negative test guidance.

### Finding 8: CI promotion rule is too vague for operator action - Medium

Reviewer: Failure Mode Analyst  
Location: Phase 7, Requirements / Success Criteria  
Flaw: "local reliability is proven" was not auditable.  
Failure scenario: Required checks change without evidence or owner approval.  
Disposition: Accept  
Applied: Added promotion evidence requirement and operator-approval guard.

## Files Modified

- `../plan.md`
- `../phase-01-baseline-audit-and-risk-taxonomy.md`
- `../phase-02-coverage-matrix-expansion-model.md`
- `../phase-03-unit-and-component-deep-coverage.md`
- `../phase-04-end-to-end-workflow-expansion.md`
- `../phase-05-external-boundary-contract-coverage.md`
- `../phase-06-visual-accessibility-and-performance-gates.md`
- `../phase-07-ci-governance-docs-and-release-adoption.md`

## Unresolved Questions

- None.

---
title: "Element capability source of truth: make drift fail loudly"
date: 2026-07-22 14:17 +07:00
status: completed
plan: plans/archive/260705-1430-element-capability-source-of-truth-remediation-deep-tdd/plan.md
---

# Element Capability Source of Truth: Make Drift Fail Loudly

## Context

[`260705-1430-element-capability-source-of-truth-remediation-deep-tdd`](../archive/260705-1430-element-capability-source-of-truth-remediation-deep-tdd/plan.md) was a P0 corrective plan, not a feature expansion. It addressed six confirmed ways the editor’s element contracts could disagree: canonical schema/JSDoc, game defaults, capability evidence, PPTX policy, client/server dispatch, and Format-ribbon coverage. AgentWiki publication is skipped because external sharing was not authorized.

## What happened

On 2026-07-06, commit `ae158c7d` completed the six phases. [`ELEMENT_DEFAULTS`](../../client/src/data/element-defaults.js) remained the runtime authority for the 19 canonical types; schema drift tests rejected stale `qr`/`divider` claims and mismatched high-risk fields. Game defaults for all ten subtypes moved behind one defaults builder with mutation-isolation coverage, so nested arrays or objects cannot be shared between created elements.

The plan extended the existing [`feature-inventory`](../../scripts/feature-inventory/) validator instead of inventing another matrix. Every canonical type now needs an explicit create, canvas, properties, Format-ribbon, HTML-export, and PPTX-export decision. [`pptx-export-policy.js`](../../shared/src/pptx-export-policy.js) made six export modes shared package policy, and both dispatchers consume that classification. The ribbon gained an explicit policy rather than a cosmetic redesign.

The frustrating truth is that the product had been calling `ELEMENT_DEFAULTS` canonical while several adjacent systems quietly disagreed. That was not an edge case; it was a governance failure waiting to make the next element addition lie about support.

## Impact

Missing coverage is now a gate failure rather than an omission hidden behind a generic “works” claim. Unsupported PPTX paths remain visible as deliberate fallback, placeholder, or live-only behavior; native parity was never promised. Text and other non-contextual ribbon cases must name a verified alternate surface instead of passing on a default label.

## Decisions

- Kept `ELEMENT_DEFAULTS` authoritative; JSDoc mirrors it and cannot become a competing schema.
- Reused the generated feature-inventory matrix; a second client-side matrix was rejected because it would recreate the drift this work was supposed to remove.
- Preserved HTML/LaTeX `server-prefetch-raster` failures rather than silently downgrading them to placeholders.
- Rejected a broad `EditorPage.jsx` or ribbon rewrite; accepted limits are valid only with an executable alternate-control-surface policy.

## Concerns / limitations

[`Phase 6`](../archive/260705-1430-element-capability-source-of-truth-remediation-deep-tdd/phase-06-final-verification-and-regression-sweep.md) records passing focused tests plus `npm run test`, lint, build, matrix regeneration, and `matrix:gate`. The plan preserves checkbox evidence, not terminal transcripts or an immutable CI artifact, and this archival entry did not rerun those commands on 2026-07-22. Treat the result as historical completion evidence, not a current-release certification. PPTX fallback and static/live-only game export remain intentional product limits.

## Next

- **Archive coordinator — now:** archive the completed plan while retaining the live defaults, feature-inventory validator, and shared PPTX policy.
- **Element/export owner — before adding or reclassifying a type:** update the canonical defaults and required matrix/policy rows, then run the relevant drift and matrix gates.
- **Release owner — before a release touching these surfaces:** rerun the Phase 6 commands instead of relying on this historical record.

Unresolved questions: None.

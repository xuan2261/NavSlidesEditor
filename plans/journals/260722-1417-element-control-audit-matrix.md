---
title: "Element control audit matrix: gate before claims"
date: 2026-07-22 14:17 +07:00
status: completed
plan: plans/260617-0739-element-control-audit-matrix-tdd/plan.md
---

# Element Control Audit Matrix: Gate Before Claims

## Context

[`260617-0739-element-control-audit-matrix-tdd`](../260617-0739-element-control-audit-matrix-tdd/plan.md) was a P0 corrective QA plan for the editor's 19 canonical element types. Its job was not to manufacture universal parity; it was to make each `element/control/surface` claim executable across canvas, HTML export, and PPTX export. Publication was not attempted: AgentWiki is skipped because external sharing was not authorized.

## What happened

On 2026-06-17, commit `51781f0b` delivered the eight completed phases: a full expected-control inventory, a 133-row matrix, validator, `matrix:gate`, focused control tests, export-warning contract, and docs. The root cause was blunt: prose status was lying by omission. One aggregate “works” label could conceal a broken or unsupported surface, and a skeleton matrix could go green while whole controls were missing.

The team rejected a high-risk-only skeleton, an `EditorPage.jsx` rewrite, and new authoring UI merely to improve a status. Instead it required full inventory coverage before fixes, per-surface rows, evidence, tests, and explicit `partial`/`export-gap` decisions. The final gate recorded `100/100` feature-matrix verification, `133` element-control rows, `0` warnings/failures, `3` PPTX browser-audit passes, a successful production build, and no redaction-scan matches. Targeted export tests passed `16 + 81` tests.

On 2026-06-19, commit `c89a20cf` extended the generated matrix for teaching-interactivity work from 133 to 141 rows: Mermaid and STEM HTML authoring gained explicit canvas/editor/HTML-export evidence while PPTX remained a warned export gap. On 2026-07-06, `ae158c7d` repaired capability-source drift by expanding validator support for explicit capability-policy statuses and enforcing policy/alternate-surface metadata.

## Impact

The plan replaced untestable confidence with a gate that rejects missing canonical elements, absent expected controls, ambiguous mixed-surface rows, inadequate evidence, and missing content-security metadata. It also made PPTX degradation visible: structured warnings carry `elementId`, `elementType`, `control`, `surface`, `matrixRowId`, `severity`, `message`, and `fallback`, while preserving the legacy warning array.

## Decisions

- Keep `src` canonical and retain legacy `videoUrl` as a non-destructive fallback; deleting it during migration risked losing saved-deck media.
- Keep image-border authoring and table merge/unmerge as honest `partial` scope rather than inventing UI for an audit checkbox.
- Preserve trusted-author HTML behavior; use warnings, policy, negative tests, and docs instead of pretending a broad sandbox/CSP redesign occurred.
- Treat dynamic/live elements and real PPTX limits as fallback or accepted-limit contracts, never as silent native support.

## Concerns / limitations

The 2026-06-17 lint run had `0` errors but `23` pre-existing unrelated warnings. Its successful gates are historical evidence, not a fresh 2026-07-22 rerun. The `133` count is likewise historical; later work expanded the matrix to 141 rows and changed the validator vocabulary. Do not reuse either number as a current guarantee without rerunning the gate.

## Next

- **Archive coordinator — now:** retain this journal, then archive the completed plan without deleting the live matrix source, expected-control inventory, or validator.
- **Element-control change owner — before any future `works` claim:** run `npm run matrix:gate`; rerun `npm run test:pptx:browser-audit` when export rows change.
- **Release owner — before release:** resolve or explicitly accept the remaining lint warnings and current PPTX fallback limits.

Unresolved questions: None.

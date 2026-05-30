# Feature Coverage Traceability Matrix: QA Tooling for Editor-Core

**Date**: 2026-05-30 17:45
**Severity**: Medium (tooling, not production)
**Component**: `scripts/feature-inventory/`, `docs/feature-coverage-matrix.md`, CI
**Status**: Resolved

## What Happened

6-phase TDD plan delivered a living feature-coverage traceability matrix for editor-core. System auto-inventories 100 editor-core capabilities (19 element types, 44 keyboard shortcuts, canvas ops, ribbon controls, commands, flows), maps each to verifying tests via `[cap:<id>]` title tags, joins tags against ACTUAL vitest/playwright run-status, and emits a PASS/FAIL/GAP/DEEP-GAP matrix (markdown + JSON). CI gate + two drift-guard layers make it self-maintaining.

Final state: 73/100 PASS, 27 allowlisted (dated, reasoned), 0 un-allowlisted gaps, gate green, 130 tests pass.

## The Brutal Truth

The system's entire charter is "no false confidence." It nearly shipped with a false-PASS bug.

`resolveStatus` matched run results bidirectionally — `occ.includes(row) OR row.includes(occ)` — so a runtime-skipped tagged test could bind to a passing untagged sibling whose title happened to be a substring. A skipped test would show PASS. The code-reviewer subagent caught it empirically. Fixed to single safe direction: run row's `fullTitle` must CONTAIN the tagged occurrence title. Untagged siblings never carry `[cap:*]`, so they cannot false-match.

If that bug had shipped, the matrix would have been worse than no matrix — it would have given false green on skipped tests, which is exactly the failure mode the whole system exists to prevent.

## Technical Details

Three tooling bugs surfaced by the matrix itself during development:

**1. camelCase regex truncation** — `[cap:*]` extractor used `[a-z0-9.\-]` (lowercase only). `shortcut.blackScreen` truncated to `shortcut.black`. 17 orphan tags appeared in the matrix during Phase 3. Fixed regex to `[A-Za-z0-9._-]`.

**2. describe-tag join miss** — deep tests tagged `describe()` blocks. vitest reports describe titles as `ancestorTitles`, not the leaf `it()` title. Join only matched leaf titles → 6 deep caps showed TAGGED not PASS. Fixed join to record `fullTitle` (ancestors + leaf concatenated).

**3. false-PASS via bidirectional substring match** — described above. Caught in code review, not by the matrix (the matrix cannot audit its own join logic).

Key scripts under `scripts/feature-inventory/`: `build-inventory.mjs`, `extract-tags.mjs`, `join-run-status.mjs`, `build-matrix.mjs`, `check-coverage-gate.mjs`, `check-manifest-completeness.mjs`. Allowlist: `coverage-gate-allowlist.json` (27 dated entries).

## What We Tried

Phase 3 retrofitted `[cap:*]` tags onto ~30 existing passing tests — title edits only, no assertion changes. Matrix went 0→44 verified. Phase 4 smoke tests added 17 element factory tests + 6 format controls + canvas resize: 44→73.

Phase 5 (tier:deep behavior tests) used verify-before-assert discipline: read implementation first, then assert to verified behavior. Found zero logic bugs in high-risk caps — rotate-snap 15° snapping, resize aspect-ratio lock, align/distribute geometry, group/ungroup, table merge spans, multiselect were all already correct. The tests document behavior; they didn't fix it.

27 caps deferred to allowlist rather than faked green: canvas z-order, undo/redo flow, chart-mapping, timeline-scaling — all logic inline in `EditorPage.jsx` or JSX renderers with no clean test seam. Refused to restructure source purely for a test seam (YAGNI). Each allowlist entry has a dated reason + extraction path.

## Root Cause Analysis

No single root cause — greenfield tooling. The interesting meta-observation: a system designed to catch gaps in test coverage had gaps in its own coverage. The extractor regex and join logic were both wrong in ways that only became visible when matrix output was inspected against known-tagged tests. The false-PASS bug was invisible to the matrix entirely — required human code review to catch.

The system surfaced its own extractor defects (bugs 1 and 2) through anomalous output: orphan tags and TAGGED-not-PASS entries that shouldn't have existed. That's the right failure mode — loud and visible. Bug 3 was silent and required a reviewer.

## Lessons Learned

- **A coverage tool that can false-green is worse than no tool.** The bidirectional substring match was subtle and plausible-looking. Code review on join logic is mandatory, not optional.
- **Run-status join is the whole point.** A tag shows PASS only if its test ACTUALLY RAN GREEN. Anything that weakens that invariant destroys the system's value.
- **The matrix surfaced its own extractor bugs.** Orphan tags and TAGGED-not-PASS anomalies in the output were the signal. Build the output first, then inspect it — don't trust tooling until it's been wrong at least once.
- **Allowlist > fake green.** 27 honest deferred entries with extraction paths are more useful than 27 tests that restructure source code to create artificial seams.
- **JSON manifest, not YAML.** Zero new deps. The project mandates dependency-light; this was the documented fallback for Open-Question-7 in the plan and the right call.

## Next Steps

- Any new `EditorPage.jsx` command not in `feature-manifest.json` fails `check-manifest-completeness.mjs` at CI. Drift guard is live — no owner action needed.
- Work down the 27 allowlist entries over time as extraction opportunities arise. Each entry has a recorded path. No hard deadline.
- `isRunResultStale()` flag warns if run-results JSON is >24h old. Ensure CI always regenerates before gate check — stale results silently degrade the matrix.
- Owner: any dev adding editor-core capabilities. The gate will tell them when they've missed a tag.

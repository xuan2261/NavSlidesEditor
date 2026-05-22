---
phase: 1
title: "Foundation-mini: 5 Revised Golden Paths (MVP scope)"
status: pending
priority: P1
effort: "0.5d"
dependencies: []
---

# Phase 1-mini: Foundation — 5 Revised Golden Paths (MVP)

## Overview

MVP scope (validated 2026-05-22): ship `docs/critical-user-journeys.md` with 5 REVISED golden paths only. **DEFERRED**: full feature × test layer matrix (160 cells, ~1-2d additional work) to follow-up plan. Revision per QA red-team: drop "Insert-All-13-Elements" (catalog, not journey, already covered by per-element specs); add Live-Reconnect + AI-Failures + extend Import to "with-edits".

## Requirements

**Functional:**
- `docs/critical-user-journeys.md`: 5 REVISED golden paths, each has (a) name, (b) steps, (c) acceptance, (d) Playwright spec link
- Each GP maps to ≥ 1 existing spec in `tests/e2e/` (verified by contract test)
- **DEFERRED to follow-up**: full `docs/feature-test-matrix.md` (≥ 90% feature coverage from PDR)

**Non-functional:**
- File ≤ 200 LOC (CLAUDE.md constraint)
- Markdown lint pass
- Internal link checker pass (linked spec files must resolve)

## Architecture

```
docs/
└── critical-user-journeys.md     # 5 revised GPs (MVP)

tests/unit/qa-foundation/
├── critical-user-journeys-doc-presence-and-structure.test.js
└── golden-path-spec-links-resolve.test.js
```

**5 REVISED Golden Paths (validated 2026-05-22):**

1. **GP-01 Create-Edit-Persist** (kept): Home → New presentation → Insert text → Edit → Save → Reload → Verify content preserved
2. **GP-02 Live-Presentation-Reconnect** (NEW, replaces Insert-All-Elements): Start live present → viewer joins → presenter network drops 30s → presenter reconnects → viewer slide state stays in sync → annotation broadcast resumes
3. **GP-03 PPTX-Import-Roundtrip-with-Edits** (extended): Import sample PPTX → make 3 user edits (text change, image swap, slide reorder) → Export PPTX → Import again → assert edits survive (semantic JSON match)
4. **GP-04 AI-Generate-Slide-with-Failures** (NEW): Open AI generate modal → submit prompt with INVALID api key → assert clear error UX (not silent fail) → fix key → assert rate-limit 429 → assert retry-after honored → assert success path
5. **GP-05 Share-Password-Revoke** (kept): Generate share token with password → access link → verify password gate → revoke → verify 404

## Related Code Files

**Create:**
- `docs/critical-user-journeys.md`
- `tests/unit/qa-foundation/critical-user-journeys-doc-presence-and-structure.test.js`
- `tests/unit/qa-foundation/golden-path-spec-links-resolve.test.js`

**Read for context:**
- `tests/e2e/*.spec.js` (verify spec paths exist for each GP)
- `tests/e2e/live/` (GP-02 candidate specs)
- `tests/e2e/pptx-import-fidelity.spec.js` (GP-03 candidate)
- `tests/e2e/ai.spec.js` (GP-04 candidate — verify exists)
- `tests/e2e/share/` (GP-05 candidate)

**Modify:** None (additive only)

**Deferred (follow-up plan):**
- `docs/feature-test-matrix.md`
- `tests/unit/qa-foundation/feature-test-matrix-completeness.test.js`
- `tests/unit/qa-foundation/_matrix-parser.js`

## Implementation Steps (TDD)

### Red — Failing tests first

1. **Test 1: doc presence + structure**
   - Create `tests/unit/qa-foundation/critical-user-journeys-doc-presence-and-structure.test.js`
   - Assert file exists, contains exactly 5 H2 sections matching `^## GP-0[1-5] `, each has `### Steps`, `### Acceptance`, `### Spec mapping`
   - Run → **FAIL** (file doesn't exist)
   - Commit: `red: phase-1 add failing test for critical-user-journeys doc shape`

2. **Test 2: golden path spec links resolve**
   - Create `golden-path-spec-links-resolve.test.js`
   - Parse `### Spec mapping` blocks from `critical-user-journeys.md`
   - Extract spec paths
   - Assert each `fs.existsSync(path)` === true
   - Also assert spec file content references the GP ID (grep for `GP-01` etc. in spec text) — prevents fake-tagging
   - Run → **FAIL**
   - Commit: `red: phase-1 add failing test for spec link resolution + GP-ID grep`

### Green — Write the doc

3. **Write `critical-user-journeys.md`**
   - H1 + intro (5 lines, explain MVP scope, defer matrix to follow-up)
   - 5 H2 sections GP-01 → GP-05 (REVISED set above)
   - Each: ### Steps (numbered), ### Acceptance (checklist), ### Spec mapping (existing spec path)
   - Map to existing specs:
     - GP-01 → `tests/e2e/smoke.spec.js` + `tests/e2e/editor.spec.js`
     - GP-02 → `tests/e2e/live/*` (verify which spec covers reconnect; if none, mark as gap to fill before Phase 2)
     - GP-03 → `tests/e2e/pptx-import-fidelity.spec.js` (verify if extended-edits scenario covered; if not, gap)
     - GP-04 → `tests/e2e/ai.spec.js` (verify failure-mode coverage; if not, gap)
     - GP-05 → `tests/e2e/share/share-link-with-password-protection-and-verification.spec.js`
   - **If gap identified**: note in GP doc + create follow-up issue, but doc still completes (Phase 2 will cover gap detection)
   - Add GP-ID string in spec file `test.describe` or comment (for link-resolve test to grep)
   - Run tests → **PASS** Test 1 + Test 2
   - Commit: `green: phase-1 add critical-user-journeys doc with 5 revised golden paths`

### Refactor

4. **Update** `docs/codebase-summary.md` to reference the new GP doc
5. Commit: `refactor: phase-1 link GP doc from codebase-summary`

## Todo List

- [ ] Write failing test for critical-user-journeys doc shape (red)
- [ ] Write failing test for spec link resolution + GP-ID grep (red)
- [ ] Write `docs/critical-user-journeys.md` with 5 REVISED GPs (green)
- [ ] Verify spec mapping — note gaps if any (green)
- [ ] Update `docs/codebase-summary.md` (refactor)
- [ ] Run `npm run lint && npm run test tests/unit/qa-foundation/` — all green

## Success Criteria

- [ ] `npm run test tests/unit/qa-foundation/` — 2 tests pass
- [ ] `critical-user-journeys.md` ≤ 200 LOC, 5 REVISED GPs with structure
- [ ] Every spec path in GP mappings resolves on filesystem
- [ ] Every linked spec contains GP-ID string (grep verifiable)
- [ ] `git log --oneline` shows red → green → refactor commits in order

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Existing specs don't cover all 5 revised GPs (esp GP-02 reconnect, GP-04 AI failures) | Note gap in doc, create follow-up issues for spec gaps, Phase 2 smoke will surface real coverage |
| GP-ID grep false-positive (spec mentions GP-01 in comment but doesn't test it) | Trade-off accepted; better than no link validation. Improve in follow-up if needed |
| GP-02 reconnect spec needs real network-drop simulation | Use Playwright `page.context().setOffline(true)` — known pattern in `tests/e2e/live/` |

## Security Considerations

- Doc contains no share tokens, passwords, user emails
- Spec links are relative repo paths only

## Next Steps

- Phase 2 (Electron smoke) maps GP-01 + subset to packaged context
- Phase 3 manual checklist will reference these 5 GPs as the automation-covered set
- Phase 5 CI split tags these 5 GPs with `@smoke` for PR fast lane
- **Follow-up plan**: build full feature × test layer matrix (160 cells) — separate work item

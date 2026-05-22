---
phase: 3
title: "Manual Smoke Checklist (45-min EN) + Bug-Bash Process + Kill-Switch (MVP-lite)"
status: pending
priority: P1
effort: "1d"
dependencies: [1]
---

# Phase 3-lite: Manual Smoke Checklist + Bug-Bash + Kill-Switch (MVP)

## Overview

MVP-lite scope (validated 2026-05-22): ship EN-only 45-min checklist (NOT 30-min — red-team showed unrealistic) + bug-bash process doc + beta-feedback issue template + **kill-switch decision tree** (NEW, for critical bug 24h pre-release). **DEFERRED**: Vietnamese mirror, matrix-to-checklist generator script. Generator script requires Phase 1 full matrix (deferred), so it's blocked anyway.

## Requirements

**Functional:**
- `docs/manual-smoke-checklist.md`: **45-min** EN-only checklist on packaged Electron app
- `docs/bug-bash-process.md`: bug-bash quy trình (cadence, attendee, scope, log template) + **kill-switch decision tree** (severity × time-to-release)
- `.github/ISSUE_TEMPLATE/beta-feedback.yml`: GitHub issue form for tester
- Checklist executable by non-dev (PM, designer, MC, giáo viên) — no jargon
- Each checklist item has binary pass criterion

**Non-functional:**
- Checklist ≤ 200 LOC
- Bug-bash doc ≤ 150 LOC including kill-switch tree
- Issue template auto-labels `beta-feedback` + `triage`
- **First dry-run by non-dev (PM/designer) is an ACCEPTANCE CRITERION** — not optional

**Deferred (follow-up plan):**
- Vietnamese mirror (`docs/manual-smoke-checklist-vi.md`)
- Matrix-to-checklist generator script (`scripts/generate-manual-checklist-from-matrix.cjs`) — blocked on full matrix anyway
- Localization mirrors for other languages

## Architecture

```
docs/
├── manual-smoke-checklist.md         # English, 45-min, executable
└── bug-bash-process.md               # process + kill-switch decision tree

.github/
└── ISSUE_TEMPLATE/
    └── beta-feedback.yml             # GitHub issue form

tests/unit/qa-foundation/
├── manual-smoke-checklist-doc-presence-and-45min-budget.test.js
└── bug-bash-issue-template-yml-schema-valid.test.js
```

**Checklist structure (45-min budget = 5.6 min/section avg):**

1. **Setup (3 min)** — Launch app, version check, fresh data dir
2. **Home page (4 min)** — List, search, create, delete, restore
3. **Editor — Insert elements (12 min)** — 13 types, focus on properties + visual
4. **Editor — Text editing (5 min)** — TipTap, font, color, math, find-replace
5. **Slide management (5 min)** — Add, duplicate, reorder, transitions
6. **Persistence (4 min)** — Save, reload, version history, undo/redo
7. **Export/Import (7 min)** — HTML, PPTX export, PPTX import roundtrip
8. **Live + Share (5 min)** — Start present, viewer join, share link, password

Total: 45 min budget. If section exceeds = potential bug.

**Bug-bash cadence:**
- Before `vX.Y.0` minor release: full 45-min checklist + 1h exploratory with 2-3 user (internal-only for MVP)
- Before `vX.Y.Z` patch release: 45-min checklist only
- Hotfix: only related smoke section + 1 person

**Kill-switch decision tree (NEW):**

```
Bug found during/after bug-bash session, T-hours to release:
                    │
        ┌───────────┴───────────┐
        │                       │
   Severity ≥ S2           Severity ≤ S3
        │                       │
   ┌────┴────┐                  │
   │         │                  │
 T<24h     T≥24h            Triage normally
   │         │              (ship, fix in next)
HOTFIX    Fix on
branch +  release branch
delay     normally
release
```

Severity scale documented inline (S0=data loss / crash, S1=blocked workflow, S2=degraded UX, S3=cosmetic).

## Related Code Files

**Create:**
- `docs/manual-smoke-checklist.md`
- `docs/bug-bash-process.md`
- `.github/ISSUE_TEMPLATE/beta-feedback.yml`
- `tests/unit/qa-foundation/manual-smoke-checklist-doc-presence-and-45min-budget.test.js`
- `tests/unit/qa-foundation/bug-bash-issue-template-yml-schema-valid.test.js`

**Modify:**
- `docs/codebase-summary.md` (link new docs)
- `README.md` (add "Manual QA before release" section pointing to checklist)

**Deferred (follow-up):**
- `docs/manual-smoke-checklist-vi.md` (VN mirror)
- `scripts/generate-manual-checklist-from-matrix.cjs` (blocked on full matrix)

## Implementation Steps (TDD)

### Red — Failing tests

1. **Test: checklist doc presence + 45-min budget**
   - Spec: parse markdown, extract H2 sections with `(N min)` pattern, sum minutes, assert total `== 45 ± 3`
   - Assert all sections have `- [ ]` checkboxes (≥ 3 per section)
   - Run → **FAIL**
   - Commit: `red: phase-3 add failing test for manual smoke checklist structure`

2. **Test: issue template yml schema valid**
   - Spec: load `.github/ISSUE_TEMPLATE/beta-feedback.yml`, parse with `js-yaml`, validate keys (`name`, `description`, `labels`, `body[]`)
   - Assert `labels` contains `beta-feedback` and `triage`
   - Run → **FAIL**
   - Commit: `red: phase-3 add failing test for beta-feedback issue template`

### Green — Write docs

3. **Write `manual-smoke-checklist.md`** (EN-only)
   - 8 sections per time budget above (45-min total)
   - Each item: `- [ ] {Action} → Expected: {observable result}`
   - Example: `- [ ] Click "Insert > Chart" → Expected: chart picker modal opens within 1s, 6+ chart types visible`
   - Include version stamp footer: `Last verified against: {version}`
   - Commit: `green: phase-3 add manual smoke checklist (45 min, 8 sections, EN-only)`

4. **Write `bug-bash-process.md`** (includes kill-switch)
   - Section: When to run (release cadence)
   - Section: Who to invite (internal-only for MVP)
   - Section: What to test (link checklist + free-form exploratory)
   - Section: How to log issues (use beta-feedback template)
   - Section: Triage protocol (severity, assignee, fix vs defer)
   - Section: **Kill-switch decision tree** (severity × time-to-release matrix)
   - Section: Severity scale (S0-S3 definitions)
   - Commit: `green: phase-3 add bug-bash process doc with kill-switch tree`

5. **Write `beta-feedback.yml`**
   - GitHub issue form: dropdown severity (S0/S1/S2/S3), textarea reproduction steps, file upload screenshot, version dropdown
   - Auto-labels: `beta-feedback`, `triage`
   - Tests **PASS**
   - Commit: `green: phase-3 add beta-feedback issue template`

### Refactor

6. **Dry-run validation by non-dev** (ACCEPTANCE CRITERION)
   - Have PM/designer execute checklist against packaged v1.9.2-rc.1 (or v1.9.1 if rc not yet built)
   - Time it; reword jargon found; iterate
   - **Sign-off required** from non-dev tester
   - Commit: `refactor: phase-3 calibrate checklist after non-dev dry-run`

7. **Update** `docs/codebase-summary.md` + `README.md` to link new docs
8. Commit: `docs: phase-3 link manual QA docs from summary + README`

## Todo List

- [ ] Failing test for checklist structure + 45-min budget (red)
- [ ] Failing test for beta-feedback template schema (red)
- [ ] Write EN `manual-smoke-checklist.md` 45-min (green)
- [ ] Write `bug-bash-process.md` with kill-switch tree (green)
- [ ] Write `beta-feedback.yml` issue template (green)
- [ ] **Non-dev dry-run of checklist (PM/designer) — acceptance criterion** (refactor)
- [ ] Update `README.md` + `docs/codebase-summary.md`
- [ ] Schedule 1st real bug-bash session pre-v1.9.2 release

## Success Criteria

- [ ] Self-run checklist ≤ 47 min (5% tolerance over 45)
- [ ] **Non-dev (PM/designer) dry-run completes in ≤ 60 min** AND signs off "executable without dev help"
- [ ] All 8 sections have ≥ 3 actionable items with expected outcome
- [ ] `gh issue create --template beta-feedback` works end-to-end
- [ ] Bug-bash process doc covers cadence + roles + triage + **kill-switch tree**
- [ ] Severity scale (S0-S3) defined in doc
- [ ] Tests in `tests/unit/qa-foundation/` all pass
- [ ] ≥ 1 real bug-bash session completed before declaring phase done

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Checklist drift when feature changes | H | M | Quarterly review against current GP doc; defer auto-generation to follow-up |
| 45-min budget still optimistic | M | M | Tolerance ±3 min; non-dev dry-run calibrates before sign-off |
| Non-dev can't understand jargon | M | H | Dry-run is ACCEPTANCE criterion, not optional; reword based on feedback |
| Bug-bash hard to schedule | H | M | Internal-only (PM, designer, support); kill-switch handles "found bug too late" |
| Issue template flood with low-quality reports | L | L | Required severity + repro fields; `needs-info` label for incomplete |
| Kill-switch decision contested in heat of release | M | H | Document explicit owner (release manager); pre-sign by team lead |

## Security Considerations

- Beta-feedback template does NOT ask credentials / personal data
- Screenshot upload field has warning: "Don't include personal info / API keys"
- Bug-bash process doc warns about sensitive PII handling
- Issue is created in public repo by default — flag this in template description

## Open Questions

1. ~~External bug-bash legal~~ — internal-only for MVP confirmed
2. Beta feedback retention: public vs private repo? (Currently public — may leak feature roadmap. RECOMMEND private repo for MVP)
3. Kill-switch decision owner: release manager (current: who?) or team lead?

## Next Steps

- Phase 2 (Electron smoke) is the automated complement — manual catches what automation can't
- Manual smoke run logs stored as GH Issue with `manual-smoke-run` label (referenced from `bug-bash-process.md`)
- Follow-up plan: VN mirror, matrix-generator, localization for CJK/Arabic if expand market; README CI badges (deferred from Phase 5-lite) can link to latest manual smoke run log

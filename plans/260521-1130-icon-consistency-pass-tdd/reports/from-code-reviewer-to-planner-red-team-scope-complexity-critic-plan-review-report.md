---
from: code-reviewer
to: planner
type: red-team-review
perspective: scope-and-complexity-critic
plan: 260521-1130-icon-consistency-pass-tdd
date: 2026-05-21
---

# Red-Team Plan Review — Scope & Complexity Critic (YAGNI Enforcer)

Hostile review of the Icon Consistency Pass TDD plan. Goal: destroy the plan where it over-engineers, prematurely abstracts, or ships scope the user never approved.

User-confirmed inputs (from plan.md "User-confirmed decisions"):
1. Approve all 10 items.
2. Bundle into 1 PR.
3. Keep proposed icon mappings unchanged.

Everything else is plan-author choice and fair game.

---

## Finding 1: Phase 7 builds on phantom section headings — `<h3>` does not exist in any property panel

- **Severity:** Critical
- **Location:** Phase 7 "PropertiesPanel Section Icons", section "Architecture / Approach" and Implementation Step 5
- **Flaw:** Plan says "replace existing section heading element with `<PropertySectionHeader>`" and `<h3>...</h3>` "in sub-panels". A grep over the entire `client/src/components/properties/` tree returns ZERO `<h3>` and ZERO `<h4>` elements in any non-test panel file. The "section headings" the phase migrates do not exist in code. Phase 7 will end up *inventing* sections rather than icon-decorating existing ones — that's UX redesign, not the icon-consistency cleanup the user approved.
- **Failure scenario:** Phase 7 (3–4h budget, the largest phase) opens with the implementer discovering they have nothing to replace. They either (a) skip the phase silently (issue #7 not closed), (b) invent section headings — UX work outside the approved 10 issues, or (c) wedge an icon next to a `<label>` element which changes per-field UX (explicitly forbidden by the phase's own "per-field labels stay text-only" rule).
- **Evidence:**
  - `grep -rn "h3\|h4" client/src/components/properties --include="*.jsx" | grep -v test` returns empty (only `<label>` matches exist, e.g. `common-element-controls.jsx:87`, `table-properties.jsx:62`).
  - Phase 7 plan line: `client/src/components/properties/PropertySectionHeader.jsx (new shared component)` and Implementation step 5: "replace existing section heading element with `<PropertySectionHeader icon={...} label="..." />`".
  - Step 6 admits the gap: "If a section heading didn't exist before … insert a logical heading using the closest matching mapping; otherwise leave the form flat (don't invent sections)" — this contradicts the phase's success criteria, which assert "section icons match mapping table" with no escape hatch.
- **Suggested fix:** Before greenlighting Phase 7, scout each panel file and produce an exact `panel → existing-section-heading-locator` table. If most panels are flat, drop Phase 7 entirely (issue #7 is "Medium" and ungrounded), or shrink to "add a single header icon to PropertiesPanel root" + 1 test.

---

## Finding 2: Phase 1 ships two custom ESLint rules + plugin + whitelist mechanism for a one-off cleanup

- **Severity:** Critical
- **Location:** Phase 1 "Foundation & Baseline Tests", section "Architecture / ESLint Rule" + "Whitelist mechanism"
- **Flaw:** The cleanup targets ~5 emoji chars in one file (`canvas-right-click-context-menu-for-slide-elements.jsx`) and 2 inline SVGs in one file (`QuickAccessToolbar.jsx`). Building two custom ESLint rules (`icons/no-emoji-icon`, `icons/no-inline-svg-icon`), a local plugin entry, fixture tests, and a `eslint-disable-next-line` whitelist mechanism is heavy. The rules' lifelong job is to guard against re-introducing 7 known violations. A 5-line CI grep does the same: `grep -rE "[\p{Extended_Pictographic}]|<svg" client/src/components/canvas client/src/components/QuickAccessToolbar.jsx`.
- **Failure scenario:** ESLint custom rule infra accrues maintenance debt: false positives on legitimate inline SVG (e.g., element renderers — already needs whitelist), plugin breakage on ESLint upgrades, parse failures on TSX edge cases (already called out as a risk in Phase 1). Cost over 12 months > the cost of preventing the regression another way.
- **Evidence:**
  - `client/src/components/canvas/canvas-right-click-context-menu-for-slide-elements.jsx` — only file with emoji icons (Phase 8 baseline says 5 chars).
  - `client/src/components/QuickAccessToolbar.jsx:77` and `:98` — exactly 2 inline `<svg>` blocks (verified by reading the file).
  - Phase 1 creates: `eslint-rules/icons-no-emoji-icon.js`, `eslint-rules/icons-no-inline-svg-icon.js`, `eslint-rules/index.js`, plus 2 rule fixture test files, plus `eslint.config.mjs` plumbing.
- **Suggested fix:** Replace both ESLint rules with a single Vitest source-scan test (Phase 5 already uses this pattern at `image-icon-alias-standardization.test.jsx`) that asserts: "no emoji code points and no inline `<svg>` in `client/src/components/canvas/**` and `client/src/components/QuickAccessToolbar.jsx`". 30 lines, zero plugin infra, same regression guarantee.

---

## Finding 3: Phase 1 inventory script (Babel parser + JSON baseline + diff) for an icon refactor — grep is enough

- **Severity:** High
- **Location:** Phase 1 "Architecture / Inventory Tool" + Phase 8 "Implementation Steps / step 8–9"
- **Flaw:** A `@babel/parser` + `@babel/traverse`-based script that walks JSX, extracts Lucide imports, inline `<svg>` elements, and emoji code points, then serializes to JSON for diff. The 10 issues span ~15 files all explicitly named in the phase tables. `grep` produces the same data with zero new infra. The "diff baseline vs final" step in Phase 8 is then a manual `diff` of two JSONs — same as a manual `git diff` on the changed files.
- **Failure scenario:** Babel parser maintenance (already flagged as a Phase 1 risk: "Babel parser errors on TSX/JSX edge cases … fall back to silent skip + warn" — meaning the inventory can silently miss files). The "fall back to silent skip" risk converts an alleged guarantee into a placebo.
- **Evidence:**
  - All 10 issue locations are enumerated in `plan.md` Issue→Phase Mapping with exact files and line numbers (lines 65–76).
  - Phase 1 creates `scripts/icon-inventory.mjs` + `plans/reports/icon-inventory-260521-baseline.json` + `package.json` script.
  - Phase 8 step 9 quantitative invariants are all answerable by 6 grep commands: emoji count in 1 file, unicode-arrow count in 1 file, inline SVG in 1 file, Sparkles non-AI sites (regex), BarChart2 count, raw Image imports.
- **Suggested fix:** Delete the inventory script. Replace Phase 8 "diff vs baseline" with 6 explicit `grep` assertions in a single Vitest test file (`icon-final-state-invariants.test.js`). Same guarantees, no Babel dependency, no risk of silent skip.

---

## Finding 4: 8 phases for 10 mechanical icon swaps is over-phased

- **Severity:** High
- **Location:** plan.md "Phases" table (lines 52–61)
- **Flaw:** Phases 2–7 are all mechanical Lucide-icon swaps in disjoint files, identical workflow (TDD test + swap import + swap JSX). Phases 4, 5, 6 are each ≤2h. Phase 1 (foundation) and Phase 8 (verification) bracket them. 8 phase files × ~150 LOC each = ~1200 LOC of plan documentation for ~30 lines of actual code change. Phases 4 + 5 + 6 could collapse into one "Icon Mapping Swaps" phase with 1 test file. The user asked for 1 PR; the over-phasing produces no extra value at PR time.
- **Failure scenario:** Plan-doc maintenance overhead during execution: every clarification (already 2 validation sessions adding ~10 corrections) requires touching multiple files. Risk of drift between phases that all touch ribbon files. Phase 4 already cross-references Phase 5 (`Risk: FileImage not present, fallback ImageIcon — alias from Phase 5`) — the dependency is artificial.
- **Evidence:**
  - Effort table (plan.md lines 100–110): Phase 4 "1.5–2h", Phase 5 "1h", Phase 6 "0.5–1h" — ≤4h aggregate.
  - Phases 2, 3, 4, 5, 6 all share identical TDD recipe: "write component test → swap import → swap JSX → run lint+test → re-baseline snapshot".
  - Phase 4 risk row mentions Phase 5 dependency: `client/src/__tests__/image-icon-alias-standardization.test.jsx` aliasing.
- **Suggested fix:** Collapse Phases 2–6 into 2 phases:
  1. "Critical/High icon fixes" (current 2+3+4)
  2. "Standardization sweep" (current 5+6).
  Phase 7 stays separate (risky — see Finding 1). Phase 1 becomes a thin "regression-guard tests" file (no ESLint infra; see Finding 2). Phase 8 stays. New total: 4 phases vs 8.

---

## Finding 5: 13+ new test files for cosmetic icon swaps is test bloat

- **Severity:** High
- **Location:** All phases' "Create" lists
- **Flaw:** Aggregating across phases the plan creates: 8 baseline snapshot tests (Phase 1) + 1 axe spec (Phase 1) + 2 ESLint fixture tests (Phase 1) + 1 canvas ctx-menu test (Phase 2) + 1 sparkles separation test (Phase 3) + 3 dedup tests (Phase 4) + 3 standardization tests (Phase 5) + 1 toolbar test (Phase 6) + 2 properties tests (Phase 7) = **22 new test files**. For an icon refactor where the canonical assertion is "this Lucide component is rendered here, not that one". 22 files × N lines of harness boilerplate per file > 1 file × 22 small `expect` blocks.
- **Failure scenario:** Test maintenance after the PR: any future ribbon refactor or panel reshuffle (e.g., the related "ribbon layout hardening" plan still active in `260517-2252-…`) breaks 5+ files at once. Snapshots will be re-baselined repeatedly, quietly diluting their value as guards.
- **Evidence:**
  - Phase 1 Create list (lines 53–66) — 11 new files including 8 snapshot tests.
  - Phase 5 alone creates 3 files for ≤1h of code work (chart icon, align icons, Image alias).
  - Phase 4 creates 3 files for 3 button icon swaps.
- **Suggested fix:** One test file per phase, max. Replace 8 baseline snapshot tests in Phase 1 with one Vitest test that asserts **post-merge invariants directly** (no snapshots): "no emoji in ctx-menu file; no inline SVG in QuickAccessToolbar; Sparkles only in AI files; BarChart2 = 0; raw Image import = 0". Snapshots would be re-baselined after each phase anyway (every phase calls this out) — they catch nothing.

---

## Finding 6: `PropertySectionHeader` is premature abstraction — single-call pattern with 5 lines of JSX inside

- **Severity:** Medium
- **Location:** Phase 7 "Architecture / Approach" + step 4 (component implementation)
- **Flaw:** A new shared component (`client/src/components/properties/PropertySectionHeader.jsx`) ships before Phase 7 has confirmed any panel uses it (see Finding 1). The component body is 5 lines of JSX (`<h3 className="..."><Icon size={14} aria-hidden /><span>{label}</span></h3>`). Even if Phase 7 succeeds, the abstraction value is near zero: 9 callers each using a unique `icon=` prop and unique `label=` prop. The cn-helper, className concat, and "shared layout" framing dress up a glorified template literal.
- **Failure scenario:** A new abstraction lands without proven need. If section-icon UX gets walked back later (likely, given Phase 7's shaky foundation), the component remains as zombie code.
- **Evidence:**
  - Phase 7 component code (lines 92–101): 5 lines inside one `<h3>`.
  - Phase 7 callers: 9 files in Modify list, each with one mapping table entry (mapping → 1 unique icon).
  - Plan claim "9 sub-panels"; actual non-test files in `client/src/components/properties/`: 11 (chart-, code-, common-element-controls, game-properties-question-editor, game-properties, image-, media-, misc-, shape-, table-, timeline-).
- **Suggested fix:** If Phase 7 survives at all, inline the heading JSX directly in the (small number of) panels that actually need it. No new component until 3+ call sites with non-trivial shared logic exist.

---

## Finding 7: Phase 8 bundle-delta gating (±5KB, build twice) is gold plating

- **Severity:** Medium
- **Location:** Phase 8 "Verification matrix" + Success Criteria + plan.md Success Criteria line 119
- **Flaw:** The user did not ask for bundle metrics. Plan justifies it as a risk mitigation ("Bundle size growth from new Lucide icons" — plan.md line 93), but Lucide tree-shakes per import; net delta is provably ≤2 KB gzipped per added icon. Phase 8 builds master and branch separately, gzips `dist/assets/index-*.js`, and gates the PR on ±5KB. A self-imposed gate the user never required, plus per-PR build duplication overhead.
- **Failure scenario:** Bundle delta exceeds ±5KB due to unrelated drift on master between branch creation and PR (e.g., another feature lands; a new lucide icon imported elsewhere); plan calls a "fail" on something the user does not care about, blocking the PR.
- **Evidence:**
  - plan.md Risks table line 93: "Bundle size delta likely <2KB gzipped".
  - Phase 8 step 10: "Build twice (master vs branch). Capture gzipped JS bundle size. Record delta."
  - User-confirmed decisions (plan.md lines 23–26) make no mention of bundle size.
- **Suggested fix:** Drop the bundle-delta success criterion. Add a one-line note in PR description: "Lucide tree-shakes; expected delta ≈ 0–2 KB gzipped". No double build.

---

## Finding 8: Snapshot tests + explicit assertion tests = redundancy that re-baselines anyway

- **Severity:** Medium
- **Location:** Phase 1 (8 snapshot tests) + every later phase ("Update affected baseline snapshots once, commit with phase tag")
- **Flaw:** Phase 1 creates 8 component snapshot tests as a safety net. Phases 2–7 each include a step "re-run affected baseline snapshot test once with `vi --update`, commit". Snapshots that get re-baselined after every phase are not regression guards — they are signed permission slips for the change. The explicit assertion tests in each phase already pin behavior.
- **Failure scenario:** Reviewer sees a snapshot diff during PR review for `slide-panel.test.jsx`, has to compare it against 3 phases that touched SlidePanel (Phase 3 Sparkles, Phase 4 design dedup if any, Phase 7 if SlidePanel sub-panel), can't trivially tell which change is intended. Snapshots become noise.
- **Evidence:**
  - Phase 1 Create list (lines 53–66): 8 `*.test.jsx` files with names matching components.
  - Phase 2 step 9: "Re-run Phase 1 baseline `canvas-context-menu` snapshot test once with `vi --update`, commit."
  - Phase 3 step 11 + Phase 4 step 9 + Phase 6 step 9 + Phase 7 step 9: identical re-baseline steps.
- **Suggested fix:** Drop Phase 1 component snapshot tests. Keep only explicit-assertion tests. If a regression-guard is wanted for the *final* state, add one inventory-style test in Phase 8 that asserts the post-merge invariants enumerated in Phase 8 step 9 — no snapshots.

---

## Finding 9: Plan claims "9 sub-panels" — actual count is 10–11; verification gap survived 2 validation sessions

- **Severity:** Medium
- **Location:** Phase 7 Overview ("9 sub-panels") + plan.md Validation Log "10 property files in modify list verified to exist (no path corrections needed)"
- **Flaw:** Phase 7 Overview says "9 sub-panels". Modify list has 10 files. Actual `client/src/components/properties/*.jsx` non-test files = 11 (the missed one being `game-properties-question-editor.jsx`). Validation Log line 147 says "10 property files in modify list verified to exist" — i.e., the validator counted the modify list, not the directory. The Plan's own count is internally inconsistent (9 vs 10) and the directory has 11.
- **Failure scenario:** Phase 7 implementer treats "9" as authoritative, omits 1–2 panels, issue #7 closes only partially. Or the implementer adds the 11th panel mid-flight and now Phase 7 budget (3–4h) blows.
- **Evidence:**
  - Phase 7 Overview: "PropertiesPanel and 9 sub-panels".
  - Phase 7 Modify list: 10 files (common-element-controls, shape, image, chart, code, table, timeline, media, misc, game-properties).
  - Glob `client/src/components/properties/*.jsx` excluding `*.test.jsx`: 11 files (adds `game-properties-question-editor.jsx`).
  - plan.md line 147: "10 property files in modify list verified to exist (no path corrections needed)".
- **Suggested fix:** Reconcile the count. Decide explicitly whether `game-properties-question-editor.jsx` is in scope (it's a question-editor sub-component, plausibly out of scope). Update Phase 7 to state "N panels covered; question-editor sub-component out of scope".

---

## Finding 10: Phase 1 axe smoke spec adds new Playwright spec for an icon swap that preserves aria-label

- **Severity:** Medium
- **Location:** Phase 1 "Architecture / Baseline Tests" + Create list `tests/a11y/editor-icons.spec.js`
- **Flaw:** Plan's accessibility invariant is "every icon-only button keeps `aria-label`" (plan.md line 47). This is a unit-test concern — render component, assert button has `aria-label`. Phase 1 adds a Playwright + axe smoke spec for the entire EditorPage shell. axe-core scanning the EditorPage on every CI run, for every PR, to guard against an icon swap regression — the cost/benefit is poor. axe will also catch unrelated a11y issues that are not the user's request, expanding scope.
- **Failure scenario:** axe flags a pre-existing accessibility issue on EditorPage (color contrast on a button that's been there a year), Phase 1 baseline test fails on master, blocking the entire plan. Or axe upgrades ship new rules, breaking the guard.
- **Evidence:**
  - Phase 1 Create list line 65: `tests/a11y/editor-icons.spec.js`.
  - Phase 1 Implementation step 4: "Write axe smoke spec. Run — pass on current state (records baseline)."
  - Phase 1 Risk table — does *not* enumerate "axe flags pre-existing issue" risk.
  - Recent commit `ca69ea35 chore(deps): add @axe-core/playwright for a11y e2e specs` (already merged) — axe is available; the question is whether to use it on this PR.
- **Suggested fix:** Replace the axe smoke spec with a Vitest unit test that scans the rendered output of each affected component and asserts `aria-label` presence on every `<button>` with no text node. Keeps axe out of the PR scope; matches the actual invariant.

---

## Summary table

| # | Finding | Severity |
|---|---|---|
| 1 | Phase 7 builds on phantom `<h3>` headings (none exist in any property panel) | Critical |
| 2 | Phase 1 ships 2 custom ESLint rules + plugin + whitelist for one-off cleanup | Critical |
| 3 | Phase 1 inventory script (Babel + JSON diff) for what `grep` does | High |
| 4 | 8 phases for 10 mechanical swaps — over-phased | High |
| 5 | 22 new test files for cosmetic icon swaps — test bloat | High |
| 6 | `PropertySectionHeader` is premature abstraction (5-line body, 9 callers) | Medium |
| 7 | Phase 8 bundle-delta gating (±5KB, build twice) — gold plating | Medium |
| 8 | Snapshot tests + assertion tests — re-baselined every phase = noise | Medium |
| 9 | "9 sub-panels" claim vs 10 in modify list vs 11 in directory | Medium |
| 10 | Phase 1 axe smoke spec — overkill for aria-label preservation | Medium |

## Aggregate diagnosis

The plan is **3× too heavy** for the stated work. User asked for 10 cosmetic icon fixes in 1 PR. Plan ships 8 phases, ~1200 LOC of phase docs, 2 custom ESLint rules + plugin, an inventory tool, 22 test files, snapshot baselines, axe smoke spec, bundle delta gating, and a new shared component. None of these are user-confirmed.

Recommended de-scope (target):
- 4 phases: Foundation (lean), Critical/High swaps, Standardization sweep, Verify+PR
- ~5 test files total
- No custom ESLint rules
- No inventory script
- No new shared component (or defer until Phase 7's premise is verified)
- No bundle gating

Estimated effort with de-scoping: **4–6h** vs the current **11–15h**.

## Unresolved questions

1. Do property sub-panels actually need section icons, given they have no existing section headings? Or is issue #7 a misread of the audit and should be deferred to a UX-redesign plan?
2. Is `game-properties-question-editor.jsx` in scope for Phase 7?

---

**Status:** DONE
**Summary:** 10 findings, 2 Critical (phantom headings in Phase 7; ESLint rules over-engineered) + 3 High (inventory script, over-phasing, test bloat) + 5 Medium. Plan is ~3× heavier than needed; recommend collapsing to 4 phases and dropping ESLint/inventory/snapshot/bundle infra.

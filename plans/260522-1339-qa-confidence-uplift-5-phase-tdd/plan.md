---
title: "QA Confidence Uplift: MVP 3-phase TDD Plan (post-validate)"
description: "MVP scope post-validate (2026-05-22): ship Phase 1-mini (5 revised GPs only, no full matrix) + Phase 2 (Electron smoke, gates v1.9.2) + Phase 3-lite (EN 45-min checklist + bug-bash + kill-switch) + Phase 5-lite (PR/full lane split, no nightly cross-browser). Defer Phase 1 full matrix + Phase 4 coverage roadmap + nightly cross-browser to follow-up plan."
status: pending
priority: P1
effort: "4-5 dev-days / 1 sprint (MVP); 14-17d if full 5-phase later"
branch: master
tags: [qa, testing, ci, electron, manual-qa, tdd, mvp]
created: 2026-05-22
createdBy: ck-plan-skill
source: skill
mode: "--deep --tdd"
blockedBy: [260629-2154-full-application-qa-verification-deep-tdd]
blocks: []
---

# QA Confidence Uplift — MVP — NavSlides Editor

## Origin

Plan derives from in-session QA audit (2026-05-22) answering "làm sao biết toàn bộ chức năng, flow, elements, controls hoạt động đúng?". Audit found infrastructure đủ (~80 unit files, 60+ E2E spec, visual+a11y+load+corpus, coverage gate enforced) nhưng **4 verification gaps**. Red-team review then narrowed plan to MVP scope (user validated 2026-05-22):

| Gap | MVP coverage |
|---|---|
| Electron packaged smoke test missing | **Phase 2** (P0) — gates v1.9.2 release |
| Manual QA / bug-bash process missing | **Phase 3-lite** — EN-only 45min, bug-bash doc, kill-switch |
| Coverage threshold quá thấp (33%) | **DEFERRED** to follow-up (Phase 4 in original plan) |
| CI chạy full suite mỗi PR (~30 phút) | **Phase 5-lite** — split lanes only, no nightly cross-browser |
| 5 Golden Paths anchor missing | **Phase 1-mini** — 5 revised GPs doc only, no full feature matrix (deferred) |

## MVP Scope (validated 2026-05-22)

**In scope (4-5 dev-days):**
- **Phase 1-mini** — `docs/critical-user-journeys.md` only, 5 REVISED GPs:
  - GP-01 Create-Edit-Persist (kept)
  - GP-02 **Live-Presentation-Reconnect** (NEW, replaces Insert-All-Elements)
  - GP-03 **PPTX-Import-Roundtrip-with-Edits** (extended — was just import→export)
  - GP-04 **AI-Generate-Slide-with-Failures** (NEW, covers rate-limit + invalid key)
  - GP-05 Share-Password-Revoke (kept)
- **Phase 2** — Electron packaged smoke (gates v1.9.2 release)
- **Phase 3-lite** — `docs/manual-smoke-checklist.md` EN-only 45min, `docs/bug-bash-process.md`, `.github/ISSUE_TEMPLATE/beta-feedback.yml`, bug-bash kill-switch decision tree
- **Phase 5-lite** — `ci-pr-fast-lane.yml` + `ci-merge-full-lane.yml` only

**Deferred to follow-up plan** (NOT cut, just scheduled later):
- Phase 1 full feature × layer matrix (160 cells)
- Phase 4 coverage roadmap + per-glob threshold + ratchet
- Phase 5 nightly cross-browser (webkit + firefox)
- Phase 5 reusable workflow extract
- Phase 3 Vietnamese checklist mirror
- Phase 3 matrix-generator script
- Phase 5 README badges

**Out of scope (entirely):**
- Refactor `EditorPage.jsx` (2030 LOC) / `HomePage.jsx` (1677 LOC) (separate epic)
- Performance/load threshold tightening
- TypeScript migration
- iOS Safari / Chrome Android nightly

## Cross-plan References

| Plan | Status | Relation |
|---|---|---|
| `260519-1200-comprehensive-test-coverage-expansion` | completed | Wires CI coverage gate. Deferred Phase 4 builds on top |
| `260521-2330-github-actions-visual-baseline-regeneration-tdd` | completed | Manual visual baseline regen pattern available |
| `260522-0922-windows-electron-v1-9-1-release` | completed | v1.9.1 shipped. **Phase 2 GATES v1.9.2** — no tag without smoke pass |

## Phases (MVP)

| # | Phase | Effort | Priority | Status |
|---|---|---|---|---|
| 1 | [Foundation-mini: 5 Revised Golden Paths](./phase-01-foundation-critical-user-journeys-and-traceability-matrix.md) | 0.5d | P1 | pending |
| 2 | [Electron Packaged Smoke Test (gates v1.9.2)](./phase-02-electron-packaged-smoke-test.md) | 1.5d | **P0** | pending |
| 3 | [Manual Smoke Checklist (45min EN-only) + Bug-Bash + Kill-Switch](./phase-03-manual-smoke-checklist-and-bug-bash-process.md) | 1d | P1 | pending |
| 5 | [CI Pipeline Split (PR fast lane / merge full lane) — MVP-lite](./phase-05-ci-pipeline-restructure-pr-fast-lane-vs-merge-full-lane.md) | 1.5d | P2 | pending |

**Phase 4 (Coverage Roadmap)** — DEFERRED to follow-up plan. File `phase-04-*.md` retained for reference but not executed in MVP. **Total MVP effort:** 4.5d (within 4-5 dev-day budget).

## Execution order

```
Phase 1-mini ─┬─► Phase 2 ──► Phase 5-lite ──► v1.9.2 tag
              │                  │
              └─► (Phase 3 runs in parallel with 2/5 — independent)
```

Phase 1-mini unblocks Phase 2 (smoke needs revised GPs). Phase 3 independent (manual process docs). Phase 5 last (CI split needs Phase 2 smoke job to wire into merge full lane).

## Success Criteria (MVP-level)

- [ ] 5 REVISED golden paths in `docs/critical-user-journeys.md`, each mapped to ≥1 spec
- [ ] CI `release.yml` blocks v1.9.2 tag if Electron smoke fails (verified by intentional break)
- [ ] `docs/manual-smoke-checklist.md` 45-min EN-only, non-dev executable, dry-run validated by ≥1 non-dev
- [ ] `docs/bug-bash-process.md` includes kill-switch decision tree (severity × time-to-release → ship/delay/hotfix)
- [ ] CI PR fast lane ≤ 15 min wall-clock (was: 12; loosened per technical red-team feedback)
- [ ] Merge full lane runs all current jobs (no detection regression)
- [ ] Each phase has failing test commit `red:` → impl commit `green:` → refactor commit `refactor:` (verify `git log`)

## Risk Register (MVP-level)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Playwright Electron API flake on Windows runner | H | H | Phase 2 uses `executablePath` (correct API), kill-port helper, retry 1×, manual-override label if flake persists |
| v1.9.2 blocked indefinitely if smoke unstable | M | H | Hard cap 2 weeks calendar; if not stable, fall back to manual gate + ship |
| Bug-bash hard to schedule | H | M | Phase 3-lite allows internal-only bash (PM, designer); kill-switch documents skip protocol |
| CI split breaks branch protection rules | L | H | Phase 5-lite rollout: add new check parallel → 1 week observation → remove old |
| Manual checklist drift | M | M | Phase 1-mini GP doc is single source; checklist regen via script DEFERRED |

## Non-negotiables

- **TDD per phase**: failing test commit `red:` prefix → impl commit `green:` prefix → refactor commit `refactor:` prefix
- **No skip Phase 1-mini**: 5 revised GPs are smoke gate input; without them Phase 2 has nothing to test
- **File size**: each doc/code file ≤ 200 LOC per `CLAUDE.md` constraint
- **No secrets**: bug-bash form no PII; manual checklist no internal URL

## Open Questions (resolved 2026-05-22 validate)

1. ~~v1.9.2 timing~~ → **Gate v1.9.2 with Phase 2** (P0 stays)
2. ~~Bug-bash external~~ → Internal-only first; external via beta channel optional follow-up
3. ~~Coverage target 80/65~~ → **Deferred** (Phase 4 not in MVP)
4. ~~Branch protection admin~~ → Required as part of Phase 5-lite; document `gh api` command for admin
5. ~~5 GPs revision~~ → **Revised set adopted** (Live-Reconnect, AI-Failures, Import-Roundtrip-with-edits)
6. ~~Scope cut~~ → **MVP 3-phase confirmed** (this plan)
7. ~~Phase 4 server routes baseline~~ → Deferred with Phase 4
8. ~~Phase 3 checklist budget~~ → **45-min EN-only** confirmed

## Deferred items (follow-up plan blueprint)

> **Follow-up plan EXISTS (2026-05-30):** `260530-0854-feature-coverage-traceability-matrix-system-tdd` delivers the matrix half (auto-sourced inventory + `[cap:*]` tags + Markdown/JSON visibility map + CI gate). It is **independent** — auto-sources from registries, does NOT block on this MVP. Items below marked ✅ are now covered there.

After MVP ships, create follow-up plan covering:
- ✅ Full feature × test layer matrix (160 cells) → covered by `260530-0854` (auto-sourced, capability-tag based)
- Per-glob coverage thresholds + ratchet script + baseline updater
- Nightly cross-browser (webkit + firefox + iOS Safari via BrowserStack/Sauce)
- Reusable workflow `_reusable-playwright-shard.yml`
- Vietnamese checklist mirror
- Matrix-to-checklist generator script
- README CI badges
- Telemetry counter (`feature_used` events for gap analysis)

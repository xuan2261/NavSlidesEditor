# Journal — VitePress Docs Bilingual Refresh (completion)

**Date:** 2026-05-31
**Plan:** `plans/260531-0558-vitepress-docs-bilingual-refresh/`
**Commit:** `05662259` (102 files, +4808/−144)

## Context

Resumed a `/ck:cook --auto` whose Phase 1–3 were implemented in a prior session and Phase 4 (VI i18n) was implemented-but-uncommitted. Job: verify real state (not trust session memory), finish/finalize, commit scoped.

## What was already done (verified, not assumed)

- `config.mjs` refactored to VitePress `locales` API (EN root, VI `/vi/`).
- 32 VI pages mirroring EN; Develop section (4 pages); 11 screenshots; 4 phase guard tests.
- 58 `website-*` guard tests green, `docs:build` green at start.

## What this session found + fixed

Two content-drift items earlier phases missed (plan goal = "zero drift"):

1. **Present shortcut.** `guide/keyboard-shortcuts.md` (EN+VI) still claimed `` `F` or `Enter` `` to enter presentation. Source of truth (`slideshow-presentation-mode-keyboard-navigation-shortcuts-handler.test.js:110/120`): `F5` starts from first slide, `Shift+F5` from current; bare `F` is only reveal.js in-present fullscreen. Corrected both; extended accuracy guard to pin F5 for EN+VI.
2. **Install clone URL.** `guide/installation.md` (EN+VI) cloned upstream `jbirky/revealjs_gui`. Correct slug `xuan2261/NavSlidesEditor` (verified vs `config.mjs`/README/develop). Fixed clone + Releases URLs. (Artifact filenames `Slides-Editor-*`/`*.dmg` NOT changed — no electron-builder config in repo to verify against; macOS target is `.zip` per CLAUDE.md — see open question.)

## Demo embeds (user-approved scope expansion)

Code review surfaced 60 tutorial iframes (EN+VI) pointing at `/revealjs_gui/demos/*.html` — 23 demo files absent from repo, wrong base. User chose "port now". Fetched `upstream` (`jbirky/parallax-presentations`) shallow, extracted 23 self-contained demos from `docs/public/demos/` into `website/public/demos/`, rewrote prefix `/revealjs_gui/demos/` → `/NavSlidesEditor/demos/` (46 refs). Added 2 guard tests: demo-asset-exists + no-stale-upstream-base.

## Outcome

- 61 `website-*` guard tests green; `docs:build` green.
- Commit `05662259` scoped to plan only (website/**, 4 guard tests, capture script, plan dir) — residual unrelated working-tree changes (README, client/server, docs/, package.json) left untouched.
- Commit `647c643d` (follow-up): corrected `installation.md` desktop download table (EN+VI) — see "Resolved after commit" below.
- Plan + 4 phase files synced to `completed`.

## Decisions deferred (user choice)

- 5 orphan PNGs (script captures more than pages embed) — **kept** for future use.

## Resolved after commit

- **Electron artifact filenames** — verified against real GitHub Releases (`gh release view`, v1.10.0–v1.14.0): publishes Windows-only `NavSlides Editor Setup x.x.x.exe` (installer) + `NavSlides Editor x.x.x.exe` (portable). NO Linux/macOS releases exist; product name is "NavSlides Editor" (not upstream `Slides-Editor`/`parallax`). User chose Windows-only table + build-from-source note for Linux/macOS. Fixed EN+VI in commit `647c643d`.

## Open questions

1. GitHub Pages deploy not exercised this session (no push performed; only local `docs:build` as proxy). User to push `master` when ready to trigger Pages — both commits (`05662259`, `647c643d`) are local-only.

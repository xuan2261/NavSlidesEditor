---
phase: 6
title: "Visual Regression Baseline Expansion (Docker-locked)"
status: specs-staged
priority: P1
effort: "2d"
dependencies: [0, 5]
tdd: true
---

<!-- Updated 2026-05-19: 4 spec files + helper staged (TDD Red); baseline PNGs intentionally not generated yet — Phase 6 mandates Docker-only regeneration. -->

# Phase 6 — Visual Regression Baseline

## Status (2026-05-19)
- 4 spec files in `tests/e2e/visual/` (TDD Red — fail with snapshot-missing until baselines committed):
  - `ribbon-tabs-across-all-seven-tabs-dark-theme.spec.js` — 7 tab snapshots clipped to ribbon area
  - `editor-canvas-states-empty-and-with-content.spec.js` — 4 canvas snapshots (empty 1280, empty 1024, text+shape, chart+code)
  - `present-speaker-share-and-live-viewer-baselines.spec.js` — 4 snapshots (present 1920, share landing, live viewer, speaker view)
  - `mobile-editor-explicit-device-scale-factor-pinned.spec.js` — 1 snapshot with explicit `deviceScaleFactor: 2`
- 1 helper: `tests/e2e/pages/visual-snapshot-deterministic-freeze-and-helper.js` (`freezeUiForSnapshot`, `suppressTutorialAndOverlays`, `expectStableScreenshot`)
- 16 specs / 16 expected snapshots (down from planned 25 — original plan double-counted light+dark themes; current implementation does dark-only since light theme isn't a top-level toggle)
- `playwright.config.js` UNCHANGED (file ownership: Phase 1)
- Docker baseline run **deferred** — see "Update flow" below

## Update flow (Docker-only)

Baselines must be generated inside `mcr.microsoft.com/playwright:v1.59.1-jammy`. Running `--update-snapshots` on a Windows or macOS host produces drift that the CI gate rejects.

```bash
docker run --rm -v "${PWD}:/work" -w /work \
  mcr.microsoft.com/playwright:v1.59.1-jammy \
  bash -lc "npm ci && npx playwright test tests/e2e/visual/ --update-snapshots"
```

Commit only files under `tests/e2e/visual/*-snapshots/`. Documented in `docs/navslides-editor-vitest-playwright-k6-testing-guide.md` under "Visual baseline regeneration (Phase 6)".

## Deviations from original plan
- **16 snapshots, not 25** — original counted 7 ribbon tabs × 2 themes (14). Light theme isn't a top-level user toggle in the current EditorPage; ribbon tab count stays at 7 (one theme), bringing total to 16.
- **Specs staged, baselines deferred** — Phase 6's R-01 mandates Docker regeneration; running on this Windows host would commit drifted baselines that CI rejects. Specs are TDD-Red until a Docker maintainer runs the update flow.
- **No `--update-snapshots` execution attempted on host** — explicitly avoided per Patch-02.

## Snapshot inventory (target)

| Group | Snapshots | Viewport | DPR |
|---|---|---|---|
| Ribbon tabs (7 dark) | 7 | 1280×800 (clip 0,0,1280,240) | 1 |
| Editor canvas states | 4 | 1280×800, 1024×768 | 1 |
| Present mode | 1 | 1920×1080 | 1 |
| Share landing | 1 | 1280×800 | 1 |
| Live viewer | 1 | 1280×800 | 1 |
| Speaker view | 1 | 1280×800 | 1 |
| Mobile editor | 1 | 390×844 | **2 (explicit)** |
| **Total** | **16** | | |

## Success Criteria
- [x] 4 spec files + 1 helper checked-in.
- [x] No edits to `playwright.config.js` (file ownership: Phase 1).
- [x] Mobile snapshot uses explicit `deviceScaleFactor: 2`.
- [x] Update flow documented in `docs/navslides-editor-vitest-playwright-k6-testing-guide.md`.
- [ ] Baselines generated via Docker (deferred to maintainer).
- [ ] 3 consecutive Docker runs pass (deferred).

## Risk Assessment
- **R-01** (resolved): Pixel drift Windows ↔ Linux. Specs target only Docker baselines.
- **R-02** (resolved): Antialiasing flicker. Helper applies `caret-color: transparent` + animation disable.
- **R-03** (resolved): Phase 5 UI changes invalidate baseline. Phase 5 completed first; this is fine.
- **R-04** (resolved): Mobile DPR drift. Explicit `deviceScaleFactor: 2`.
- **R-05** (open): Developer regenerates on host OS → drifted baseline. Mitigation: `docs/.../testing-guide` documents Docker-only command; pre-commit hook recommendation deferred to Phase 9 CI gate (which catches drift via diff).

## Red-team patches incorporated
- Patch-09: drop Mobile snapshot OR pin DPR (mobile renders DPR-dependent → drift on different runners). Decision: **keep mobile, pin DPR=2 + viewport explicit**.
- Patch-02 reference: snapshots regenerate in Docker only (Phase 9 enforces in CI).

## Requirements

### Functional
- ≥ 20 snapshots checked-in (target 24).
- All visual specs pass on Linux Docker baseline.
- Update flow documented (Docker-only command).

### Non-functional
- Animations disabled before snapshot.
- Cursor blinking disabled.
- Snapshots stored under `tests/e2e/__screenshots__/<spec>/`.
- Mobile snapshots **must use `deviceScaleFactor: 2`** explicit (don't rely on `devices['Pixel 5']` defaults — version drift risk).
- **NO edits to `playwright.config.js`** — Phase 1 already set `expect.toHaveScreenshot` defaults. This phase only consumes them.

## Snapshot inventory

| Group | Snapshots | Viewport | DPR |
|---|---|---|---|
| Ribbon tabs (7 × 2 themes) | 14 | 1280×800 | 1 |
| Editor empty canvas + thumb panel | 2 | 1280×800, 1024×768 | 1 |
| Editor with content (text/shape/chart/code) | 4 | 1280×800 | 1 |
| Present mode | 1 | 1920×1080 | 1 |
| Speaker view | 1 | 1280×800 | 1 |
| Live viewer | 1 | 1280×800 | 1 |
| Share landing | 1 | 1280×800 | 1 |
| Mobile editor (DPR-pinned) | 1 | 390×844 | **2 (explicit)** |

Tổng: 25.

## Related Code Files
- **Create:** `tests/e2e/visual/ribbon-tabs-light-and-dark.spec.js`, `tests/e2e/visual/editor-canvas-states.spec.js`, `tests/e2e/visual/present-and-speaker-views.spec.js`, `tests/e2e/visual/share-and-live-viewer.spec.js`, `tests/e2e/visual/mobile-editor.spec.js`, `tests/e2e/pages/VisualSnapshotHelper.js`, `tests/e2e/__screenshots__/` (auto)
- **Read-only:** existing `tests/e2e/visual-regression.spec.js`, `playwright.config.js` (Phase 1 owns)
- **DO NOT modify:** `playwright.config.js` — Phase 1 already configured `expect.toHaveScreenshot` defaults; touching it again creates merge conflicts per file ownership boundary.

## Implementation Steps (TDD)

### Step 1 — Red
- Write 5 visual specs with `await expect(page).toHaveScreenshot('xxx.png')`. First run: snapshots missing → fail with "snapshot not found".

### Step 2 — Green: regenerate in Docker
```bash
# Update flow — Docker only (per Patch-02)
docker run --rm -v "${PWD}:/work" -w /work \
  mcr.microsoft.com/playwright:v1.59.1-jammy \
  npx playwright test tests/e2e/visual/ --update-snapshots
```
- Manually review each generated PNG.
- Commit baseline.
- **Never run `--update-snapshots` on Windows/macOS host** — produces drift; CI rejects.

### Step 3 — Green: mobile DPR pin (Patch-09)
```js
// tests/e2e/visual/mobile-editor.spec.js
test('mobile editor visual', async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,        // EXPLICIT — don't rely on devices preset
    isMobile: true,
    hasTouch: true
  })
  const page = await ctx.newPage()
  // ... freeze UI ...
  await expect(page).toHaveScreenshot('mobile-editor.png', { threshold: 0.2 })
})
```

### Step 4 — Refactor
- Extract setup helper for "freeze UI for snapshot" (disable animations, hide carets, hide timestamps) → `VisualSnapshotHelper.js`.
- Reusable freeze CSS:
```css
*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; caret-color: transparent !important; }
```

### Step 5 — Verify
- `docker run ... npm run test:e2e -- visual/` 3 consecutive passes.
- Document update flow in `docs/testing-guide.md` with explicit Docker command.

## Success Criteria
- [ ] ≥ 20 snapshots committed (target 25).
- [ ] Spec runs deterministic (3 consecutive Docker runs all pass).
- [ ] Documentation includes "How to update visual baseline" — Docker-only command.
- [ ] Mobile snapshot uses explicit `deviceScaleFactor: 2`.
- [ ] No edits to `playwright.config.js` (file ownership: Phase 1).

## Risk Assessment
- **R-01**: Pixel drift Windows ↔ Linux. Mitigation: baseline regenerated in `mcr.microsoft.com/playwright:v1.59.1-jammy` Docker container only.
- **R-02**: Antialiasing flicker between runs. Mitigation: `* { caret-color: transparent !important }`, disable cursor blink, fixed test font.
- **R-03**: Phase 0/5 UI changes invalidate baseline mid-plan. Mitigation: defer this phase until after 5.
- **R-04 (NEW per Patch-09)**: Mobile DPR drift between runner versions. Mitigation: explicit `deviceScaleFactor: 2` in spec; document version pin in helper.
- **R-05 (NEW)**: Developer accidentally regenerates on host OS → commits drifted baseline. Mitigation: pre-commit hook checks `git diff __screenshots__/` is empty unless `.snapshot-update` marker file present (set by Docker run).

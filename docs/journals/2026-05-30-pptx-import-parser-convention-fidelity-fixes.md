# PPTX Import: 11 Fidelity Bugs Rooted in Silent Library Convention Drift

**Date**: 2026-05-30 00:00
**Severity**: High
**Component**: `server/services/pptx-import/` + `shared/src/`
**Status**: Resolved

## What Happened

Executed an 8-phase TDD plan fixing 11 PPTX-import fidelity bugs across 6 root causes. All 1677 tests pass, build and lint clean, strict corpus 11/11, browser audit 6/6.

## The Brutal Truth

Every single bug shared one meta-cause: the import mappers were written against pptxtojson 0.x conventions — raw px lengths, raw 100000-scale filter values, numeric gradient positions — but the library had silently moved to 2.0.2 (point lengths, `/1e5` fractions, `"50%"` string positions). The unit tests stayed green for the wrong reason: their fixtures fabricated parser values matching the OLD assumptions. We had a test suite that validated our misreading of the library, not the library's actual output. That's not a test suite, that's a confidence trap.

## Technical Details

Six root causes fixed:

- **R1 — Length units**: 72-DPI canvas means 1pt → 1px. Removed erroneous `×96/72` inflation from font size, table insets, border width, shadow blur, and the acceptance gate. Text was rendering 1.333× too large.
- **R2 — Image filter fractions**: Filter values now arrive pre-divided by 1e5; double-dividing produced near-zero opacity/brightness.
- **R3 — Gradient**: String position parse (`"50%"` → `0.5`), `(θ+90)` angle correction, real SVG `linearGradient` render replacing a CSS fallback.
- **R4 — Grouped elements**: Center-transform replacing double-rotating AABB boxing that compounded rotation error on every nested group.
- **R5 — Charts/diagrams**: Stacked/area chart series mapping + diagram fit-meta.
- **R6 — EMF/WMF**: Explicit placeholder instead of silent drop.

The meta-fix: `pptxtojson-2.0.2-output.fixture.js` — a real-parser-shaped regression fixture — plus a convention-drift guard test that fails loudly if the library's output shape changes again.

## What We Tried

Prior plan had *added* `×96/72` font conversion claiming it fixed "text too small." New geometry evidence (canvas is 72-DPI, not 96-DPI) proved it made text larger. Reversed with evidence. A code review also caught a structural defect the green tests missed: the pt-recovery guard detected "did this node set a font-size" by comparing magnitudes across unit systems (`px` vs `pt`), which collides when `18pt × 96/72 == inherited 24pt`. Fixed by detecting the property structurally from the node's own style.

Three times during the plan, green tests met a verified baseline and the right move was to stop and surface a user decision rather than auto-patch: (1) corpus semantic baseline dropped on 2 decks because EMF images became placeholders; (2) a strict element-count gate read the EMF reclassification as 15%+ image "loss"; (3) a browser audit flagged a 5px shape bleed that was actually the *correct* rotated-group fix exposing a faithful source overflow the old buggy code had masked.

## Root Cause Analysis

We shipped mappers without a real-parser fixture. The library upgraded silently (no semver major bump visible in our lockfile diff), and our fabricated test data insulated us from noticing. The convention drift lived undetected until a browser audit made the visual regression undeniable.

## Lessons Learned

- **Fabricated fixtures lie.** If your test data doesn't come from the actual library output, you're testing your assumptions, not the integration.
- **Passing tests ≠ correct code.** A code review found a real defect the green suite missed entirely.
- **Verified baselines are user decisions, not auto-patches.** When a fix changes a corpus metric, surface it — don't silently relax the gate.
- **Guard against convention drift explicitly.** The new drift-guard test is the artifact that should have existed from day one.

## Next Steps

- Monitor `pptxtojson` releases; the drift-guard test will catch the next breaking change automatically.
- Consider pinning the library version in `package.json` with an explicit upgrade checklist comment.
- Owner: any dev touching the import pipeline. No hard deadline — guards are now in place.

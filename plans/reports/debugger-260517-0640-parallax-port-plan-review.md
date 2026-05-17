# Parallax Port Plan Review - Investigation Report

## Executive Summary
- **Issue:** Need verify implementation against `plans/parallax-features-port/port-features-from-parallax-presentations-plan.md`.
- **Impact:** Feature set mostly present, but several plan requirements not fully met or use different schema/API.
- **Root cause:** Implementation optimized to existing codebase patterns, but plan status/checklists not synchronized and some acceptance criteria softened by tests.
- **Status:** DONE_WITH_CONCERNS.
- **Fix:** Address P1 gaps below, then update plan statuses based on actual completion.

## Evidence
- `npm run lint`: PASS.
- `npm run build`: PASS.
- `npm run test`: INCONCLUSIVE, timed out after ~184s in this session.
- Focused Vitest: PASS, 11 files / 87 tests.
- Focused Playwright: PASS, 14 tests in `tests/e2e/parallax-element-insertion-property-controls-and-rendering.spec.js`.

## Phase Assessment
| Phase | Status | Notes |
|---|---|---|
| 01 TipTap FontWeight/LineHeight | Mostly complete | Extensions, toolbar/properties controls, tests present. File names differ from plan but follow kebab-case. |
| 02 Video URL/trim/speed | Mostly complete | URL, start/end, playback rate, `.ogv` supported. Schema uses `startTime`/`endTime`/`playbackRate`, not plan's `trimStart`/`trimEnd`/`playbackSpeed`. |
| 03 Editor UX | Partial | LaTeX/citation/copy URL mostly mapped to existing `fontSize`/`textColor`/`citationColor`. Ctrl+K link modal requirement not met; Ctrl+K remains command palette. Global citation font size/family not found. |
| 04 Present CSS fixes | Partial | Auto-animate guard and no `contain: paint` evidence present. Missing `client/public/reveal-overrides.css`; present HTML embeds still use `srcdoc`, not data URLs; present LaTeX still iframe, direct render only print path. |
| 05 Timeline | Partial/Mostly complete | Element renders in canvas/export, properties and tests present. Component is 314 LOC, over 200 LOC requirement. Export timeline omits event images/expanded details. |
| 06 Kinetic/Math/Anime/Three | Partial | Four modals integrated and under 200 LOC. Kinetic and Math template counts met/exceed. Anime/Three list expected templates, but several aliases reuse simpler implementations, not distinct template behavior. |
| 07 Bug fixes | Partial | Iframe wrapper/citation overflow/crop-related tests present. Some fixes not applicable or not proven by targeted tests. |
| 08 Upload dedup/File browser | Mostly complete | SHA-256 dedup route, upload list/delete endpoints, file browser UI/tests present. Uses flat `/uploads/{filename}` storage, not presentation subdirectory in plan example. |
| 09 Integration verification | Overstated in docs | Phase says complete and full tests pass, but current session could not complete `npm run test`; load tests still blocked by k6 per phase file. |

## Key Findings
1. Plan status stale: overview marks Phase 01-08 as `Pending`, while implementation exists.
2. Phase 09 marked `Complete` even though it depends on Phase 01-08 and still lists load tests blocked.
3. Tests prove happy paths, but several specific acceptance criteria are not tested exactly: Ctrl+K link modal, data URL HTML embeds, reveal override CSS file, direct present LaTeX, distinct Anime/Three templates.

## Recommendations
### Immediate (P0)
- Fix/document Ctrl+K behavior: either implement link modal per plan or update plan to command palette behavior.
- Decide canonical schema for video trim/speed and LaTeX/citation fields; add migration/compat if needed.
- Update plan overview statuses to reflect actual state, not all Pending.

### Short-term (P1)
- Complete Phase 04 exactly or revise requirement: `reveal-overrides.css`, data URL HTML embeds, direct present LaTeX, section `line-height: normal`.
- Split `client/src/components/timeline-element.jsx` under 200 LOC or document accepted exception.
- Add tests that assert the exact missing acceptance criteria above.

### Long-term (P2)
- Replace alias Anime/Three templates with distinct implementations if parity with parallax-presentations is required.
- Run full `npm run test`, `npm run test:e2e`, `npm run test:corpus`, and k6 load tests in an environment with `k6`.

## Unresolved Questions
- Should plan be treated as strict spec, or can existing NavSlidesEditor schema names replace plan field names?
- Is Ctrl+K reserved for command palette intentionally, or should it be reassigned to link insertion while editing text?
- Are Anime/Three template aliases acceptable parity, or must each listed template have unique behavior?

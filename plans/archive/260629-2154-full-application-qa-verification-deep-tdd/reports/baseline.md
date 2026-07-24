# Phase 1 Baseline Report

## Summary
Phase 1 confirmed the existing QA inventory is broad but not complete for the user's “all controls/elements/workflows/UI/logic” target. Existing source-derived inventory covers 118 capabilities and 19 canonical element types, while the new plan expands the required scope to include all controls, variants, Electron, plugin, marketplace, explore, and analytics surfaces as first-class matrix rows.

## Commands Run
| Command | Result |
|---|---|
| `npm run inventory` | PASS; wrote 118 capabilities |
| `npm run matrix` | PASS; editor-core matrix reported 100/100 verified, 1 orphan |
| `npm run matrix:extended-report` | PASS command; stdout reported extended domain rows as 0/18 verified, 18 TAGGED in the fresh run |
| `git diff --check` | PASS for new plan files; only CRLF warning on a pre-existing plan file |

Generated cross-plan matrix artifacts were reverted after inspection to avoid changing historical reports outside this plan.

## Inventory Counts
| Category | Count |
|---|---:|
| ai | 5 |
| canvas | 10 |
| command | 9 |
| control | 14 |
| element | 19 |
| export | 2 |
| flow | 5 |
| game | 1 |
| history | 1 |
| import | 3 |
| live | 2 |
| share | 2 |
| shortcut | 44 |
| sync | 1 |

## Baseline Findings
- Existing matrix is strong for editor-core capabilities but too narrow for “all controls” because only 14 controls are inventory rows.
- Existing element coverage tracks 19 canonical types but not every variant/subtype: game variants, shape variants, chart types, slide layouts, themes, transitions, design presets, FX backgrounds, and insert sub-actions need source-derived rows.
- Extended-domain evidence needs stricter fresh-run handling; stale or TAGGED rows must not count as release verification.
- Electron desktop shell is not yet a first-class matrix surface.
- Plugin runtime, marketplace, explore, and analytics are present in app/API surfaces but not promoted enough in current inventory.

## Phase 2 Inputs
- Add all source-derived controls and variants to matrix schema.
- Treat stale generated reports as non-authoritative until regenerated from fresh test JSON.
- Separate P1 release-blocking evidence from P2/P3 inventory/manual evidence.

## Open Questions
None.

# Phase 02 - Coverage Matrix Expansion Model

## Context Links

- [Plan](./plan.md)
- [Phase 01](./phase-01-baseline-audit-and-risk-taxonomy.md)
- [Code Standards](../../docs/code-standards.md)
- `scripts/feature-inventory/feature-manifest.json`
- `scripts/feature-inventory/build-matrix.mjs`
- `scripts/feature-inventory/check-coverage-gate.mjs`

## Overview

Priority: P0  
Status: completed  
Description: Extend coverage governance so PASS means more than "one tagged test exists." Keep it simple: add depth labels before adding strict gates.

## Key Insights

- Current `[cap:<id>]` tags are valuable; do not replace them.
- The missing concept is assertion depth: behavior vs persistence vs export vs visual.
- Start warn-first to avoid blocking unrelated work.

## Requirements

- Add or document depth dimensions for capability coverage.
- Keep backward compatibility with existing `[cap:<id>]` tests.
- Generate reports that show shallow PASS vs deep confidence.
- Avoid requiring every capability to have every depth dimension.
- Define a small coverage-depth policy before changing scripts.
- <!-- Updated: Validation Session 1 - coverage-depth rollout is warn-first MVP, not strict required gate. -->

## Architecture

Extend manifest metadata and report generation:

```text
feature-manifest.json + test title tags -> run results -> depth report -> docs matrix
```

Possible tag convention:

```text
[cap:control.format.position depth:persistence]
[cap:export.pptx depth:export]
[cap:live.reconnect depth:sync]
```

Allowed initial depth labels:

| Depth | Required evidence |
|---|---|
| `trace` | Capability is tagged and passing at the right layer |
| `behavior` | User-visible or public API behavior assertion |
| `persistence` | Saved JSON/state survives reload or equivalent serialization check |
| `export` | Exported artifact or renderer output includes the changed behavior |
| `sync` | Multi-client/server state propagation is asserted |
| `visual` | Stable screenshot or pixel/DOM visual assertion |
| `a11y` | Keyboard, role, or axe assertion |
| `perf` | Timed/load threshold assertion |

## Related Code Files

Modify:
- `scripts/feature-inventory/extract-tags.mjs`
- `scripts/feature-inventory/build-matrix.mjs`
- `scripts/feature-inventory/check-coverage-gate.mjs`
- `scripts/feature-inventory/matrix-format.mjs`
- `docs/navslides-editor-vitest-playwright-k6-testing-guide.md`
- `docs/code-standards.md`
- `docs/feature-coverage-matrix.md` by running the generator only.

Create:
- `scripts/feature-inventory/coverage-depth-policy.json`

Delete:
- None.

## Implementation Steps

1. Write failing tests for tag parsing of optional `depth:*` tokens.
2. Update parser to collect cap IDs and depth labels.
3. Add a policy file or manifest fields for required depth per high-risk capability; prefer a separate policy file if manifest readability drops.
4. Update matrix output to show depth status without breaking existing PASS count.
5. Add warn-first gate for missing required depth.
6. Document the tag convention and promotion policy.

## Todo List

- [x] Add parser tests for depth tags.
- [x] Add depth metadata model.
- [x] Update matrix rendering.
- [x] Add warn-first gate.
- [x] Document new coverage semantics.

## Completion Notes

- Added `depth:*` parsing for inline cap tags and standalone title tags while keeping old `[cap:<id>]` tags valid.
- Added `coverage-depth-policy.json` with allowed evidence definitions and warn-first requirements with owner/phase metadata.
- Matrix rows now include verified depth labels and missing required depth notes without changing PASS count.
- `matrix:gate` warns on `DEPTH-WARN` instead of failing until Phase 7 promotion.
- Post-review fix: initial policy requirements are limited to editor-core rows evaluated by the current matrix/gate; extended-domain depth requirements are deferred to later phases.
- Validation: feature-inventory tests 91/91 pass; `npm run matrix:gate`, `npm run lint`, and `npm run build` pass.

## Success Criteria

- Existing tests remain valid.
- Matrix exposes shallow vs deep coverage clearly.
- Depth labels cannot be added unless they map to one of the allowed evidence definitions.
- `npm run matrix:gate` remains usable locally.
- Missing depth gaps are actionable and owned.
- Strict failure on missing depth is not enabled until Phase 7 records promotion evidence.

## Risk Assessment

- Risk: overcomplicated taxonomy. Mitigation: use 5-7 depth labels only.
- Risk: false red gate. Mitigation: warn-first until two consecutive green runs.
- Risk: vanity depth labels that do not prove behavior. Mitigation: parser/report tests must include positive and negative examples for each supported depth.

## Security Considerations

- Generated reports must not include raw sensitive artifact content.

## Next Steps

- Phase 3 starts adding deep unit/component tests against this model.

## Red Team Notes

- Accepted finding: depth taxonomy can become a second shallow metric. The plan now requires evidence definitions and negative parser/report tests before gate promotion.

## Unresolved Questions

- None.

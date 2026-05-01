---
phase: 1
title: "Scope Guard And Baseline"
status: completed
priority: P1
effort: "2h"
dependencies: []
---

# Phase 1: Scope Guard And Baseline

## Context Links
- [Plan](./plan.md)
- [Debug validation report](../reports/debug-260426-code-review-master-validation.md)
- [Scope analysis](./reports/scope-analysis.md)
- [Code standards](../../docs/code-standards.md)
- [System architecture](../../docs/system-architecture.md)

## Overview
Freeze the trusted-content policy before code changes. Add baseline tests that prove HTML embed and interactive export still work after later phases.

## Key Insights
- Project value depends on programmable HTML embeds.
- Generic sanitizer/sandbox changes are explicitly out of scope.
- Baseline tests must fail if HTML embed scripts stop working.

## Requirements
- Functional: document content policy and preserve current HTML embed behavior.
- Non-functional: no production behavior changes in this phase.

## Architecture
Policy is docs/test-level guard, not runtime rewrite:
`HTML embed -> trusted programmable block`
`Text/Markdown/SVG -> target-specific safety later`
`Public share/server routes -> hardened without blocking embeds`

## Related Code Files
- Modify: `docs/code-standards.md` or `docs/system-architecture.md` only if adding policy now.
- Create: plan-scoped test notes under `plans/.../reports/` if needed.
- Modify later: `client/src/components/SlideCanvas.jsx`, `shared/src/element-renderers.js`, tests.

## Implementation Steps
1. Confirm not-in-scope list in `plan.md`.
2. Add or update lightweight docs note: HTML embed is trusted programmable content.
3. Identify current interactive embed sample for regression:
   - `<button onclick="document.body.dataset.clicked='1'">`
   - simple D3/chart-style script.
4. Add test checklist for later phases:
   - editor iframe executes trusted script.
   - export HTML keeps trusted script.
   - text/markdown/svg safety does not touch HTML embed.

## Todo List
- [x] Write policy note.
- [x] Create baseline fixture content for tests.
- [x] Confirm no HTML embed sanitizer task exists in later phases.

## Tests / Verification
- `npm run test -- client/src/components/...` after tests exist.
- Manual baseline: create HTML embed with script, preview, present/export, verify script runs.
- Regression invariant: any phase changing iframe/render code must rerun embed test.

## Success Criteria
- [x] Plan explicitly excludes generic HTML embed blocking.
- [x] Baseline fixture exists or is documented.
- [x] Later phase tests reference this invariant.

## Risk Assessment
- Risk: later phases accidentally sanitize HTML embed.
- Mitigation: explicit tests and review gate.

## Security Considerations
- Trusted authoring model accepted.
- Server-side trust boundaries still harden in later phases.

## Next Steps
- Phase 2 can start after policy is frozen.

# Phase 06: Integration Verification And Docs

## Context Links

- Depends on: phases 01-05
- Local docs: `docs/project-roadmap.md`, `docs/project-changelog.md`, `docs/system-architecture.md`, `docs/code-standards.md`
- Test commands: `npm run lint`, `npm run test`, `npm run build`

## Overview

- Priority: P2
- Status: Complete
- Description: Verify plugin runtime end-to-end and update project docs.

## Key Insights

- Docs currently say plugin architecture is deferred. Update once implementation lands.
- Full E2E may be expensive; at minimum run targeted Playwright if UI insertion changed.
- Code review is required after implementation per local rules.

## Requirements

- Functional:
  - Automated tests cover server, client registry/sandbox/ribbon, shared export.
  - Manual smoke or Playwright covers insert/render.
  - Docs/changelog reflect shipped scope and deferred items.
- Non-functional:
  - No failing lint/build.
  - No confidential files committed.
  - Reports concise; unresolved questions last if any.

## Architecture

Verification sequence:

```text
unit/route tests -> component tests -> shared export tests -> build -> focused e2e -> docs update -> code review
```

## Related Code Files

- Modify: `docs/project-roadmap.md`
- Modify: `docs/project-changelog.md`
- Modify: `docs/system-architecture.md`
- Modify: `docs/code-standards.md`
- Create optional: `tests/e2e/plugin-runtime.spec.js`

## TDD Plan

1. Ensure each implementation phase has tests before code.
2. Add E2E only after unit/component tests pass.
3. E2E scenario:
   - create/open presentation
   - Insert -> Plugin -> Animated Counter
   - verify `data-element-type="plugin:counter"`
   - reload presentation
   - verify element still exists

## Implementation Steps

1. Run targeted Vitest suites from phases.
2. Run `npm run lint`.
3. Run `npm run build`.
4. Run focused Playwright if added.
5. Update docs:
   - roadmap: plugin runtime Phase 1 complete/deferred Phase 2.
   - changelog: added plugin runtime foundation.
   - architecture: plugin runtime section.
   - code standards: plugin manifest and sandbox rules.
6. Request code review agent after implementation, per AGENTS rules.

## Todo List

- [x] Targeted tests
- [x] Lint
- [x] Build
- [x] Focused E2E or manual smoke notes
- [x] Docs update
- [x] Code review

## Success Criteria

- All targeted tests pass.
- Build succeeds.
- Docs no longer claim all plugin runtime is deferred.
- Deferred items are explicit: marketplace, install ZIP, plugin KV storage, offline sandbox inlining.

## Risk Assessment

- Docs may overstate capability. Keep Phase 1 scope explicit.
- E2E flake if plugin loading async; wait on visible plugin button/element.

## Security Considerations

- Verify sample plugin includes no external script.
- Verify `.env`, credentials, and generated data are not included.

## Next Steps

- Cook implementation.
- Plan Phase 02 later for offline sandbox inlining and richer property panel support.

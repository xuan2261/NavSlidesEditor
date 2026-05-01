---
phase: 9
title: "Tech Debt Docs And Final Verification"
status: completed
priority: P2
effort: "4h"
dependencies: [8]
---

# Phase 9: Tech Debt Docs And Final Verification

## Context Links
- [Plan](./plan.md)
- [Red-team review](./reports/red-team-review.md)
- `client/src/hooks/use-history.js`
- `client/src/hooks/use-keyboard.js`
- `client/src/components/DropdownMenu.jsx`
- `client/src/components/SlideThumbnail.jsx`
- `docs/code-standards.md`
- `docs/system-architecture.md`
- `docs/project-changelog.md`
- `docs/project-roadmap.md`

## Overview
Clean small confirmed debt, update docs, and run final verification. Keep cleanup low-risk and defer anything that grows scope.

## Key Insights
- Some reviewed issues are polish/debt, not blockers.
- Docs must record trusted HTML embed policy so future security reviews do not reintroduce generic blocking.
- Electron sandbox policy needs a separate decision unless implementation is trivial and build-verified.

## Requirements
- Functional: remove or document unused/stale hooks only if no consumers.
- Functional: add defensive null guards where low-risk.
- Functional: update docs/roadmap/changelog.
- Non-functional: do not refactor unrelated UI or rewrite architecture.

## Architecture
Small cleanup only:
- Delete unused hooks if no imports.
- Add guard in `DropdownMenu` if cheap.
- Dedupe constants only if clear shared location exists.
- Electron sandbox: document decision or create follow-up plan, not blind change.

## Related Code Files
- Modify/delete: `client/src/hooks/use-history.js` if unused and tests confirm.
- Modify/delete: `client/src/hooks/use-keyboard.js` if unused and tests confirm.
- Modify: `client/src/components/DropdownMenu.jsx`
- Modify: `client/src/pages/EditorPage.jsx` dead vars only if safe.
- Modify: `docs/code-standards.md`
- Modify: `docs/system-architecture.md`
- Modify: `docs/project-changelog.md`
- Modify: `docs/project-roadmap.md`
- Optional docs: `docs/decisions/260426-trusted-html-embed-policy.md`

## Implementation Steps
1. Re-scan imports for stale hooks.
2. Delete unused hook files only if no imports and no planned near-term use.
3. Add simple `items?.filter(Boolean)` or default `items = []` in DropdownMenu.
4. Remove dead state/vars only in touched files.
5. Add trusted-content policy docs:
   - HTML embed is trusted programmable content.
   - Text/Markdown/SVG safety is targeted.
   - Public share/server boundaries still hardened.
6. Update changelog and roadmap with actual implemented phases.
7. Decide Electron sandbox:
   - if not implemented, create follow-up note/plan.
   - if implemented, run Electron build/dev verification.

## Todo List
- [x] Re-scan stale hook imports.
- [x] Cleanup only safe dead code.
- [x] Add DropdownMenu null guard.
- [x] Update docs and changelog.
- [x] Record Electron sandbox decision/follow-up.
- [x] Run final verification.

## Tests / Verification
- Commands:
  - `rg "useHistory|useKeyboard" client/src`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `npm run test:e2e` or high-risk subset if full suite too slow.
  - `npm run electron:prepare` if Electron files changed.
- Manual:
  - create interactive HTML embed and verify script still runs.
  - share presentation and verify viewer/analytics/live flows.

## Success Criteria
- [x] Docs explain why generic HTML embed blocking is not used.
- [x] Changelog/roadmap updated.
- [x] Tests/build pass or failures documented with root cause.
- [x] No unrelated refactor.

## Risk Assessment
- Risk: cleanup creates churn.
- Mitigation: only delete/modify confirmed unused code.

## Security Considerations
- Locks final threat model into docs.
- Electron sandbox remains explicit unresolved/follow-up if not fixed.

## Next Steps
- Ship implementation after code review and test pass.

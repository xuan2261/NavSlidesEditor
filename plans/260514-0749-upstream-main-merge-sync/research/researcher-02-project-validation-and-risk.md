# Researcher 02 Report - Project Validation And Risk

## Scope

Identify project-specific validation needed after upstream merge.

## Project Context

- Product: self-hosted WYSIWYG presentation editor powered by reveal.js.
- Runtime: Node.js 20+.
- Workspaces: `server`, `client`, `shared`.
- Client: React 18, Vite 5, Tailwind 3, Zustand, TipTap.
- Server: Express 4, JSON/filesystem storage.
- Desktop: Electron 33.
- Tests: Vitest and Playwright.

## High-Value Local Features To Preserve

- UI/UX warm editorial overhaul.
- PPTX import fidelity improvements.
- Game/gamification controls.
- Live/presenter features.
- Export/share/cloud sync behavior.

## Validation Matrix

| Area | Command/Check | Why |
| --- | --- | --- |
| Git hygiene | `git status --porcelain=v1` | ensure no accidental unstaged work before each gate |
| Dependency integrity | `npm install` | updates lockfile consistently after upstream package changes |
| Syntax/build | `npm run build` | fastest full frontend compile gate |
| Unit/component tests | `npm run test` | validate stores/components/services |
| E2E smoke | `npm run test:e2e -- tests/e2e/editor.spec.js` | editor core flow |
| AI/modal smoke | `npm run test:e2e -- tests/e2e/ai.spec.js` | local modified modal surfaces |
| Game smoke | `npm run test:e2e -- tests/e2e/games/game-elements.spec.js` | preserve custom game work |

## Merge Conflict Policy

- Default to preserving local product direction where upstream conflicts with local branding/UI changes.
- Default to accepting upstream bug fixes when changes are isolated and do not remove local features.
- For lockfile conflicts, regenerate with `npm install`; avoid manual lockfile surgery except to unblock install.
- For test snapshot conflicts, do not update snapshots until manual UI check confirms expected visual change.

## Rollback Strategy

- Before merge: current `master` remains intact.
- During merge: use `git merge --abort` if conflict resolution goes wrong.
- After merge commit: keep sync branch; if bad, reset only the sync branch, not `master`.
- Before final merge to `master`: tag or note pre-sync commit hash.

## Unresolved Questions

- None blocking plan creation.

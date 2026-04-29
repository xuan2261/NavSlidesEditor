# Worktree Baseline

Date: 2026-04-23

## Commands

- `git status --short --branch`: dirty worktree on `master...origin/master`
- `git diff --name-status`: 92 tracked files changed plus untracked helper/test/plan files
- `git diff --stat --compact-summary`: 3588 insertions, 3426 deletions
- `git diff --check`: pass
- `rg "TemplatePreview|slideNotes|slide-operation-helpers|find-replace-helpers" client/src shared server tests`: replacement imports found, no live import of deleted `client/src/pages/dashboard/TemplatePreview.jsx`
- `rg -n "(API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY|DATABASE_URL)" .`: no committed secret values found; hits are env var names, plan scan strings, and built-in template text

## File Groups

- Tailwind foundation: `client/tailwind.config.js`, `client/vite.config.js`, `client/src/index.css`, `client/src/lib/utils.js`, UI class migrations.
- Dashboard/pages: `HomePage`, `ExplorePage`, `SettingsPage`, `TemplateGallery`, new `components/dashboard/TemplatePreview.jsx`, deleted old page-level preview.
- Editor shell/canvas: `EditorPage`, toolbar/menu components, `SlideCanvas`, `SlidePanel`, `SlideSorterView`, `FindReplaceBar`, helper tests.
- Properties/overlays: `PropertiesPanel`, properties sub-editors, modal and popover components, `ProductTour`.
- Live/shared/backend: live routes/services, socket handler, `use-live-presentation`, `LiveViewPage`, `SpeakerViewPage`, shared notes/html exports.
- Persistence/export/tests: presentation/template/AI routes, `exportPptx`, shared HTML tests, E2E specs and page objects.
- Docs/plans: architecture/codebase docs, legacy remediation plan marked superseded, this plan directory.

## Classification

- Must keep: all changed app/test/shared/server files are in this hardening scope.
- Review before commit: `scratch/*`, `fix-btn-icon.js` are existing lint-warning noise but not dirty in this plan; leave untouched.
- Generated/ignored: `client/dist`, `.playwright`, `test-results`, `playwright-report` are ignored or runtime output; do not stage.
- Deferred: no explicit deferred dirty files identified.

## Commit Groups

- UI/Tailwind foundation and dashboard/editor chrome.
- Editor operations, find/replace, slide helpers, properties and overlay tests.
- Live/shared/server/export contract changes.
- E2E/docs/plans/reports.

## Risks

- Large mixed diff. Mitigation: phase reports + full tester/code review before commit.
- CRLF warnings from Git on Windows. No whitespace errors from `git diff --check`.
- Full E2E/browser matrix passed; `k6` load gates skipped because `k6` is not installed.
- Concurrent presentation writes are now routed through the storage file lock.

## Unresolved Questions

- None.

# Scout Report

## Findings

- Notes drift exists across client, server, shared export, and AI routes. Shared `slideNotes.js` is already started and should be canonical.
- Batch slide helper tests already exist, but `client/src/hooks/slide-operation-helpers.js` is missing.
- Find/replace helper test exists, but `client/src/components/find-replace-helpers.js` is missing and UI still guards on `!replaceTerm`.
- Live rooms still store `{ presenterId, viewers, state: { slideIndex, fragmentIndex } }`; controllers are not modeled.
- `RemoteControlPage` currently joins as `presenter`.
- `SpeakerViewPage` currently joins as `viewer` and renders placeholder previews.

## Risks

- Worktree is dirty with many Tailwind changes; keep patches scoped and do not revert.
- Multi-page Playwright can be flaky if presenter HTML does not finish Reveal initialization before assertions.

## Unresolved Questions

None.

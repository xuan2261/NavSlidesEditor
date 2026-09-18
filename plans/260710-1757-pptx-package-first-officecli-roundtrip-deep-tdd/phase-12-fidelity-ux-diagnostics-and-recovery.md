---
phase: 12
title: 'Fidelity UX diagnostics and recovery'
status: in-progress
effort: '3-5 weeks'
dependsOn: [1, 11]
priority: P1
gates: [G2-surface, G4-surface]
---

# Phase 12: Fidelity UX diagnostics and recovery

<!-- Updated: Validation Session 1 - surface administrator-provided OfficeCLI, active-package original-only policy, preserve-only notes/hidden state, and level-5 unavailability. -->

## Overview

Expose package-backed fidelity, editability, validation, conflict, and recovery state honestly in import, editor, and export flows. Users must always know whether they are downloading the original, a validated edited revision, or a reconstructed fallback, and must have safe recovery actions when patching is unavailable or fails.

No unrelated UI or new product feature is added. Reuse the existing fidelity
panel and export hooks, remove implicit branching, and wire them to canonical
server capabilities and durable job outcomes. Phase 12 is a release prerequisite
for every G4 row because claim wording is unsafe while any production mutation
surface can bypass canonical row gating.

## UX States

- Import queued/running/cancelled/failed/completed with native and OfficeCLI capability summaries.
- Original preserved and exact hash-verified.
- Current working revision, pending journal, validating, verified, stale/conflicted, degraded, or recovery-required.
- Object editability tier and unsupported-property preservation.
- Export availability: exact original, validated edited revision, reconstruction fallback.
- Last validated revision and evidence level.
- Administrator-provided OfficeCLI unavailable/wrong version/hash or unsupported platform.
- Source identity ambiguous, unsupported mutation, signed, encrypted/protected, macro-enabled, ActiveX, or OLE package original-only block, quota exceeded, or transaction failure.
- Notes and hidden-slide state preserve-only; level 5 unavailable until a protected organization-owned runner exists.

Internal package paths, raw XML, OfficeCLI argv/stderr, blob hashes, temp locations, and active-content details must not leak into normal/public UI. Safe support codes may map to server-side diagnostics.

## User Flows

1. **Import:** show preservation success separately from editable projection warnings.
2. **Inspect object:** capability badge explains native edit, partial edit, replace-only, preserved opaque, or blocked.
3. **Save conflict:** present reload/compare/reapply choices without discarding either revision.
4. **Export:** distinct actions and descriptions for original, edited validated package, and reconstruction.
5. **Patch failure:** retain current revision, show reason and retry eligibility, offer original download.
6. **Recovery:** restore prior valid content as a new forward aggregate generation, retry validation, repair a missing local package reference, or download original. Historical head metadata is never copied directly into the live head.
7. **Offline/unsupported target:** original recovery works; unsupported export action is disabled with reason.
8. **Shared/live/public views:** omit internal fidelity metadata and unsafe recovery controls.
9. **Restarted job:** resume a durable import/export/provider job through
   capability-bearing fetch and a scoped `HttpOnly`/`SameSite=Strict` cookie where
   supported, or an explicit private response-header/session transport. Never put
   a capability in an EventSource URL, browser history, public DTO, analytics, or
   logs.

## TDD Matrix

| Test first                                           | Expected red                                 | Green behavior                                                      |
| ---------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------- |
| Original vs edited export                            | Buttons are ambiguous                        | Distinct label, result, and API                                     |
| Unsupported object                                   | Proxy appears editable                       | Tier badge and only allowed actions                                 |
| OfficeCLI missing                                    | Generic failure                              | Capability-specific guidance and original access                    |
| Stale save                                           | Work overwritten                             | Conflict flow preserves both states                                 |
| Patch/validation failure                             | User loses changes/original                  | Prior revision current, retry/forward-restore/download              |
| Signed/encrypted/protected/macro/ActiveX/OLE package | Export surprises user                        | Edited export disabled before staging; exact original recovery only |
| Public/share payload                                 | Internals exposed                            | Safe summary only                                                   |
| Screen reader/keyboard                               | Status inaccessible                          | Announced status, focus, keyboard actions                           |
| Refresh during job                                   | State disappears                             | Server-backed import/export/provider job and revision state resumes |
| Save queue advances generation                       | Next local save conflicts                    | Client rebases queued edits to returned successor generation        |
| Missing/corrupt revision                             | Dead end                                     | Recovery from previous/original with audit                          |
| Reconstructed fallback                               | Presented as faithful                        | Explicit non-roundtrip wording                                      |
| Evidence unavailable                                 | UI says 1:1                                  | Claim level shown accurately                                        |
| Level-5 runner absent                                | UI implies PowerPoint proof                  | Level 5 shown unavailable; lower verified claims remain visible     |
| Hidden mutation shortcut                             | Keyboard/store/API bypasses disabled control | One central client registry and server row authorization reject it  |
| Refresh during event stream                          | URL token leaks or progress is lost          | Fetch stream resumes with private cookie/header and replay cursor   |

## Implementation Steps

1. Consume and UI-test the editor/public/provider DTO contracts introduced in Phase 3; this phase must not invent a second serializer layer.
2. Add route contract tests proving internal metadata is excluded.
3. Reuse and complete the existing fidelity status, tier badge, export choice,
   conflict, and recovery components; create a new component only when no focused
   seam exists.
4. Integrate import-job progress with package/original preservation milestones.
5. Integrate editor object capability state and disable unsupported mutating controls.
   Inventory every ribbon, property panel, canvas gesture, keyboard shortcut,
   clipboard/paste, context menu, store action, autosave transform, and direct API
   mutation path. Route them through one canonical client capability registry,
   while the server independently authorizes the exact row/property/operation.
6. Replace the remaining generic `Export PPTX` implicit branching with one
   explicit capability-driven surface and dedicated handlers.
7. Add save transport rebasing, typed 409 conflict resolution, and durable idempotency-result reconciliation against the Phase 5 aggregate-head generation token.
8. Add capability-bearing fetch streaming with bounded replay/backpressure,
   status fallback, cancellation, terminal download, refresh/restart resume, and
   typed failure handling. Do not use native `EventSource`.
9. Add forward-only revision restore, durable import/export/provider job resume/terminal recovery, and original download recovery controls.
10. Add accessibility, responsive, keyboard, localization-ready, and public/share isolation tests.
11. Add analytics using reason codes only, with no slide content/package paths.
12. Validate copy against the Phase 1 claim ladder and Phase 9 tier definitions.
13. Disable notes/hidden-state editing for the first milestone and surface active-package/level-5 unavailability from server capability DTOs.
14. Add an architecture test that enumerates production mutation registrations
    and fails when a client control/store action/API operation lacks one canonical
    row ID and server authorization path.

## File Plan

- Modify `client/src/pages/HomePage.jsx` import flow.
- Modify `client/src/hooks/use-export-actions.js`.
- Add focused components/hooks under `client/src/components/` and `client/src/hooks/`.
- Modify server routes to expose safe capability/revision/export DTOs.
- Add component, hook, route, and Playwright scenarios.

## Verification

```powershell
npx vitest run client/src/components/pptx-fidelity-ux.test.jsx
npx vitest run server/routes/presentation-capabilities.test.js
npm run lint
npm run test
npm run build
npx playwright test tests/e2e/pptx-fidelity-ux.spec.js
```

Manually verify keyboard/screen-reader status flow and every error/recovery state in Windows desktop, browser server mode, and any supported Linux deployment.

## Deep File Inventory

| Action | File/interface                                                    | Planned change                                      | Test impact               |
| ------ | ----------------------------------------------------------------- | --------------------------------------------------- | ------------------------- |
| Modify | `PptxFidelityPanel.jsx`                                           | Canonical row/status/recovery states                | Component/a11y tests      |
| Modify | `use-pptx-fidelity.js`                                            | Fetch failure, stale contract, retry                | New hook tests            |
| Modify | `use-export-actions.js`                                           | Remove implicit export selection                    | Hook tests                |
| Modify | `ribbon-file-dropdown-menu.jsx`                                   | One explicit export-choice surface                  | Component/E2E tests       |
| Modify | `presentation-store.js`                                           | Durable conflict/job reconciliation                 | Store tests               |
| Create | central PPTX mutation capability registry                         | Map every control/action/API operation to exact row | Architecture/client tests |
| Modify | `fidelity-contract.js` and routes                                 | Safe canonical DTO and typed reasons                | Route/leak tests          |
| Modify | `EditorPage.jsx`                                                  | Wire existing recovery component only               | Characterization tests    |
| Create | Missing hook/public-surface tests                                 | Real capability and leakage coverage                | Unit/E2E tests            |
| Delete | Dead duplicate fidelity utility only if usage audit proves unused | Remove competing client policy                      | Architecture tests        |

## Function and Interface Checklist

- [ ] Preserve `buildFidelityDto()` and explicit export handlers.
- [ ] Test and complete `usePptxFidelity()`.
- [ ] Drive tier copy/control state from canonical safe DTO rows.
- [ ] Wire recovery conflict props in production.
- [ ] Resume or reconcile durable export/provider terminal states.
- [ ] Stream/resume/cancel/download through fetch with cookie/header capability,
      never URL tokens or native EventSource.
- [ ] Prove every production mutation control and store/API path resolves through
      one canonical row gate plus independent server authorization.
- [ ] Keep share/live/public surfaces free of authority metadata.

## Tests Before

1. Generic export still chooses original or reconstruction implicitly.
2. Fidelity fetch/retry hook has no direct coverage.
3. Recovery component is not production-wired.
4. Object-level capability does not drive controls.
5. Durable export/provider restart recovery is not represented.
6. Keyboard/store/direct API paths can mutate a row disabled in the visible panel.
7. EventSource or URL query transport would expose bearer capability.

## Refactor

Consolidate policy in the server DTO and one client registry. Keep the client
declarative and the server authoritative. Coordinate `EditorPage.jsx` ownership
with the separate UI remediation plan.

## Tests After

- Exact original, validated edited, and reconstructed actions remain distinct.
- Typed qualification/validation/conflict reasons map to safe retry/recovery actions.
- Preserve-only and blocking rows cannot invoke mutation controls.
- Restarted jobs resolve from durable state without process-local assumptions.
- All ribbon/panel/canvas/keyboard/clipboard/context/store/API mutation paths are
  enumerated and fail closed against the exact row.
- Keyboard, screen-reader, narrow viewport, share/live/public isolation pass.

## Dependency Map

```text
G0 safe canonical DTO + G2 transaction/job states
  -> explicit fidelity/export/recovery surface
  -> G4 exact row capability controls
  -> mandatory Phase 13 G4 release prerequisite
```

## Debug and Reports

- `reports/phase-12/ux-state-matrix.json`
- `reports/phase-12/export-wording-audit.md`
- `reports/phase-12/public-metadata-leak-audit.json`
- `reports/phase-12/accessibility-results.json`
- `reports/phase-12/recovery-flow-results.json`

## Risks and Controls

- **Misleading labels:** copy generated/reviewed against claim and tier contracts.
- **Metadata leakage:** safe DTO allowlists and public/share contract tests.
- **Recovery data loss:** immutable prior revisions and destructive actions require explicit confirmation.
- **Restart ambiguity:** generalized durable job/idempotency outcomes drive UX; process-local status is never authoritative.
- **Editor control mismatch:** capability metadata drives both UI and server authorization.
- **Surface bypass:** a generated registration audit covers every mutation entry
  point; server row authorization remains mandatory even if UI gating regresses.

## Success Criteria

- [x] Users can distinguish original, validated edited revision, and reconstructed fallback before download.
- [x] Signed, encrypted/protected, macro-enabled, ActiveX, and OLE packages expose exact original recovery only, and absent protected provider infrastructure cannot be mistaken for level-5 evidence.
- [ ] Object controls and wording match exact canonical tested rows.
- [ ] No production mutation entry point bypasses canonical client gating and
      independent server row authorization; this criterion blocks G4 release.
- [ ] Save conflicts and export failures preserve work and expose
      retry/forward-restore/original recovery through production wiring.
- [x] Queued autosaves adopt each successful successor generation without self-conflicts.
- [ ] Import, export, and provider progress survives restart or resolves to one
      durable terminal recovery state.
- [ ] Progress/status/cancel/download uses capability-bearing fetch with bounded
      replay and no capability in URLs.
- [x] Restoring history always creates a new forward aggregate generation and never republishes historical head metadata.
- [x] Public/share/live surfaces contain no package authority or sensitive diagnostics.
- [x] Accessibility and responsive workflows pass for every critical state.
- [ ] Client, route, Playwright, lint, unit, and build validators pass.

## Session 4 Local Scope Rebase: Active Phase Contract

This section supersedes contradictory active protected-provider and non-Windows
release wording above.

- Keep Original, Validated Edited, and Reconstructed exports visibly distinct.
  Original remains available through missing, stale, blocked, failed, cancelled,
  and unsupported validator states.
- The private fidelity capability reports the current generation, canonical
  matrix subject, exact row tiers/eligibility/promotion, OfficeCLI qualification,
  local PowerPoint state, claim ceiling, ordered reasons, and
  `authority:"local"` through a strict safe DTO. Public/share/live/remote surfaces
  expose no package, process, local-path, journal, receipt, or evidence authority.
- Every claim-bearing view states that results apply only to the recorded Windows,
  Office, OfficeCLI, fonts, locale, DPI, corpus, configuration, matrix,
  thresholds, package, output, and Windows Electron artifacts.
- The local limitations are explicit: profile access, egress isolation,
  independent descendant containment, teardown attestation, independent
  attestation, and separate approvers are not proven.
- After a passing local PowerPoint run, expose three separate owner actions for
  `app-storage`, `security`, and `release`. The same owner may approve all three;
  receipts remain distinct and do not imply independent approval.
- Inventory every UI, store, hook, and API mutation entry point. Client gating and
  independent server row authorization are both required before `G4`.
- Validate the active release UX on Windows browser and the NSIS-installed and
  portable Electron applications only.

Run focused capability/DTO, wording, role-receipt, mutation-surface,
conflict/recovery, durable-job, accessibility, and responsive tests, then route,
Playwright, lint, unit, and build validators. Completion requires honest local
wording, no mutation bypass, no private authority leak, and working recovery in
all tested Windows surfaces.

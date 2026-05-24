---
title: "Local Evidence - Security Presenter Token Cross Room"
date: 2026-05-23
status: local-pass-upstream-blocked
phase: 2
rowId: security-presenter-token-cross-room
---

# Local Evidence - Security Presenter Token Cross Room

## Scope Guard

This report is local security invariant evidence for the current repo. It is not
upstream oracle evidence, does not prove upstream parity, and does not make the
matrix row release-ready.

This row remains `Blocked` until approved upstream automation passes, complete
manual oracle evidence is attached, or a signed row-level waiver is approved.
Because this is a security invariant, matching an insecure upstream behavior
would still remain a local release blocker.

## Row

| Field | Value |
|---|---|
| Row id | `security-presenter-token-cross-room` |
| Tier | `MVP P0` |
| Security invariant | `yes` |
| Behavior contract | Presenter join rejects missing, malformed, wrong-room, or cross-room presenter tokens; viewer role is not presenter-token gated |
| Matrix path | `docs/upstream-parity-matrix.md` |

## Commands

```powershell
npx playwright test tests/e2e/security/presenter-token-validation-rejects-invalid-and-cross-room-reuse.spec.js
npm test -- server/services/live-rooms.test.js server/services/socket-handler.test.js
```

## Results

| Command | Exit code | Result | Duration |
|---|---:|---|---:|
| `npx playwright test tests/e2e/security/presenter-token-validation-rejects-invalid-and-cross-room-reuse.spec.js` | `0` | `6 passed` | `11.7s` |
| `npm test -- server/services/live-rooms.test.js server/services/socket-handler.test.js` | `0` | `30 passed` | `3.17s` |

## Covered Local Behaviors

- Wrong presenter token emits `join-error` with `invalid-presenter-token`.
- Missing presenter token emits `join-error`.
- Unknown room emits `room-not-found` or `join-error`.
- Valid token from one room cannot join a different room as presenter.
- Valid presenter token can join and receive `presentation-data`.
- Viewer can join without presenter token gating.
- Live-room and socket-handler unit coverage validates token rejection paths.

## Limitations

- No approved upstream runtime evidence was captured.
- No screenshot, video, or exported artifact from the approved upstream SHA is
  attached.
- Malformed token fuzzing and rapid repeated cross-room attempts are not fully
  covered by this local slice.
- This result cannot be used as `Pass` evidence for upstream parity.

## Follow-Up Required

- Capture manual oracle evidence for `security-presenter-token-cross-room`, or
  recover upstream automation for the approved SHA.
- Keep local security invariant enforcement as a release blocker even if
  upstream behavior differs.
- Assign a reviewer for manual oracle evidence signoff.

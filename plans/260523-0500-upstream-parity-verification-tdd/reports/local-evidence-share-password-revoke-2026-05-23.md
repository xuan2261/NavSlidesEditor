---
title: "Local Evidence - Share Password Revoke"
date: 2026-05-23
status: local-pass-with-initial-flake-upstream-blocked
phase: 2
rowId: share-password-revoke
---

# Local Evidence - Share Password Revoke

## Scope Guard

This report is local regression evidence for the current repo only. It is not
upstream oracle evidence, does not prove upstream parity, and does not make the
matrix row release-ready.

The row remains `Blocked` until approved upstream automation passes, complete
manual oracle evidence is attached, or a signed row-level waiver is approved.

## Row

| Field | Value |
|---|---|
| Row id | `share-password-revoke` |
| Tier | `MVP P0` |
| Security invariant | `no` |
| Behavior contract | Protected share links reject wrong passwords, accept correct passwords, hide password material, and revoked links stop working |
| Matrix path | `docs/upstream-parity-matrix.md` |

## Commands

```powershell
npx playwright test tests/e2e/share/share-link-with-password-protection-and-verification.spec.js tests/e2e/share/share-link-revoke-deletion-and-list-endpoint.spec.js
npm test -- server/routes/share.test.js
npx playwright test tests/e2e/share/share-link-with-password-protection-and-verification.spec.js
```

## Results

| Command | Exit code | Result | Duration |
|---|---:|---|---:|
| Combined share Playwright slice | `0` | `8 passed`, `1 flaky` | `9.6s` |
| `npm test -- server/routes/share.test.js` | `0` | `3 passed` | `2.41s` |
| Password Playwright rerun | `0` | `5 passed` | `8.0s` |

## Initial Flake

The combined Playwright run reported one flaky test:

- `GET /share/:token returns password form when token is protected`
- First attempt failed because `res.ok()` was false.
- Playwright retry passed.
- A direct rerun of `share-link-with-password-protection-and-verification.spec.js`
  passed all 5 tests.

This report records the flake instead of treating the first run as a clean pass.

## Covered Local Behaviors

- Protected share links render a password form.
- Wrong password verification returns `401`.
- Correct password verification succeeds.
- Unknown share token returns `404`.
- Share API responses include `isProtected` and do not expose plaintext password
  material.
- Individual share token revoke returns `404` afterward.
- Revoke-all for a presentation removes active shares.
- Share list exposes active links and hides password hashes.
- Server route unit tests cover password hashing and response shape.

## Limitations

- No approved upstream runtime evidence was captured.
- No screenshot, video, or exported artifact from the approved upstream SHA is
  attached.
- The initial Playwright flake needs monitoring before this row can be treated
  as locally stable.
- Missing-password form submit and revoked-token reuse through browser UI are
  not fully covered by this local slice.
- This result cannot be used as `Pass` evidence for upstream parity.

## Follow-Up Required

- Capture manual oracle evidence for `share-password-revoke`, or recover
  upstream automation for the approved SHA.
- Investigate or monitor the initial `GET /share/:token` flake if it repeats.
- Assign a reviewer for manual oracle evidence signoff.

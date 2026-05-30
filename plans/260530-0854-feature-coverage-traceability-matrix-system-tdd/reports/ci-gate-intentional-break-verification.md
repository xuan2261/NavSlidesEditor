# CI Gate & Drift Guard — Intentional-Break Verification

Per the "verified by intentional break" convention: a guard that has never been
seen to fail is not proven. Both drift layers were broken on purpose, observed
red, then reverted. Recorded here as durable proof.

## Break #1 — auto-source drift (ELEMENT_DEFAULTS / DEFAULT_SHORTCUTS)

**Action:** added a fake shortcut `{ id: 'fakeDriftProbe', ... }` to
`DEFAULT_SHORTCUTS`, regenerated the matrix.

**Observed:**
- Matrix: `73/101 verified | GAP:1` — the fake auto-entered inventory as a GAP.
- Drift guard (`element-defaults.test.js`) went RED:
  `untracked shortcut caps: shortcut.fakeDriftProbe`.
- Coverage gate exited **1**:
  `FAIL GAP: shortcut.fakeDriftProbe — add a [cap:shortcut.fakeDriftProbe] test or an allowlist entry`.

**Reverted:** fake shortcut removed; matrix back to `73/100`, gate exit 0,
drift guard 4/4 green.

## Break #2 — manifest-completeness drift (manual control/command categories)

**Action:** added a fake command `{ id: 'fakeUnmanifested', ... }` to the
inline `commands` array in `EditorPage.jsx` (a manual, registry-less source),
with no matching `feature-manifest.json` entry.

**Observed:** `check-manifest-completeness.mjs` exited **1**:
`FAIL command.fakeUnmanifested discovered in source but missing from feature-manifest.json`.

**Reverted:** fake command removed; manifest-completeness exit 0.

## Why both layers are needed

- Auto-sourced categories (elements, shortcuts) self-defend: a new registry key
  auto-enters inventory → becomes a GAP → gate fails. Layer #1 (the
  element-defaults drift test) makes that failure loud at the unit level too.
- Manual categories (controls, commands, canvas ops, flows) have NO registry —
  a new ribbon button or command would never auto-enter inventory and would
  stay invisible, silently inflating "% verified" by shrinking nothing. Layer #2
  (manifest-completeness) closes that hole for all discoverable
  controls + the command array.

## Rollout state

The CI `feature-coverage-gate` job is **non-required** (warn-first). After one
observation cycle, flip to required in branch protection:

```
gh api -X PATCH repos/OWNER/REPO/branches/master/protection/required_status_checks \
  -f 'checks[][context]=Feature coverage gate (warn-first, non-required)'
```

## Allowlist staleness threshold

30 days (`STALE_DAYS` in `check-coverage-gate.mjs`). Entries older than that
WARN (not fail) so the list is reviewed each sprint and shrinks toward empty for
editor-core. Tune the constant if 30d proves too noisy or too lax.

---
title: "Upstream Oracle Approval Record"
date: 2026-05-23
status: approved
phase: 1
---

# Upstream Oracle Approval Record

## Purpose

This record is the Phase 1 hard gate for all upstream parity claims. Do not
create upstream-derived fixtures, pass/fail matrix rows, or CI parity gates until
this file is completed and signed by the named approver.

## Candidate Oracle

| Field | Value |
|---|---|
| Candidate remote URL | `https://github.com/jbirky/parallax-presentations.git` |
| Candidate branch | `upstream/main` |
| Candidate commit SHA | `ce548c535abc7701ac45cc3164560caba121adce` |
| Candidate commit date | `2026-05-15 00:21:07 -0700` |
| Candidate commit subject | `add line-arrow shape: stroke-only arrow with no fill` |
| Local remote fetch URL | `https://github.com/jbirky/parallax-presentations.git` |
| Local remote push URL | `DISABLED-PUSH-URL` |

## Candidate Verification Snapshot

Captured on `2026-05-23T09:53:20.7475650+07:00`. This is reviewer evidence
only and does not approve the candidate as the oracle.

| Check | Result |
|---|---|
| `git remote -v` | `upstream` fetch URL is `https://github.com/jbirky/parallax-presentations.git`; push URL is `DISABLED-PUSH-URL` |
| `git fetch upstream --prune` | Succeeded; discovered additional branch `upstream/saas-migration` |
| `git rev-parse upstream/main` | `ce548c535abc7701ac45cc3164560caba121adce` |
| `git show -s --format="%H%n%ci%n%s" upstream/main` | `ce548c535abc7701ac45cc3164560caba121adce`; `2026-05-15 00:21:07 -0700`; `add line-arrow shape: stroke-only arrow with no fill` |
| `git ls-remote https://github.com/jbirky/parallax-presentations.git refs/heads/main refs/heads/dev refs/heads/feature/grid-and-axis-tools` | `main` = `ce548c535abc7701ac45cc3164560caba121adce`; `dev` = `1220c59dd2d66a1a46defa5f0bbca85564078a56`; `feature/grid-and-axis-tools` = `231135f212f9cac1abb8e263d504d301f52bbd29` |
| `git rev-parse upstream/saas-migration` | `2a6e0077444e3ea1c3552c5ca0be561d1ff646a9` |

## Approval Fields

| Required field | Value |
|---|---|
| Approved remote URL | `https://github.com/jbirky/parallax-presentations.git` |
| Approved immutable commit SHA | `ce548c535abc7701ac45cc3164560caba121adce` |
| Approver name | `Xuan` |
| Approver role | `Project owner` |
| Approval date | `2026-05-23` |
| Approval evidence | User confirmed the recommended approval statement in this chat on 2026-05-23. |
| SHA change policy | After approval, this oracle SHA is immutable for the plan. Changing the SHA requires named approver signoff, a new approval date/evidence entry, regenerated upstream baseline logs, regenerated upstream-derived fixtures, and updated provenance links in the parity matrix and final report. |

## Required Approval Statement

Approved statement:

```text
I approve https://github.com/jbirky/parallax-presentations.git at immutable
commit ce548c535abc7701ac45cc3164560caba121adce as the upstream parity oracle
for plan 260523-0500-upstream-parity-verification-tdd. Any change to this SHA
requires a new approval record, regenerated upstream fixtures, regenerated
baseline report, and updated matrix provenance.
```

## Ready-To-Sign Candidate Statement

This candidate statement was accepted by the project owner on 2026-05-23. It is
kept here as provenance for the approval fields above.

```text
I approve https://github.com/jbirky/parallax-presentations.git at immutable
commit ce548c535abc7701ac45cc3164560caba121adce as the upstream parity oracle
for plan 260523-0500-upstream-parity-verification-tdd. Any change to this SHA
requires a new approval record, regenerated upstream fixtures, regenerated
baseline report, and updated matrix provenance.
```

Approved SHA change policy:

```text
After approval, this oracle SHA is immutable for the plan. Changing the SHA
requires named approver signoff, a new approval date/evidence entry,
regenerated upstream baseline logs, regenerated upstream-derived fixtures, and
updated provenance links in the parity matrix and final report.
```

## Adapter Decision

Candidate upstream does not expose the same verification tooling as the current
repo.

Design reference: `upstream-adapter-harness-design.md`.

| Capability | Current repo | Candidate upstream | Required decision |
|---|---|---|---|
| Root build command | `npm run build` | `npm run build` exists | Verify after approval in upstream worktree |
| Lint command | `npm run lint` | No root `lint` script found | Define adapter or mark unavailable |
| Unit test command | `npm test` | No root `test` script found | Define adapter or mark unavailable |
| Playwright config | `playwright.config.js` | Not found | Define external/shared smoke harness |
| Vitest config | `vitest.config.mjs` | Not found | Define external/shared assertion harness |
| E2E tests | `tests/e2e` | Not found | Define external/shared smoke harness |

## Pre-Unblock Checklist

- [x] Approved remote URL is filled.
- [x] Approved immutable commit SHA is filled.
- [x] Approver name and role are filled.
- [x] Approval date is filled.
- [x] Approval evidence is linked or summarized.
- [x] SHA change policy is filled.
- [x] Candidate branch resolution still matches the approved SHA if `upstream/main` is used for convenience.
- [x] Approved SHA resolves directly with `git rev-parse <approved-upstream-sha>`.
- [x] Upstream push URL remains disabled.
- [x] Adapter decision is recorded before upstream baseline execution.

## Unblock Rule

The pre-unblock checklist is complete. Phase 2 remains pending until
`upstream-baseline-report.md` references the approved oracle and records the
upstream baseline execution.

## Unresolved Questions

- Which adapter path should be selected after upstream setup/build evidence is recorded?

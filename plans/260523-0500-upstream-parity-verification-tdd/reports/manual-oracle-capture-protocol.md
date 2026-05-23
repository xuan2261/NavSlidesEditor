---
title: "Manual Oracle Capture Protocol"
date: 2026-05-23
status: pre-approval-protocol
phase: 2
---

# Manual Oracle Capture Protocol

## Scope Guard

This protocol prepares Path C from
`upstream-build-failure-phase-2-decision-record.md`. It is not release evidence,
does not approve Phase 2 matrix creation, and does not claim upstream parity.

Use it only if the Phase 2 decision record is approved and upstream automation
remains unavailable.

## Purpose

When approved upstream automation cannot build, manual oracle evidence may be
used for selected rows only if it captures behavior from the approved upstream
source of truth without modifying the oracle worktree.

Manual evidence is row-scoped. It cannot upgrade unrelated rows to `Pass`.

## Required Metadata

| Field | Required value |
|---|---|
| Row id | Matches `docs/upstream-parity-matrix.md` row id |
| Approved upstream remote | `https://github.com/jbirky/parallax-presentations.git` |
| Approved upstream SHA | `ce548c535abc7701ac45cc3164560caba121adce` |
| Capture owner | Named person |
| Reviewer | Named person, can be same as approver only if explicitly allowed |
| Capture date | ISO date |
| Capture environment | OS, browser, Node/npm if relevant |
| Evidence files | Screenshot, short video, notes, logs, or exported artifact |
| Behavior contract | Precondition, action, expected visible result, state/export impact |
| Edge cases | Negative paths and boundary cases checked |
| Limitations | What this evidence does not prove |

## Capture Rules

- Do not patch upstream package manifests or lockfiles.
- Do not use failed upstream build logs as `Pass` evidence.
- Do not capture from current repo and label it upstream evidence.
- Do not use real AI, cloud, GitHub, rclone, or production credentials.
- Prefer local loopback and disposable data.
- Record exact files/screens/routes/actions used.
- Capture only the row behavior under review.
- Store evidence under this plan's `reports/` subtree.

## Evidence Strength

| Evidence type | Acceptable use |
|---|---|
| Screenshot | Visual state only; not enough for persistence/export behavior |
| Short video | Interaction flow and visible result |
| Manual notes | Supplemental context; not enough alone for MVP P0 release-ready |
| Exported artifact | Export/import/render behavior if artifact is retained |
| Log file | Runtime/setup context; failed build logs prove blocker only |

## Row Evidence Template

```markdown
## Manual Oracle Evidence: <row-id>

- Row id:
- Tier:
- Security invariant: yes/no
- Approved upstream SHA:
- Capture owner:
- Reviewer:
- Capture date:
- Capture environment:
- Evidence files:
- Behavior contract:
- Preconditions:
- Actions:
- Expected visible result:
- State/persistence/export impact:
- Edge cases checked:
- Result: Pass / Fail / Blocked
- Limitations:
- Reviewer signoff:
```

## Status Rules

- `Pass`: allowed only when manual oracle evidence fully covers the row behavior
  contract and local evidence also passes.
- `Blocked`: default when upstream automation is unavailable and manual oracle
  evidence is missing or incomplete.
- `Waived`: allowed only with the full waiver contract: owner, approved by,
  approval date, expiry, rationale, user impact, rollback decision, and
  follow-up issue.
- `Unknown`: use only for non-automation uncertainty, not for known unavailable
  upstream automation.

## Unresolved Questions

- Who owns manual oracle capture?
- Can the upstream oracle approver also review manual evidence?
- Where should retained screenshots/videos/artifacts be stored long-term?

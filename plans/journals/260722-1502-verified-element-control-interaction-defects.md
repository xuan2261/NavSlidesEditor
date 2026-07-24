---
title: "Verified element controls: historical completion evidence vs stale phase state"
date: 2026-07-22 15:02 +07:00
status: completed
plan: ../archive/260709-0917-verified-element-control-interaction-defects-deep-tdd/plan.md
historical_commit: fedd2a9d
---

# Verified Element Controls: Historical Completion Evidence vs Stale Phase State

## Context

This local archive journal preserves the July 9 delivery record for the [deep-TDD plan](../archive/260709-0917-verified-element-control-interaction-defects-deep-tdd/plan.md). It addressed confirmed interaction defects caused by separate editor paths applying incompatible lock, table, search, and selection rules. The [findings matrix](../archive/260709-0917-verified-element-control-interaction-defects-deep-tdd/reports/researcher-01-verified-findings-matrix.md) deliberately excluded multi-select nudge, game renderers, and PPTX format limits after verification found them false, overstated, or intentional limits.

## What happened

Commit `fedd2a9d` (`fix(editor): align cut/lock, preserve table merges, extend find-replace`, 2026-07-09) changed the planned editor surfaces and added [the consolidated regression harness](../../client/src/verified-element-control-defects.repro.test.js). Its commit record covers cut/lock parity, preservation of valid table merges, table-cell find/replace, blocked-action feedback, 40px callout defaults, and mixed-opacity feedback. The contemporaneous [completion journal](../../docs/journals/2026-07-09-verified-element-control-interaction-defects-deep-tdd.md) records passing phase suites: **9 files / 107 tests**.

## Impact

At that commit, Cut was intended to skip locked members rather than delete protected content; table shape edits retained in-bounds merges instead of clearing all metadata; and table cells became searchable and replaceable. The focused harness names the durable contracts for cut/duplicate parity, append-safe merge preservation, table-data replacement, callout minimum size, and blocked-action copy. This is point-in-time evidence, not a claim that the current checkout has been freshly validated.

## Decisions

- Chose lock parity across Cut, Delete, and Duplicate over aborting a mixed selection or allowing Cut to bypass locks.
- Chose preserve-valid merges over wipe-all; invalid out-of-bounds merges still drop rather than producing broken spans.
- Chose table cells only for find/replace, rejecting chart, game, QR, and timeline expansion.
- Chose a minimal accessible notice and 40px callout default, rejecting a toast dependency and a callout-only minimum-size exception.

## Concerns / limitations

The repository’s completion signals conflict. The plan frontmatter and its six-row phase table say `completed`, while every phase frontmatter remains `pending` and every phase success/VERIFY checkbox is unchecked. Consequently, `ak plan` reports **0%**. The evidence does not establish whether the phase metadata was never advanced or completion was marked prematurely; it only establishes that the two records disagree.

The 107-test statement is historical journal evidence, not retained command output. No fresh test or lint command was run for this archival note. Later history also changed overlapping `EditorPage.jsx` and `docs/code-standards.md`, so the July 9 result cannot certify current behavior.

## Next

Owner: repository maintainer / archival coordinator, 2026-07-22. Archive the plan and its reports intact after the journal batch completes, retaining these future archive links. If phase metadata needs repair, do it as a separate evidence-backed maintenance decision; do not silently convert unchecked phase gates into proof of execution.

## Unresolved questions

- Did the July 9 delivery run the Phase 6 `npm run test` and `npm run lint` gates? The reviewed materials retain no command output for them.
- Were the pending phase markers simply left stale, or was plan-level completion applied before all recorded gates finished? Current repository evidence cannot answer that.

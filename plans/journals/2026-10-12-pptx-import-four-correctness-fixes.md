---
title: PPTX import correctness fixes with TDD
date: 2026-10-12
summary: Fixed authored slide order, percentage crop, group reflection and durable successor visibility; retained fail-closed authority and unrelated failures.
---

# PPTX import correctness fixes with TDD

## Scope and causes

The user requested the four confirmed Import PPTX fixes with `--tdd --advice`.
Kongming was attempted but is not a loaded agent in this runtime. No substituted
advisory assessment is claimed. An independent read-only review found no actionable
defects, and identified namespace/sparse-numbering and rendered-reflection gaps.
Those gaps received additional source-order regressions and real browser checks.

- The installed parser sorts slide content-type entries numerically. Its output
  now follows relationship-bound authored order before mapping. Scene graph,
  coverage inventory, native layout, animation and source-map consumers agree.
- Parser crops are percentages, including values below 1. The mapper now divides
  by 100 rather than inferring units from magnitude.
- Group transforms apply local reflections before rotation. Nested orientation
  combines XOR flips and reflection-aware rotation; line endpoints are not flipped
  a second time.
- Status recovery can recognize a server-owned saved successor with a matching
  import receipt and retained original-head hash. Commit and rollback continue
  requiring the exact original head. Legacy authority without retained proof is
  not promoted from generation alone.

## TDD and verification

Expected-red runs reproduced reversed slide order, 0.5% interpreted as 50% crop,
12 reflection failures and durable GET returning `pending-visibility` after two
saves/restart. Additional namespace tests failed on a foreign list and a
relationship namespace alias before correction.

The initial crop test exceeded the canvas bounds and made two valid crops fail.
The fixture was reduced to an in-bounds 144-pixel picture before repair; the
remaining expected-red failure was `expected 0.5 to be 0.005`.

Final affected run: 40 files / 391 tests passed. A subsequent visibility run
passed all 11 tests, including the added legacy-authority fence. Focused ESLint
ran with `--max-warnings=0` and passed. Production build and repository lint
returned exit 0; repository lint still reports 263 existing warnings. Scoped
`git diff --check` passed. Language-server diagnostics were unavailable because
`typescript-language-server` is not installed.

Broader importer verification passed 1,798 tests with two platform skips and
three failures in the untracked `paragraph-point-space.test.js`. That test calls
the unchanged paragraph module directly and reproduces all three failures in
isolation. Two portable replacement tests in
`validated-edited-export-materialization.test.js` fail with `expected 2 to be 1`;
both still fail when the new import-head metadata assignment is removed. Neither
unrelated behavior was edited or suppressed.

Two old crop fixtures used raw tenths-of-percent rather than parser percentages;
their inputs were corrected while their assertions were preserved. The old
reflected nested-group assertion was updated from 15 to the mathematically
required 45 degrees. A native resolver regression initially skipped an existing
read-failure fixture; restoring the presentation-absent lookup contract fixed
it without weakening the test.

## Actual surface evidence and limits

Used isolated temporary data/uploads and a production server on port 3317.
Dashboard file-input import opened the editor with SECOND before FIRST. An
asymmetric RGB picture rendered blue/green/red after group reflection; stored
crop metadata was 0.005 and the image was not magnified by a 50% crop.
Desktop 1440x1000, mobile 390x844 and editor reload were inspected. The
53,381-byte Original PPTX download matched the supplied bytes exactly.
The final source was re-imported after the namespace correction.

The smoke harness initially started the server with `node -e`, whose exec
arguments were inherited by the parser. It was replaced with the real
`server/index.js` entrypoint. Inherited `NODE_OPTIONS` disabled require-ESM in
the host; checks ran with that flag removed from child environments.

This is application correctness evidence, not PowerPoint numerical 1:1
qualification. No full-corpus pixel gate, OfficeCLI, Electron, Linux or Docker
qualification was claimed. Generic downstream shape-reflection rendering remains
outside these picture fixes. Existing workspace changes were preserved.
No commit, push or publication was authorized. AgentWiki publish skipped.

---
phase: 1
title: "Baseline Scope And Gates"
status: pending
priority: P1
effort: "1-2d"
dependencies: []
---

# Phase 1: Baseline Scope And Gates

## Context Links

- Source: `plans/reports/brainstorm-260426-1740-deep-feature-synthesis.md`
- Source: `plans/reports/debug-260426-2125-deep-feature-synthesis-audit.md`
- Docs: `README.md`, `docs/code-standards.md`, `docs/system-architecture.md`, `docs/project-roadmap.md`
- Related completed plan: `plans/260426-2128-pptx-import-coordinate-fidelity-hardening/plan.md`

## Overview

Create a verified baseline before touching code. This prevents repeating stale
assumptions from the brainstorm report, especially around PPTX charts and
SmartArt.

## Key Insights

- `SlideCanvas.jsx` is 2759 LOC and still owns commands, rendering, chrome, and interaction.
- `EditorPage.jsx` is 1662 LOC and still owns global shortcut handling.
- `use-keyboard.js` and `use-clipboard.js` exist, but `SlideCanvas.jsx` duplicates clipboard/key paths.
- PPTX charts and diagram flattening already exist; Phase E is corpus/gates/metadata work.
- PDF import is visual-only raster via `pdfjs-dist`.
- Analytics persists share-link views only, not live session navigation.

## Requirements

- Functional: collect current file metrics, current test status, and exact scope gates.
- Functional: classify each synthesis feature as `do`, `validate`, `spike`, `defer`, or `skip`.
- Non-functional: no source changes in this phase except optional docs notes.
- Non-functional: preserve product identity: self-hostable, no account, no cloud, no tracking.

## Architecture

This is a governance phase. Output is a trusted baseline for later code phases:

```text
reports + docs + code scan
  -> corrected decision matrix
  -> baseline test commands
  -> go/no-go gates per phase
```

## Related Code Files

- Read: `client/src/components/SlideCanvas.jsx`
- Read: `client/src/pages/EditorPage.jsx`
- Read: `client/src/hooks/use-keyboard.js`
- Read: `client/src/hooks/use-clipboard.js`
- Read: `server/services/pptx-import/mapper.js`
- Read: `server/services/pptx-import/chart-output-to-navslides-mapper.js`
- Read: `client/src/utils/pdf-import.js`
- Read: `server/routes/analytics.js`
- Read: `server/services/socket-handler.js`
- Modify: none expected
- Create: none expected
- Delete: none

## Implementation Steps

1. Run `git status --short` and record unrelated dirty files before edits.
2. Record LOC for `SlideCanvas.jsx`, `EditorPage.jsx`, command hooks, analytics, and PDF import.
3. Run baseline unit tests from the audit report.
4. Run current PPTX corpus gate with strict production round-trip validation.
5. Run `npm run lint` and `npm run build` to catch syntax/build drift.
6. Confirm all existing plan directories relevant to PPTX/canvas are completed.
7. Freeze corrected priority order: command layer -> canvas decomposition -> shortcuts/PPTX -> gated spikes.

## Todo List

- [ ] Capture git status and test baseline in implementation notes.
- [ ] Confirm no unfinished plan blocks this roadmap.
- [ ] Confirm PPTX chart work is not greenfield parser work.
- [ ] Confirm first canvas success target is `<=1200 LOC`.
- [ ] Confirm skip/defer list is not implemented under this plan.

## Verification & Tests

Run before Phase 2:

```bash
npm run test -- server/services/pptx-import/mapper.test.js server/services/pptx-import/pptx-import-e2e-flow.test.js server/services/pptx-import/roundtrip-matching.test.js client/src/hooks/use-keyboard.test.js client/src/utils/pdf-import.test.js server/services/socket-handler.test.js
npm run test:corpus
npm run lint
npm run build
```

If a baseline command fails, stop and decide whether it is unrelated existing
breakage or must be fixed before Phase 2.

## Success Criteria

- [ ] Baseline commands and failures are known before implementation.
- [ ] Scope table is accepted: no MCP, no realtime collab, no full TS migration.
- [ ] Later phases have exact test gates and file ownership.
- [ ] No code behavior changed in this phase.

## Risk Assessment

- Risk: existing unrelated failures consume plan execution time.
- Mitigation: record failure owner and do not hide failing tests.
- Risk: broad roadmap becomes too large.
- Mitigation: gated P2 phases can stop after validation/spike without full build.

## Security Considerations

- Keep analytics work gated by privacy rules before adding event persistence.
- Keep HTML embed trust policy unchanged.
- Do not add dependencies before a phase-specific security review.

## Next Steps

Proceed to Phase 2 only after baseline is understood.

## Unresolved Questions

- None for baseline execution.

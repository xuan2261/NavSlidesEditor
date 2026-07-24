---
title: "PPTX import gates and parser coverage completed"
date: "2026-07-22 14:17 Asia/Saigon"
status: complete
plan: "../archive/260617-0815-pptx-import-gates-and-parser-coverage-tdd/plan.md"
commit: a36914c494caa6e13e64e613639730094bc9304c
---

# PPTX Import Gates and Parser Coverage

## Context

This records the completed [PPTX import gates and parser coverage plan](../archive/260617-0815-pptx-import-gates-and-parser-coverage-tdd/plan.md), implemented in `a36914c4` on 2026-06-17. The job was deliberately narrow: stop strict-gate drift, make the default strict browser check practical, and expose chart/SmartArt loss honestly without pretending the importer had native object support.

## What happened

The original state was bad in a very specific way: code enforced a `50%` aggregate production round-trip floor while the CLI reported `99%`, and documentation mixed `98%`, `99%`, and `50%`. The implementation centralized the contract as `STRICT_CORPUS_GATES` in [the corpus harness](../../server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js); it now drives the CLI message, baseline metadata, per-deck defaults, and docs contract. The active aggregate gates are semantic `>= 98%` and round-trip `>= 50%`.

Next, [the package script](../../package.json) changed `test:pptx:strict` from corpus plus the full audit to corpus plus the existing smoke audit. The full and headed full commands remain explicit. The phase draft proposed a launcher refactor, but the existing launcher already accepted scope; changing the script and locking it with a contract test was the smaller correct fix.

Finally, [the OOXML inspector](../../server/services/pptx-import/ooxml-inspection.js) scans slide relationship parts for chart and SmartArt evidence. [The mapper](../../server/services/pptx-import/mapper/map-presentation.js) compares that evidence to emitted native elements, then adds per-slide and aggregate `nativeObjectCoverage` stats plus degradation warnings. [The importer boundary](../../server/services/pptx-import/importer.js) now preserves those additive fields instead of silently dropping them.

## Impact

A green strict corpus result can no longer claim a fictional `99%` round-trip threshold. `test:pptx:strict` is useful as a smoke gate, while the expensive full audit remains a deliberate release signoff.

Import consumers can now distinguish “the package contained native evidence” from “the mapper emitted a native object.” This is a meaningful diagnostic improvement, not a fidelity fix. The annoying truth is that SmartArt is still flattened, so a warning is often the expected, honest result rather than a new regression.

## Decisions

- Retained the already-enforced `50%` production round-trip floor and corrected stale `99%` prose, rather than tightening behavior based on historical documentation alone.
- Reused the existing smoke/full scope mechanism instead of refactoring the audit launcher without a behavior need.
- Reported relationship evidence additively instead of rewriting `pptxtojson` or inventing native SmartArt rendering. Unreferenced package parts are ignored and duplicate targets are deduplicated per slide.

## Concerns / limitations

- Evidence counts are relationship/slide evidence entries, not proof of exact native-object reconstruction. Native chart and SmartArt editing/rendering remain parser work outside this plan.
- The plan marks targeted Vitest slices, `npm run test:corpus`, `npm run test:pptx:strict`, and `npm run test:pptx:browser-audit:full` complete. No retained command transcript or CI artifact accompanies the commit, and the final reviewer re-check was rate-limited. Completion therefore rests on the recorded local validation and resolved first-review findings, not a reproducible transcript.
- Unresolved concern: before relying on these gates for a release, rerun the full command ladder and retain its output.

## Next

- Archive coordinator: archive the completed plan after journal review; do not treat this journal as a native-object support claim.
- PPTX maintainers: before the next release or threshold change, rerun the targeted tests, corpus, strict smoke, and full browser audit; save durable validation output with the release evidence.
- AgentWiki publishing was skipped: external sharing was not authorized.

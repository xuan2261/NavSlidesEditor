---
title: Source-faithful residual fidelity repair
date: 2026-10-11
summary: Preserved source table and paragraph semantics; frozen PowerPoint corpus gate remains failed; no release or publication authority inferred.
---

# Source-faithful residual fidelity repair

Preserved source table and paragraph semantics; frozen PowerPoint corpus gate remains failed; no release or publication authority inferred.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

## Root cause and change

The table mapper discarded parser-rich cell typography, missed the parser's `up` alignment vocabulary and omitted source insets. Collapsed borders also exceeded the clipped authored wrapper. Shared inset/border rules now preserve source metrics without changing global overflow.

Source paragraph tabs were replaced before projection, indent/tab-stop metadata was absent and adjacent spacing collapsed. The repair preserves source whitespace and paragraph layout. Independent review additionally found a TipTap mutation feedback loop, merged adjacent tab marks and rotation-dependent measurements; independent tab atoms, style-only mutation handling and untransformed zero-height spacers address them. A real browser probe found CSS transitions distorted synchronous width reads; tab spacers explicitly disable transitions.

## Decisions and limits

Preserve cached date text and malformed source media; do not invent clock substitution or a PowerPoint black-image fallback. Preserve all source/golden hashes and the 0.99 mean / 0.97 minimum oracle. The bounded receipt is diagnostic working-tree evidence, not release authority.

## Evidence and next step

See [the repair record](../261009-0901-navslides-full-reliability-deep-tdd/reports/261011-residual-fidelity-remediation.json) for observed checks, actual browser/HTTP proof, final identities, retained failed attempts and the full fixed-corpus comparison. Diagnose the largest remaining paired-image divergences before proposing another renderer change. Linux/container, exact-subject role receipts and protected signing/download/attestation remain separate requirements. AgentWiki publish skipped.


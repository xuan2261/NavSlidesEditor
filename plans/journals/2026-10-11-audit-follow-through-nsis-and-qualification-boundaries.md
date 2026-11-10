---
title: Audit follow-through NSIS and qualification boundaries
date: 2026-10-11
summary: "Isolated NSIS native tools, restored locked OCR dependencies, corrected Node and PowerPoint findings; release qualification remains open."
---

# Audit follow-through NSIS and qualification boundaries

## Outcome
User-authorized cook --tdd --advice recommendation repairs, with independent implementation/review and advisory checkpoints. No commit, push, publish, signing or gate reduction.

## Root causes and changes
- Supported Node defaults enable synchronous require(ESM). The inherited opt-out produced the marked error; parser dependencies and synchronous APIs remain unchanged. Chromium rendered sanitized Markdown successfully.
- The locked Windows NSIS engine requires 7z.dll beside its executable. education-nsis-tool.mjs stages both under a unique temporary lifetime, awaits the callback, cleans success/rejection, and leaves node_modules aliases unchanged. Direct callers migrated without compatibility re-exports.
- Exact locked OCR/QR packages restored with scripts disabled; six manifest/lock checksums unchanged. Full Playwright collection: 1067 tests, no collection errors.
- First focused GREEN attempt timed out in newly added deep Buffer equality. Counsel identified assertion cost; SHA-256 comparison retained byte equality without increasing the deadline. Focused rerun: 114/114 across nine files.

## Evidence
- Final production build and runtime closure passed, subject d20f0688907e91639dd3d5e78d729f8e743737cbbcc41261f243c934b2f9c97f.
- Five real PDF/PPTX word-search, QR decoding and visible chart-label journeys passed on the final production build, one worker, no retries/skips/flakes.
- Whole repository lint: zero errors, 263 warnings. Documentation facts verification passed.
- Genuine native NSIS codec smoke proved matching executable/DLL bytes, staging cleanup and unchanged vendor aliases. Independent scoped review found no blocker.
- Final whole-suite coverage subsequently passed: 6,887 tests passed, zero failed, three platform-skipped out of 6,890; inventory 837 files. Coverage S/B/F/L: 78.54%/70.92%/77.99%/80.99%. Declared subject before/after remained unchanged. The skipped POSIX secret-mode, SIGTERM escalation and PID-reuse checks are not physical qualification; full E2E/performance/release gates remain open.
- Reports and full limits: ../261009-0901-navslides-full-reliability-deep-tdd/reports/cook-recommendations-result.json.

## Qualification boundaries
PowerPoint 16 COM physically created/rendered/saved/reopened a disposable deck; the old absent-Office inference is withdrawn. This is not fixed-corpus fidelity. No Linux daemon/WSL/SSH target is provisioned. OfficeCLI PATH bytes do not match the reviewed pin; matching backup bytes still lack independent acquisition/exact-clean-subject authority. Protected signing/verifier and independent download/attestation inputs are unprovisioned. No global .NET or module-path installation was attempted. Phase checklists and full-program acceptance remain open.

## Next prerequisites
Provision authorized Linux/scanner inputs; obtain an independently recorded OfficeCLI acquisition and clean reviewed subject; produce real 11-deck Office goldens/role receipts; provision protected signing and independent verification. Do not transplant collection or focused totals into full-suite/release acceptance.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

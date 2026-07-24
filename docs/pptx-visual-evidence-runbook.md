# PPTX PowerPoint visual-evidence runbook

This runbook defines the controlled local procedure for the PPTX visual oracle. It
is an environment-bounded evidence workflow, not an independent attestation or a
claim of universal PowerPoint compatibility.

## Authority and prerequisites

- Microsoft PowerPoint is the only authoritative golden renderer.
- LibreOffice, repository snapshots, and NavSlides self-snapshots are diagnostic
  or editor-regression evidence only; they cannot satisfy the oracle gate.
- Start from the exact corpus and checked-in importer manifest:
  `server/data/test-corpus/importer-qualification-manifest.json`.
  Do not add, remove, rename, or substitute a deck. Recompute source hashes and
  the manifest digest before accepting a bundle.
- The capture host must record non-secret digests for Windows, Office/build,
  fonts, locale, DPI, viewport, crop/letterbox, and resampling policy. Do not
  commit usernames, absolute paths, machine identifiers, or credentials.
- Use a temporary loopback server/data directory for package-backed actuals.
  The capture client must import through HTTP, poll the job, read the
  authoritative presentation, verify `/pptx-original`, capture every Reveal
  slide by index, and permanently delete the imported presentation in cleanup.

## External PowerPoint golden bundle

Keep the PNG bundle outside the repository unless a review explicitly requires
otherwise. The bundle contains:

```text
golden-bundle/
  golden-manifest.json
  goldens/<deck-stem>/slide-0.png
  goldens/<deck-stem>/slide-1.png
  ...
```

The manifest must contain schema version `1`, authority/renderer
`Microsoft PowerPoint`, Office version and build, environment digests, the exact
corpus manifest digest, and one entry for each of the 11 source decks. Each deck
entry records the exact source filename, SHA-256, byte length, OOXML slide count,
and a contiguous `slide-0.png` through `slide-N.png` inventory. Every image
entry records SHA-256, byte length, and decoded dimensions. The validator rejects
missing/extra/duplicate decks, source hash drift, gaps, extra images, malformed
PNGs, and 8×8 placeholder images.

## Local evidence envelope and receipts

A claim-capable run also needs a local evidence manifest and exactly three role
receipts for the same subject:

- `app-storage`
- `security`
- `release`

The manifest binds the corpus, golden, package-backed actual, fresh comparison
result, application artifact hashes, environment digests, fixed `phase08_full`
policy, and execution/result digests. Its four visual artifact aliases (`corpus`,
`golden`, `actual`, `result`) must resolve to the hashed artifact files beside the
manifest. Receipts must bind the same subject hash, execution digest, result
digest, authorization policy hash, and publication window. Missing, mixed, stale,
or unapproved receipts are integrity blockers.

## Capture and gate commands

Capture requires an isolated loopback base URL and the exact corpus manifest. It
writes package-backed actual PNGs and an actual manifest under a published run
directory, then permanently cleans up each imported presentation. Do not pass
`--actual-manifest-out` — the CLI rejects path overrides; the published run dir
always contains `actual-manifest.json` next to the captured deck PNGs.

```bash
npm run test:pptx:oracle:capture -- \
  --base-url http://127.0.0.1:3202 \
  --corpus-manifest server/data/test-corpus/importer-qualification-manifest.json \
  --actuals-dir plans/reports/pptx-oracle-runs/actuals
# Published under --actuals-dir as run-<stamp>/actual-manifest.json + deck PNGs
```

Run the non-skippable integrity gate with the local envelope and receipts:

```bash
npm run test:pptx:oracle:integrity -- \
  --evidence-manifest <local-evidence-manifest.json> \
  --role-receipts <role-receipts.json> \
  --goldens-dir <goldens-dir> \
  --actuals-dir <actuals-dir>
```

Run qualification with the same evidence. The gate always uses the fixed
`phase08_full` policy (mean SSIM `>= 0.99`, every slide SSIM `>= 0.97`); candidate
threshold arguments, debt records, `PPTX_ORACLE=off`, null policy, and incomplete
or untrusted evidence cannot turn a run into a pass:

```bash
npm run test:pptx:oracle:qualify -- \
  --evidence-manifest <local-evidence-manifest.json> \
  --role-receipts <role-receipts.json> \
  --goldens-dir <goldens-dir> \
  --actuals-dir <actuals-dir>
```

Integrity may pass with trusted finite below-policy scores; qualification then
returns non-zero and the report preserves both verdicts. Missing physical
PowerPoint evidence must remain blocked. Never seed, regenerate, or relabel a
repository placeholder as a golden.

## Editor regression is separate

`tests/e2e/pptx-import-editor-visual-regression.spec.js` checks repeatable
NavSlides editor-canvas rendering only. Its snapshots are not PowerPoint
visual-fidelity evidence and must not be used to satisfy either oracle gate.

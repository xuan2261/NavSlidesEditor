# OfficeCLI Qualification Findings

## Candidate

- Upstream: `https://github.com/iOfficeAI/OfficeCLI`
- License: Apache-2.0
- Researched release: `v1.0.135`
- Local executable: `C:\Users\Z10PAD8C_Xuan2261\AppData\Local\OfficeCli\officecli.exe`
- Observed local SHA-256: `937DB176B585E874AA5BFF48D536BCE78037665CD862B5DEEFE56E79977E6588`

The production manifest must recompute and verify the selected official asset. The observed hash is research evidence, not sufficient supply-chain proof.

## Useful Capabilities

- Structured inspection through `get`, `query`, `dump`, and `batch`.
- Raw part inspection and narrowly scoped mutation through `raw`/`raw-set`.
- Part creation through `add-part`.
- Package validation.
- HTML/SVG/PNG rendering and transport to native rendering paths.
- Coverage for slides, shapes, groups, tables, charts, layouts, masters, themes, transitions, animations, media, OLE, 3D, and Zoom varies by command and must be fixture-qualified.

## Appropriate NavSlides Roles

- Secondary structured package inspector.
- Differential/shadow inventory source.
- Allowlisted patch backend for operations with proven package drift.
- Additional package validator.
- Renderer transport when Microsoft PowerPoint is the actual rendering provider.

## Inappropriate Roles

- Sole PPTX importer or semantic authority.
- Sole package validator.
- Fidelity oracle.
- Arbitrary user-controlled CLI service.
- Runtime self-updating dependency.
- Resident/watch process in the initial integration.
- Automatic chart/workbook synchronization authority.

## Process Contract

- Direct `spawn`, `shell: false`, absolute verified binary path.
- `OFFICECLI_NO_AUTO_RESIDENT=1`.
- `OFFICECLI_SKIP_UPDATE=1`.
- Private per-job directory and allowlisted environment.
- Bounded stdin/stdout/stderr, wall/idle time, temp disk, queue, and concurrency.
- Full process-tree kill on timeout/cancel/shutdown.
- `batch --stop-on-error` for reviewed batches.
- Typed domain operations only.
- ZIP/OPC/native validation after mutations.

## Distribution Requirements

- Exact repository, tag, asset name/URL, size, SHA-256, license, notices, and supported target.
- No runtime download or PATH fallback.
- Docker image stages verified Linux asset only if qualified.
- Electron `extraResources` stages verified per-platform assets and legal notices.
- Packaging smoke recomputes hash from the final artifact.
- Unsupported targets report capability disabled and retain original recovery.
- Upgrade requires the full compatibility/drift suite and rollback.

## Qualification Gaps

- Binary signing/provenance acceptance.
- Exact output/exit behavior across Windows/Linux fixtures.
- No-op and mutation collateral ZIP/XML drift.
- Resource envelope for large/hostile decks.
- OS containment and egress controls.
- Electron macOS/Linux release scope.
- Behavior of malformed output, hangs, child processes, and output flooding.
- Rendering provider lineage and font determinism.

## Recommendation

Proceed only with a pinned one-shot gateway after Phase 2 qualification. Keep native OOXML inventory and patch adapters for operations where OfficeCLI rewrites unrelated content, cannot synchronize dependent parts, or lacks stable semantics.

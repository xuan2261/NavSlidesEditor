# Architecture Findings

## Current State

- Import path: `pptxtojson` plus supplemental OOXML parsing, scene graph, mapping, and reconciliation.
- `original-package.js` preserves uploaded bytes and enables exact download while the presentation is unedited.
- `_pptxEdited` is whole-deck dirty state. Once set, export reconstructs through hybrid/PptxGenJS paths and can lose package features.
- Existing native work covers package inventory foundations, scene graph, theme/layout/chart/diagram prototypes, import jobs, corpus tests, and visual oracle utilities.
- Current final SLA correctly returns `productOneToOneClaimAllowed: false`.

## Primary Fidelity Gaps

- Group/SmartArt flattening and heuristic source reconciliation.
- Limited native shapes/charts and chart-type coercion.
- Text layout heuristics and inconsistent geometry units.
- Incomplete master/layout/theme inheritance.
- Incomplete transitions, animation timing trees, notes, hidden slides, and show settings.
- Fixed 960x540 projection assumptions.
- Regenerated package cannot preserve unknown relationships/extensions reliably.
- Existing visual goldens are 8x8/debt placeholders and do not prove PowerPoint fidelity.

## Chosen Architecture

Use four linked representations:

1. Immutable original package for exact recovery.
2. Immutable content-addressed working revisions for edited packages.
3. Editable NavSlides projection for supported editor behavior.
4. Server-owned source map and mutation journal linking projection changes to package parts.

OfficeCLI augments native OOXML work. It does not replace package inventory, security guards, source identity, native re-import, or PowerPoint evidence.

## Required Invariants

- Original SHA-256 never changes.
- No-edit export is byte-identical.
- Every revision is immutable and becomes reachable through one lock-scoped WAL/state-root metadata transaction after generation and fencing checks.
- Client metadata never authorizes package mutation.
- Ambiguous identity blocks patching.
- Empty/net-zero journal causes no mutation.
- Patch failure cannot replace the current valid head.
- Touched-part closure is explicit; unrelated content remains byte-identical or has reviewed canonicalization evidence.
- Unknown/active content is preserved without execution.
- Claim evidence is per claim and references an exact subject over package, projection, source-map, journal, feature-matrix, and policy versions.

## Reuse Versus Replace

### Reuse and harden

- Import job orchestration and cancellation.
- Original-byte persistence and exact download.
- ZIP/package guards.
- Scene graph, mappers, theme/layout/chart/diagram parsers.
- Corpus fixtures, semantic checks, SSIM utilities, and present-mode capture.

### Replace or refactor

- UUID package ownership into content-addressed blobs plus owner references.
- `_pptxEdited` into server-derived granular mutation journals.
- `slideIndex:nodeId` patch authority into stable part/native identity.
- Static SLA evidence consumption into fresh composite evidence.
- Implicit client/server export branching into explicit authoritative surfaces.
- Whole-package reconstruction for supported edits into transactional part-aware patching.

## Major Technical Decisions

- Server package-first export is authoritative.
- Native XML and qualified OfficeCLI adapters coexist behind domain patch contracts.
- Generic `raw-set` and arbitrary CLI passthrough are prohibited.
- PowerPoint-rendered goldens are mandatory for PowerPoint-specific claims.
- One concurrent OfficeCLI import/mutation per host is the initial safe default.
- Active content and external relationships are never executed/fetched.
- Unsupported content receives a tested editability tier, not silent fallback claims.

## Open Product Decisions

- Supported PowerPoint/Windows/font provider matrix and visual thresholds.
- Whether OfficeCLI is bundled or administrator-installed per target.
- Linux edited-package support if no qualified mutation asset exists.
- Revision retention, quotas, backup, sync, and garbage collection.
- Chart workbook/cache authority.
- Exact SmartArt/equation/media/OLE/3D editability requirements.
- Hidden slide behavior in PDF and present modes.
- Rich notes representation.
- Signature and macro-enabled package export policy.

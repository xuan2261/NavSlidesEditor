---
phase: 5
title: "Import Diagnostics And User Experience"
status: completed
priority: P1/P2
effort: "4-7d"
dependencies: [2, 3, 4]
---

# Phase 5: Import Diagnostics And User Experience

## Overview

Complete the bounded import-report and status surface while respecting server authority and export trust boundaries. The delivered core preserves an editor-only report, typed wait/visibility outcomes, and external DTO redaction without a broad editor redesign. Explicit dashboard Cancel/countdown controls remain residual work and are not represented as delivered UX.

> **Reconciliation note — 2026-07-28:** The original detailed matrices remain execution context. The completion checklist and residuals below are the authoritative closeout record.

## Requirements

- Functional: an imported presentation editor can load a bounded `_pptxImportReport` after `onOpen`, navigation, and reload.
- Functional: server-owned report categories distinguish preserved/read-only, native-unsupported, chart-preserved, SmartArt-preserved, approximated, placeholder, failed, budget-omitted, and other.
- Functional: raw server `byType` is diagnostic authority but is capped/sanitized; client summary is an adapter, not a second source of truth.
- Functional: editor report DTO excludes capabilities, job IDs, presentation/revision/head IDs, source ZIP entry names, paths, raw child stderr, URLs, and token-like values.
- Functional: external/export DTOs used by GitHub, sync, and package export omit editor-only diagnostics by default or use stable aggregate codes/counts only.
- Functional: progress remains monotonic and truthful; status UI distinguishes cancelled, too-late/done, pending-visibility, reconcile-required, unknown, failed, and completed.
- Functional: active import UI has accessible stage/percent, Retry-After countdown, Cancel, and bounded recovery actions without late updates after unmount.
- Non-functional: preserve editor canvas/ribbon layout and avoid broad `EditorPage` refactor.

## Architecture

```text
Phase-3 authoritative GET/job DTO
  -> editor-only bounded report/status adapter
  -> Home import status + editor report panel

presentation save/export/GitHub/sync
  -> external DTO without operational report identifiers/raw diagnostics
```

The report is metadata, not editable presentation content. It is server-owned, sanitized at the server boundary, and loaded from authoritative presentation/package data. A legacy presentation with no report renders neutral/unavailable state, never a fabricated clean report.

## Related Code Files

| Action | File/area | Change |
|---|---|---|
| Modify | `client/src/utils/pptx-import-summary.js` | Stable category mapping and bounded display model |
| Create | `client/src/components/pptx-import-report-panel.jsx` | Small accessible report/status panel |
| Modify | `client/src/pages/EditorPage.jsx` or editor report hook/controller | Load editor-only report for eligible imported presentations |
| Modify | `client/src/pages/HomePage.jsx` only for Phase 2 status handoff | Reuse typed status model; no unrelated refactor |
| Modify/test | `server/services/pptx-import/import-report.js` and DTO/sanitizer consumers | Bounded editor/external report boundary |
| Test | `server/routes/github.js`, `server/routes/sync.js`, external DTO tests | Prove reports/IDs/raw diagnostics do not publish |
| Create | `client/src/components/pptx-import-report-panel.test.jsx`, `client/src/pages/EditorPage.pptx-import-report.test.jsx` | Navigation/reload/category/accessibility behavior |

## Implementation Steps

1. Write characterization tests showing Home-local summary disappears after navigation and report data currently crosses external DTO boundaries.
2. Define bounded editor report DTO from the Phase 3 authoritative GET; reject client-supplied report metadata on save.
3. Define external DTO projection: stable codes/counts/omitted count only; omit report/job/authority identifiers and raw diagnostic strings by default.
4. Add a discoverable collapsed report panel that does not cover the canvas or change normal editing flow.
5. Map current warning families to preserved/read-only, native-unsupported, chart-preserved, SmartArt-preserved, approximated, placeholder, failed, budget-omitted, and other. Unknown types remain visible only as sanitized `other` labels.
6. Render stage/percent and typed terminal states from Phase 2/3; consume the job-manager monotonic invariant rather than reimplementing it in UI.
7. Add counts, `omittedCount`, severity/category labels, and safe truncation. Never render raw HTML or unsanitized paths/stderr.
8. Verify legacy presentations and pending-visibility/reconcile-required states show neutral/recovery UI, not success.
9. Keep Home notice concise and link/point to editor report; do not duplicate the full warning list.
10. Add unmount/ownership tests covering no setState/onOpen/toast after wait settlement.

## Tests Before

- Home warning state disappears after navigation.
- Chart/SmartArt/native warnings collapse into `other` under current mapping.
- Progress can emit 80 then 70.
- Editor GET has no report panel/source contract.
- External GitHub/sync DTO can retain `_pptxImportReport`, job ID, or source names.

## Tests After

- Imported presentation reload shows the same bounded editor report.
- Legacy presentation has no misleading clean report.
- A clean report with `warningCount=0` and a `statsDigest` does not render a warning notice or fabricate details.
- Native degradation categories are explicit and counts stable.
- Warning list/type keys/serialized report are capped and omitted count is shown.
- External DTO tests prove no job/authority IDs, source names, paths, stderr, URLs, or secret-like values.
- Progress/status sequence is monotonic and terminal states are truthful.
- Cancel/countdown/unknown/pending/reconcile states are keyboard accessible and do not navigate late.

## Completion Checklist — reconciled 2026-07-28

- [x] Eligible imported presentations expose a bounded server-owned report for the editor surface; legacy/no-report states remain neutral.
- [x] Editor diagnostics and external/export projections are separate, with raw operational detail excluded from the latter.
- [x] Stable warning categories, bounded detail, omitted counts, and safe fallback categorization are part of the report model.
- [x] Pending visibility, repair-required, failure, cancellation, and unknown outcomes do not render as success.
- [x] Client ownership guards prevent late report/open effects and client saves do not author server import-report metadata.
- [ ] Explicit dashboard Cancel/countdown controls remain deferred and no broad editor-page redesign is claimed.

## Test Scenario Matrix

| State | UI expectation |
|---|---|
| Import complete with warnings | Concise Home notice + editor report |
| Import complete without warnings | Neutral clean state; no fabricated report |
| Pending visibility | No openable ID/report success; recovery status |
| Timeout/unknown | Manual status/recovery action; no success claim |
| Cancel before publication | Cancelled status; no generic failure toast |
| Too-late after visibility | Done/too-late; deck remains available |
| Legacy presentation | No fabricated PPTX report |
| Native chart/SmartArt degradation | Explicit category, not generic other |
| Large warning set | Bounded list + omitted count |
| Progress 80 → 70 source events | UI remains monotonic |
| GitHub/sync/export | No raw import report/operational identifiers |

## Regression Gate

```bash
npx vitest run client/src/utils/pptx-import-summary.test.js client/src/pages/HomePage.pptx-import-lifecycle.test.jsx server/services/pptx-import/import-report.test.js server/routes/sync.test.js server/services/pptx-import/export-security-preflight.test.js
npx playwright test --workers=1 tests/e2e/pptx-import-async.spec.js tests/e2e/critical-pptx-journey.spec.js
```

If a named UI/report suite does not yet exist, create it in this phase before implementation; do not call an absent file a current gate.

## Success Criteria — reconciled 2026-07-28

- [x] The bounded editor-only report survives its supported navigation/reload path and keeps stable degradation categories visible.
- [x] External/export forms omit operational/raw diagnostic content; legacy presentations do not fabricate a clean report.
- [x] Progress and terminal status remain truthful within the delivered status surface.
- [ ] Explicit Cancel/countdown accessibility work remains deferred; recovery/report controls do not imply that omitted interaction is present.

## Risk Assessment

- Risk: report UI distracts from editing. Mitigation: collapsed secondary panel and details on demand.
- Risk: warning categories become accidental public schema. Mitigation: version server raw codes and map client categories additively.
- Risk: external DTO redaction hides useful debugging. Mitigation: stable aggregate codes/counts plus private operational logs, never raw imported content.
- Risk: `EditorPage` is large/dirty. Mitigation: focused component/controller seam.

## Security Considerations

Reports may contain feature categories and bounded diagnostics, but never source bytes, secrets, environment values, credentials, job capabilities, authority identifiers, arbitrary HTML, raw stderr, source ZIP names, or private paths. GitHub/sync are external publication boundaries and require explicit DTO tests.

## Next Steps

Phase 6 retains the bounded editor/job summary and authority tombstones. Phase 7 records report redaction/provenance evidence without using UX screenshots as PowerPoint fidelity evidence.

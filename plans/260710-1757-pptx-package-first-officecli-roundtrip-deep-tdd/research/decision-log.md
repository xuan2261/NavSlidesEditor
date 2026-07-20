# Decision Log

## Accepted

| Decision | Rationale |
|---|---|
| Create an independent successor plan | Package-first architecture expands and changes the prior native-only scope |
| Stop the prior native-OOXML plan | Avoid two active, conflicting architecture roadmaps |
| Reuse completed native work | Scene graph, parsers, jobs, corpus, and oracle utilities remain valuable |
| Preserve immutable original | Only defensible exact-lossless recovery contract |
| Use content-addressed immutable revisions | Enables dedupe, exact identity, audit, rollback, and exact evidence |
| Publish one aggregate presentation/package head inside a metadata-root transaction | Prevents split-brain projection, package, source-map, journal, evidence, ownership, lease, and job generations |
| Use one non-expiring exclusive writer lock, fencing epoch, WAL, and durable state root | Gives file-backed storage explicit single-host atomicity/recovery; multi-replica mode remains unsupported |
| Keep editable NavSlides projection | Preserves native editor workflow for supported features |
| Keep source maps/journals server-owned | Clients cannot safely authorize OOXML mutations |
| Derive a granular net journal | Avoid whole-deck dirty state and unnecessary reconstruction |
| Use OfficeCLI as bounded backend | Useful inspector/validator/patcher without making it sole authority |
| Do not use resident mode initially | Reduces operational and lifecycle risk |
| Use PowerPoint for PowerPoint-specific claims | The target application must be the visual provider |
| Preserve active/unknown content without execution | Security and fidelity take precedence over unsupported editing |
| Make server package export authoritative | Prevents divergent client/server roundtrip semantics |
| Add a Phase 5 text-edit vertical slice | Validates architecture before broad feature investment |
| Require complete package portability or block | Lifetime original recovery cannot survive ID-only project/sync artifacts |
| Require protected evidence attestation | Self-authored artifact hashes are not a trust root |
| Track evidence per claim and exact subject | Higher-claim failure cannot erase lower verified evidence or attach to changed state |
| Use a protected append-only evidence epoch ledger | Signed manifest counters alone cannot prevent replay or rollback |

## Fail-Closed Defaults Pending Approval

| Decision area | Default |
|---|---|
| PowerPoint provider unavailable | No PowerPoint-specific fidelity claim |
| OfficeCLI missing/wrong hash | Disable OfficeCLI-backed operations; preserve original/native mode |
| Identity ambiguous or source hash stale | Block package patch |
| Generic raw OOXML mutation | Prohibited |
| Active content/external links | Preserve, do not execute/fetch |
| Digital signature impact unknown | Block edited package export |
| Unsupported object | Preserve/tier honestly; never imply native editability |
| Unknown relationship impact | Block affected mutation |
| Revision reachability uncertain | Do not garbage collect |
| Required evidence missing/stale/skipped | Release claim fails |
| Client reconstruction fallback | Explicitly labeled non-roundtrip |

## Phase Decision Checkpoints

### Phase 1

- Controlled PowerPoint provider ownership and exact supported Office build.
- Corpus licensing/governance, thresholds, fonts, artifact visibility, and retention.
- Whether hidden slides are included in visual/PDF evidence.

### Phase 2

- Bundled versus administrator-installed OfficeCLI by deployment target.
- Acceptance controls for unsigned release assets.
- Linux mutation capability and Electron platform scope.

### Phase 3

- Aggregate/per-presentation quotas.
- Revision retention and quarantine windows.
- Backup, rclone/GitHub/project export behavior.
- Deduplication ownership and garbage-collection schedule.

### Phase 5

- Canonical snapshot diff only versus optional explicit operation transport.
- Legacy migration rollout and rollback window.
- User-facing behavior for ambiguous identity.

### Phase 8

- Embedded workbook versus cache authority.
- External-link detach policy.
- Required chart families for the first release.

### Phase 9

- Required editability tiers for SmartArt, equations, vector media, OLE, 3D, and Zoom.
- Macro-enabled and signed package policy.

### Phase 10

- Rich notes representation.
- Hidden slide behavior in editor, slideshow, PDF, and export.
- Required transition/animation/custom-show coverage.

### Phase 11

- Whether any reviewed native raw-patch adapters are allowed.
- Retention of older edited revisions.
- Retirement timeline for regenerated client export.

## Validation Rule

Each checkpoint must be recorded as a versioned policy or capability-matrix change with tests. If product stakeholders do not approve a broader capability, implementation keeps the fail-closed default and lowers the advertised claim.

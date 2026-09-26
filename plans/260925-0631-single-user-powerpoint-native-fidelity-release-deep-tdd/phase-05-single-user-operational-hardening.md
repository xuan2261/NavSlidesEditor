---
phase: 5
title: 'Single-User Operational Hardening'
status: pending
priority: P0
effort: '8-12 engineer-days'
dependencies: [4]
---

# Phase 5: Single-User Operational Hardening

## Context Links

- [Plan overview](./plan.md)
- [Previous phase: build-once CI and green-SHA release](./phase-04-build-once-ci-and-green-sha-release.md)
- `C:\Work\NavSlidesEditor\README.md`
- `C:\Work\NavSlidesEditor\docs\deployment-guide.md`
- `C:\Work\NavSlidesEditor\docs\system-architecture.md`
- `C:\Work\NavSlidesEditor\client\src\utils\import-project.js`
- `C:\Work\NavSlidesEditor\server\services\storage.js`
- `C:\Work\NavSlidesEditor\server\index.js`
- `C:\Work\NavSlidesEditor\Dockerfile`
- `C:\Work\NavSlidesEditor\docker-compose.yml`

## Goal

Make the supported local/private, single-user deployment recoverable and
operable before native-fidelity gates are enabled. Close bounded `.navslides`
archive ingestion, failed-import media cleanup, health signaling, least-privilege
container execution, secret-file permissions, backup/restore proof, and the
single-process realtime invariant without adding application authentication or
multi-tenancy. Project publication is one server-owned operation protected by a
separate hashed import capability, trusted-author active content remains explicit
and origin-isolated, and both Electron and Docker enforce the physical runtime
assumptions used by later phases.

## Scope / Non-goals

### In scope

- Bounded `.navslides` and `.navslides.json` parsing before decompression or JSON
  materialization.
- One server-owned project publish operation with lease-protected
  `committing` recovery and media ownership that can roll back only files created
  before publication intent.
- A separate header-carried import capability whose hash, scope, expiry, and
  revocation state are stored server-side; `sessionId` is never authority.
- Explicit trusted-author acknowledgement for active content plus editor-route
  and same-origin isolation, without blanket sanitization of trusted author
  HTML/CSS/JS.
- One low-level, workflow-neutral media placement ownership primitive shared with
  Phase 6.
- `/health/live` and `/health/ready` with deterministic, non-secret reason codes.
- Docker runtime as a non-root user plus an executable healthcheck.
- Pinned container/runtime/browser inputs, image SBOM production, and OS/browser
  vulnerability gates.
- Owner-only `0600` mode on secret-bearing files on POSIX, with explicit Windows
  limitation wording rather than false mode claims.
- A documented and mechanically tested backup/restore drill for both
  `revealjs-data` and `revealjs-uploads`.
- Startup rejection of unsupported multi-process/realtime topologies.
- Electron single-instance ownership before backend startup.
- Explicit retention of the current no-built-in-auth, no-multi-tenant product
  model.

### Non-goals

- User accounts, sessions, RBAC, tenant IDs, tenant data isolation, SSO, or an
  internet-facing authorization model.
- A database migration, distributed lock, Redis Socket.IO adapter, sticky-session
  deployment, Kubernetes/HA mode, or horizontal scaling.
- Replacing the PPTX import job model; Phase 6 owns its durable media recovery.
- A second media workflow, outbox, or state machine inside the shared placement
  primitive.
- Making client JSZip a security boundary. The server must enforce archive limits.
- Sanitizing or stripping trusted-author active content solely because it is
  executable; the boundary is acknowledgement plus route/origin isolation.
- Automatic backup scheduling, encryption, off-site retention, or cloud backup.

## Key Insights

- Current project import expands ZIPs in the browser with `JSZip.loadAsync(file)`
  and uploads media one file at a time before presentation creation. A failed
  final create can leave unreferenced uploads.
- The existing upload route deduplicates through `upload-hashes.json`, but has no
  import-session ownership or exact rollback API. A generic upload-delete endpoint
  would be unsafe because reused files may be referenced elsewhere.
- The current client-side `POST /api/presentations` followed by import commit has a
  fatal publication gap: expiry or rollback can delete media after a presentation
  is already visible. Creation and media commitment therefore cannot remain two
  client-orchestrated operations.
- A random `sessionId` is a lookup key, not sufficient authority. Mutation
  authority must be a different high-entropy capability carried in a header and
  stored only as a hash.
- `.navslides` content is authored project content and can intentionally contain
  HTML/CSS/JS. Preserving that capability requires an explicit trusted-author
  acknowledgement and a local editor-only origin boundary, not blanket
  sanitization that silently changes the deck.
- Readiness is not equivalent to process liveness. Package-store initialization,
  compatibility/media recovery, writable persistent roots, and single-writer
  ownership must be ready before mutation traffic is advertised.
- Socket.IO rooms, process-local file locks, process-local job maps, and the
  package-store writer lock make one application process the only supported
  realtime topology. Merely documenting this is insufficient.
- `github-config.json`, `settings.json`, `rclone.conf`, share-token state, and
  temporary secret-bearing candidates are sensitive at rest. Atomic replacement
  must preserve/reapply owner-only permissions.
- A data-only backup is incomplete: presentation JSON/package authority and
  `/uploads` media are separate Docker volumes and must share one stopped
  consistency point.
- Backup failure must not strand a previously running service. The script needs a
  `finally` restart based on captured pre-state and must preserve separate backup
  and restart errors.
- Electron can otherwise start two embedded servers against one data root. The
  application lock must be acquired before backend initialization, not after the
  first window exists.

## Requirements

### Functional

1. Reject `.navslides` archives before extraction when compressed bytes, entry
   count, path length, nesting, duplicate/case-colliding paths, declared
   uncompressed bytes, compression ratio, or streamed expanded bytes exceed
   policy.
2. Permit only `manifest.json`, `presentation.json`, optional
   `presentation.html`, and bounded `media/<safe-name>` files. Reject traversal,
   absolute paths, backslashes, NULs, symlinks, encrypted entries, and unexpected
   executable/archive payloads.
3. Validate manifest v1.0/v1.1 structure, presentation schema, media inventory,
   per-media size/type/hash when supplied, aggregate JSON/string/slide/element
   budgets, and exact archive-entry references.
4. Preflight issues a random public `sessionId` and a separate random import
   capability returned once and accepted only in
   `X-NavSlides-Import-Capability`. Persist only its salted hash, operation scope,
   archive/payload digest, expiry, and revocation state. `sessionId`, cookies,
   share tokens, live tokens, or any presentation ID never authorize import
   mutation.
5. All media placement uses one low-level primitive that atomically records exact
   new/reused ownership against hash, byte length, MIME, safe staging/final
   relative path, and owner identity. The primitive owns file/hash-index
   transitions only; project import and Phase 6 retain their own single workflow
   state.
6. Replace client-side create-then-commit with one server-side publish endpoint.
   Before presentation creation it durably enters lease-protected `committing`,
   binds the validated payload digest and intended presentation ID, and becomes
   ineligible for expiry, cancellation rollback, or generic cleanup. The server
   creates the presentation, commits exact media ownership, and publishes
   visibility as one recoverable operation.
7. A crash after presentation bytes become visible but before the terminal import
   receipt must recover forward to `committed`; expiry and rollback must never
   delete its media or presentation. A mismatch becomes `reconcile-required` and
   degrades readiness; it is never auto-deleted.
8. Before `committing`, abort, failure, cancellation, disconnect, or expiry removes
   only exact session-owned new files/hash records. Reused files are never
   removed. Repeated publish/rollback/recovery is idempotent and unknown, expired,
   revoked, wrong-scope, or foreign capabilities fail closed.
9. Archives containing executable author content require a validated
   `trustedAuthorActiveContentAcknowledged: true` bound into the preflight digest
   and repeated at publish. The server preserves acknowledged trusted-author
   HTML/CSS/JS; it does not apply blanket sanitization.
10. Project-import routes reject cross-origin/CORS use, public share/live/game
    origins or capabilities, missing/mismatched `Origin`/`Host` and Fetch Metadata
    where available, and requests outside the private editor API surface. This is
    route/origin isolation for the single-user product, not multi-user auth.
11. `GET /health/live` returns `200` once the process event loop and HTTP stack are
    running. It does not inspect dependencies.
12. `GET /health/ready` returns `200` only after startup initialization, writable
    data/uploads checks, package-store writer ownership, and recovery are healthy.
    During startup, shutdown, or degraded durable recovery it returns `503`.
13. Health responses contain only status, schema version, bounded reason codes,
    and optional uptime; no paths, filenames, tokens, hashes, or imported content.
14. Docker runs as a fixed unprivileged UID/GID, can write both mounted volumes,
    and uses `/health/ready` for `HEALTHCHECK`/Compose health.
15. Container base images are digest-pinned; runtime OS packages and the
    Playwright/browser payload are version/manifest pinned. CI emits an SPDX or
    CycloneDX image SBOM, scans OS and browser components under a checked-in
    severity/exception policy, and fails on unapproved high/critical findings or
    pin drift.
16. Secret-bearing files are created and atomically replaced as `0600` on POSIX.
    Existing broader modes are tightened at startup. Non-secret JSON retains the
    existing policy.
17. Backup captures initial service state before mutation, stops only a running
    service, captures both named volumes into one manifest, records archive hashes,
    and restarts in `finally` only when pre-state was running. Backup/snapshot and
    restart failures are retained and reported separately; either makes the
    command fail. Restore targets empty volumes, verifies hashes before extraction,
    starts the service, and proves presentations, package originals, history,
    settings presence, and media retrieval.
18. Startup rejects configured worker/cluster/process-count values other than one
    and exposes a stable `UNSUPPORTED_MULTI_PROCESS_TOPOLOGY` failure.
19. Electron calls `app.requestSingleInstanceLock()` before backend startup or
    window creation. Lock failure quits without binding a port or touching package
    state; a `second-instance` event focuses/restores the existing window.
20. Documentation states: single user, one server process, external authentication
    required for non-loopback exposure, no built-in auth, no tenant isolation.

### Non-functional

- Limits are centralized, versioned, deterministic, and tested at boundary ±1.
- Archive work is abortable and does not buffer every media entry simultaneously.
- Rollback is hash/path-contained and cannot delete a pre-existing file.
- Import capabilities have at least 128 bits of entropy, are compared in constant
  time, never appear in URLs/logs/receipts, and are erased at terminal state.
- Health checks complete within 500 ms and never trigger expensive repair.
- Backup scripts are non-interactive, fail closed, and never invoke
  `docker compose down -v`.
- No competing media state machines: one shared placement primitive, one bounded
  project-import session record, and Phase 6's existing package job.

## Architecture / Data Flow

```text
browser selects .navslides
  -> POST /api/project-imports/preflight (multipart archive)
  -> server ZIP central-directory + streamed expansion guards
  -> validated manifest/presentation/media/active-content inventory
  -> explicit trusted-author acknowledgement
  -> durable bounded import-session record + one-time header capability
  -> POST /api/project-imports/:sessionId/media
       header capability + same-origin editor route
       new file -> shared placement primitive owns exact hash/file
       existing hash -> reused, never owned
  -> POST /api/project-imports/:sessionId/publish
       transition pending -> lease-protected committing
       bind payload digest + intended presentation ID
       create hidden presentation -> commit media -> publish visibility
       terminal committed receipt; erase capability hash

error/cancel/disconnect/expiry while pending
  -> POST/worker rollback
  -> exact session-owned file/hash removal only
  -> terminal rolled-back receipt

crash/expiry/cancel after committing
  -> no rollback/delete path
  -> startup recovery commits forward or marks reconcile-required
```

```text
process start
  -> topology assertion
  -> data directories + secret permissions
  -> package-store/recovery initialization
  -> writable-root probes
  -> readiness=true

shutdown/degraded recovery
  -> readiness=false
  -> drain HTTP/Socket.IO/import cleanup
  -> release writer
```

Backup consistency contract:

```text
capture pre-state
  -> if running: compose stop
  -> try archive data + uploads -> hash + manifest
  -> finally if previously running: compose start -> readiness 200
  -> report backupError and restartError independently

restore drill:
new empty volumes -> verify archives -> extract both -> start
-> readiness 200 -> semantic inventory/media hash assertions
```

## Absolute Deep File Inventory

| Action | Absolute path                                                                                                | Planned change                                                                                                    | Mechanical proof           |
| ------ | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Modify | `C:\Work\NavSlidesEditor\client\src\utils\import-project.js`                                                 | Stop treating client expansion as authoritative; consume server preflight/session DTO and preserve legacy JSON UX | Boundary/unit tests        |
| Modify | `C:\Work\NavSlidesEditor\client\src\utils\import-project.test.js`                                            | Oversize, collision, missing media, rollback DTO tests                                                            | Focused Vitest             |
| Modify | `C:\Work\NavSlidesEditor\client\src\utils\api.js`                                                            | Add preflight/media/publish/rollback calls with separate capability header                                        | API contract tests         |
| Modify | `C:\Work\NavSlidesEditor\client\src\utils\api.test.js`                                                       | Assert header-only capability, same-origin requests, redaction, abort propagation                                 | Focused Vitest             |
| Modify | `C:\Work\NavSlidesEditor\client\src\pages\HomePage.jsx`                                                      | Own one abortable project-import session; acknowledge active content; never create presentation separately        | Home lifecycle tests       |
| Modify | `C:\Work\NavSlidesEditor\client\src\pages\HomePage.import-accessibility.test.jsx`                            | Import progress/cancel/error accessibility                                                                        | Focused Vitest             |
| Create | `C:\Work\NavSlidesEditor\client\src\pages\HomePage.project-import-lifecycle.test.jsx`                        | Session publish/rollback/unmount race matrix                                                                      | Focused Vitest             |
| Create | `C:\Work\NavSlidesEditor\server\routes\project-import.js`                                                    | Bounded archive admission and header-capability media/publish/rollback endpoints                                  | Route tests                |
| Create | `C:\Work\NavSlidesEditor\server\routes\project-import.test.js`                                               | Multipart, capability, origin, active-content, publication, expiry/rollback tests                                 | Focused Vitest             |
| Create | `C:\Work\NavSlidesEditor\server\services\project-import-archive.js`                                          | ZIP path/entry/stream budgets and manifest validation                                                             | Property/adversarial tests |
| Create | `C:\Work\NavSlidesEditor\server\services\project-import-archive.test.js`                                     | Bomb, collision, encrypted, malformed manifest cases                                                              | Focused Vitest             |
| Create | `C:\Work\NavSlidesEditor\server\services\media-placement-ownership.js`                                       | Workflow-neutral exact stage/reuse/promote/rollback file and hash-index primitive                                 | Shared fault tests         |
| Create | `C:\Work\NavSlidesEditor\server\services\media-placement-ownership.test.js`                                  | Ownership election, exact rollback, crash/replay, path containment                                                | Focused Vitest             |
| Create | `C:\Work\NavSlidesEditor\server\services\project-import-media-session.js`                                    | Hashed capability, pending/committing/committed lifecycle, publish recovery using shared primitive                | Fault tests                |
| Create | `C:\Work\NavSlidesEditor\server\services\project-import-media-session.test.js`                               | Capability, exact-file/hash rollback, publish/expiry/crash replay                                                 | Focused Vitest             |
| Modify | `C:\Work\NavSlidesEditor\server\routes\upload.js`                                                            | Reuse canonical MIME/hash helpers; no generic delete authority                                                    | Upload regressions         |
| Modify | `C:\Work\NavSlidesEditor\server\services\storage.js`                                                         | Secret-file policy, atomic mode preservation, session file path/helper                                            | Storage tests              |
| Modify | `C:\Work\NavSlidesEditor\server\services\storage.test.js`                                                    | `0600`, atomic replace, legacy permission tightening                                                              | POSIX/Windows-aware tests  |
| Create | `C:\Work\NavSlidesEditor\server\services\health-state.js`                                                    | Monotonic startup/readiness/degradation state                                                                     | Unit tests                 |
| Create | `C:\Work\NavSlidesEditor\server\services\health-state.test.js`                                               | Transition and redaction tests                                                                                    | Focused Vitest             |
| Modify | `C:\Work\NavSlidesEditor\server\index.js`                                                                    | Mount health/import routes; topology assertion; readiness transitions                                             | Server integration tests   |
| Create | `C:\Work\NavSlidesEditor\server\index-health.test.js`                                                        | live/ready/startup/shutdown/degraded responses                                                                    | Supertest gate             |
| Create | `C:\Work\NavSlidesEditor\server\single-process-topology.test.js`                                             | Reject cluster/worker configuration mechanically                                                                  | Focused Vitest             |
| Modify | `C:\Work\NavSlidesEditor\Dockerfile`                                                                         | Fixed non-root user, ownership, curl-free Node healthcheck or minimal health binary                               | Image smoke                |
| Modify | `C:\Work\NavSlidesEditor\electron\main.js`                                                                   | Acquire single-instance lock before backend/window and focus existing instance                                    | Electron tests             |
| Create | `C:\Work\NavSlidesEditor\electron\single-instance.test.js`                                                   | Second launch cannot bind backend or touch state                                                                  | Focused Vitest             |
| Modify | `C:\Work\NavSlidesEditor\Dockerfile`                                                                         | Digest-pinned base/runtime/browser inputs, fixed non-root user, ownership, Node healthcheck                       | Image smoke                |
| Modify | `C:\Work\NavSlidesEditor\tests\unit\docker-compose-network-exposure-contract.test.js`                        | Preserve loopback publish while checking user/health settings                                                     | Unit contract              |
| Create | `C:\Work\NavSlidesEditor\scripts\backup-docker-volumes.ps1`                                                  | Stop, archive both volumes, hash, manifest, restart                                                               | Script integration         |
| Create | `C:\Work\NavSlidesEditor\scripts\verify-container-supply-chain.js`                                           | Verify image/base/OS/browser pins, emit SBOM, invoke policy-bound scanners                                        | CI/image gate              |
| Create | `C:\Work\NavSlidesEditor\scripts\verify-container-supply-chain.test.js`                                      | Pin drift, missing browser inventory, severity and exception expiry cases                                         | Focused Vitest             |
| Modify | `C:\Work\NavSlidesEditor\.github\workflows\github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml` | Build image, publish SBOM artifact, scan OS/browser inventory under pinned tooling                                | CI contract                |
| Modify | `C:\Work\NavSlidesEditor\.github\workflows\release.yml`                                                      | Re-run image SBOM/OS/browser scan before release publication                                                      | Release gate               |
| Create | `C:\Work\NavSlidesEditor\scripts\restore-docker-volumes.ps1`                                                 | Empty-target restore with pre-verification                                                                        | Script integration         |
| Create | `C:\Work\NavSlidesEditor\scripts\docker-backup-restore-contract.test.js`                                     | Static safety and manifest contract                                                                               | Vitest                     |
| Modify | `C:\Work\NavSlidesEditor\package.json`                                                                       | Add `backup:docker`, `restore:docker`, and drill command                                                          | Script contract            |
| Modify | `C:\Work\NavSlidesEditor\docs\deployment-guide.md`                                                           | Exact health, non-root, both-volume backup/restore, one-process, auth boundary                                    | Docs contract              |
| Modify | `C:\Work\NavSlidesEditor\README.md`                                                                          | Concise supported topology and recovery statement                                                                 | Docs contract              |

## Tests Before (RED)

1. Archive with 10,001 entries is accepted.
2. Archive declares small media but streams beyond aggregate expansion budget.
3. `media/a.png` and `MEDIA/A.PNG` coexist.
4. Manifest references absent media and still creates a presentation.
5. Client creates a visible presentation, then import-session expiry deletes its
   media.
6. A guessed/stolen `sessionId` authorizes media upload, publish, or rollback.
7. Cross-origin or public-share context imports active content without explicit
   trusted-author acknowledgement.
8. A blanket sanitizer silently strips acknowledged trusted-author HTML/CSS/JS.
9. A crash after presentation publication but before session terminal state lets
   expiry rollback the published presentation's media.
10. A rollback deletes a reused pre-existing upload.
11. Replayed rollback deletes a later file that reused the same filename.
12. Readiness returns `200` before package-store initialization completes.
13. Readiness remains `200` during shutdown or durable recovery degradation.
14. Health response exposes a filesystem path or exception text.
15. Container process UID is zero or cannot write one mounted volume.
16. Image build uses an unpinned base/browser payload, emits no SBOM, or passes
    with an unapproved high/critical OS/browser finding.
17. `settings.json`, `github-config.json`, or `rclone.conf` remains group/world
    readable after create and atomic replacement on POSIX.
18. Backup captures only the data volume; restored slides reference missing media.
19. Backup capture fails and a previously running service remains stopped; restart
    failure overwrites the original backup error.
20. Restore accepts a tampered archive.
21. `NAVSLIDES_WORKERS=2`, Node cluster mode, or PM2-style instance count starts.
22. Two Electron instances start two backends against the same data root.

## Numbered Implementation

1. Freeze archive/session DTOs and limit constants. Write boundary ±1 tests first.
2. Extract server-side ZIP central-directory and streamed expansion guards using
   existing PPTX guard conventions; do not share parser-specific assumptions.
3. Add strict manifest/presentation/media validation and normalized safe archive
   paths.
4. Add project-import preflight with explicit active-content inventory,
   acknowledgement, same-origin/editor-route checks, and a separate header
   capability stored only as a hash.
5. Extract the workflow-neutral media placement ownership primitive; refactor
   upload MIME/hash logic into it without adding a generic file-delete endpoint.
6. Implement exact session ownership for new files and immutable reused records.
7. Add one publish operation with a durable lease-protected `committing` state;
   fault presentation create, media commit, visibility, and terminal receipt.
8. Make pending rollback/expiry idempotent and make every committing-or-later
   cleanup path recover forward or fail `reconcile-required`, never delete.
9. Migrate HomePage to server publish; it must not call the generic presentation
   create route for project import. Preserve acknowledged trusted-author content.
10. Introduce health state and mount health routes before SPA fallback. Keep health
    outside API rate limiting.
11. Add single-process topology assertion before package-store initialization and
    Electron `requestSingleInstanceLock()` before embedded backend startup.
12. Centralize secret-bearing path classification and enforce `0600` on create,
    startup repair, candidate files, and post-rename targets.
13. Convert the image to a fixed unprivileged runtime user; pin base/runtime/browser
    inputs, qualify mounted-volume ownership, and add Docker/Compose health checks.
14. Add image SBOM generation plus pinned OS/browser vulnerability scanning and
    expiring exception policy to CI and release.
15. Implement stopped-service, both-volume backup and empty-volume restore scripts
    with captured pre-state and restart in `finally`.
16. Add an automated drill fixture with one deck, one history snapshot, one
    package original, and one upload; verify semantic and byte hashes after restore.
17. Update deployment docs without implying built-in auth, HA, tenant safety, or
    sanitization of acknowledged trusted-author content.

## Refactor

- Keep archive limits in one server module; client checks remain UX hints only.
- Keep upload hashing/MIME detection and physical file/hash transitions canonical
  in the workflow-neutral placement primitive; project import and Phase 6 compose
  it without sharing workflow state.
- Keep health-state transitions separate from Express route wiring.
- Keep backup scripts operationally simple: stop, snapshot, verify, restart.
- Do not broaden `storage.js` into a database abstraction.

## Tests After (GREEN)

- Every archive resource/path/manifest limit fails before publication.
- Failed, cancelled, disconnected, expired, and replayed pending imports converge
  without deleting reused media; committing imports recover forward and cannot be
  expired or rolled back after publication.
- `sessionId` alone grants nothing; only the separately hashed, scoped,
  header-carried capability can mutate one import.
- Active content requires explicit trusted-author acknowledgement and same-origin
  editor routing, then is preserved without blanket sanitization.
- Live and ready probes distinguish process, startup, degraded recovery, and
  shutdown states.
- Container runs non-root and writes both volumes.
- Container SBOM and pinned OS/browser scans pass policy.
- Secret-bearing files are owner-only on POSIX after all write paths.
- The backup/restore drill recreates one complete working deployment from both
  volume archives, and failure still restores the captured running pre-state.
- Unsupported multi-process settings fail before listening.
- A second Electron launch cannot start another backend.

## Scenario Matrix

| Scenario                           | Expected durable/result state | Required assertion                                 |
| ---------------------------------- | ----------------------------- | -------------------------------------------------- |
| Valid v1.1 archive, no media       | committed                     | One presentation; no media session residue         |
| Valid legacy archive               | committed-with-warning        | Compatibility warning only                         |
| ZIP bomb/collision/traversal       | rejected                      | No extracted files/session                         |
| New media then create failure      | rolled-back                   | Exact new file/hash absent                         |
| Reused media then create failure   | rolled-back                   | Reused file/hash unchanged                         |
| Stolen session ID, no capability   | rejected                      | No state/file mutation                             |
| Active content, no acknowledgement | rejected                      | No session/publication                             |
| Active content, cross-origin       | rejected                      | No session/publication                             |
| Acknowledged active content        | committed                     | Author bytes preserved; isolated route             |
| Disconnect while pending           | recoverable                   | Expiry/explicit rollback converges                 |
| Crash after `committing`           | committing/reconcile-required | No expiry/rollback deletion; recover forward       |
| Startup initializing               | live/not-ready                | `200` live, `503` ready                            |
| Recovery dead letter present       | live/degraded                 | `503` ready with bounded code                      |
| Graceful shutdown                  | not-ready then stopped        | No ready window after drain begins                 |
| Docker fresh volumes               | ready                         | Non-root write and health pass                     |
| Image supply-chain gate            | qualified                     | Pinned inputs + SBOM + OS/browser scan             |
| Backup + clean restore             | ready                         | Both volume hashes and semantic probes pass        |
| Backup fails after stop            | restarted/error               | Original and restart errors independently reported |
| Tampered/missing archive           | restore rejected              | Target volumes remain empty                        |
| Worker count > 1                   | startup rejected              | No listening socket                                |
| Second Electron process            | exits                         | First window focused; no second backend            |

## Regression Commands

```powershell
npx vitest run client/src/utils/import-project.test.js client/src/utils/api.test.js client/src/pages/HomePage.project-import-lifecycle.test.jsx client/src/pages/HomePage.import-accessibility.test.jsx
npx vitest run server/services/project-import-archive.test.js server/services/media-placement-ownership.test.js server/services/project-import-media-session.test.js server/routes/project-import.test.js server/services/storage.test.js server/services/health-state.test.js server/index-health.test.js server/single-process-topology.test.js
npx vitest run electron/single-instance.test.js tests/unit/docker-compose-network-exposure-contract.test.js scripts/docker-backup-restore-contract.test.js scripts/verify-container-supply-chain.test.js
npm run build
npm run lint
docker build --tag navslides-editor:phase05 .
node scripts/verify-container-supply-chain.js --image navslides-editor:phase05 --sbom .tmp/phase05-image-sbom.json
docker compose up -d --build
docker compose ps
Invoke-WebRequest http://127.0.0.1:3002/health/ready
npm run backup:docker:drill
docker compose down
```

Mechanical release gate: all commands exit `0`; the built container reports
`healthy`, its runtime UID is non-zero, and the drill report proves both volume
archives were verified and restored. The image inputs match pins, its SBOM exists,
and OS/browser scans have no unapproved high/critical finding. No manual
screenshot counts as proof.

## Todos

- [ ] Write archive-budget and path-collision RED tests.
- [ ] Implement server-owned archive preflight.
- [ ] Write media ownership/rollback fault tests.
- [ ] Implement shared low-level media placement ownership primitive.
- [ ] Implement separate hashed header capability and origin isolation.
- [ ] Implement project-import pending/committing/published recovery lifecycle.
- [ ] Add trusted-author active-content acknowledgement without blanket sanitization.
- [ ] Migrate HomePage import orchestration.
- [ ] Add live/ready state and degraded reason codes.
- [ ] Enforce one-process startup.
- [ ] Enforce secret-file permissions.
- [ ] Run non-root Docker health smoke.
- [ ] Pin image/runtime/browser inputs and pass SBOM/OS/browser scan.
- [ ] Enforce Electron single-instance ownership before backend startup.
- [ ] Implement and execute both-volume backup/restore drill.
- [ ] Align README/deployment wording with the single-user model.

## Success Criteria

- [ ] `.navslides` import is bounded server-side and adversarial archives publish nothing.
- [ ] No failed pending project import leaves a session-owned media file or hash record.
- [ ] Presentation creation and media commitment are one server-owned recoverable publish operation.
- [ ] `committing` or published imports cannot expire, roll back, or delete presentation media.
- [ ] `sessionId` is never authority; a separate scoped header capability is stored only as a hash.
- [ ] Active content is accepted only after trusted-author acknowledgement on the same-origin editor route and is not blanket-sanitized.
- [ ] Reused/legacy media cannot be deleted by import rollback.
- [ ] `/health/live` and `/health/ready` implement the stated transition contract.
- [ ] Docker runs non-root, writes both volumes, and becomes healthy only when ready.
- [ ] Container base/runtime/browser pins, SBOM, and OS/browser scan gates pass.
- [ ] Every secret-bearing file write is `0600` on POSIX; Windows limitations are truthful.
- [ ] One reproducible drill backs up and restores both named volumes with hash proof.
- [ ] Backup restart runs from captured pre-state in `finally` and reports backup/restart failures separately.
- [ ] Unsupported multi-process/realtime startup fails closed.
- [ ] Electron permits only one embedded backend/data writer instance.
- [ ] Documentation explicitly says no built-in auth and no multi-tenant isolation.
- [ ] Focused tests, build, lint, image smoke, and restore drill pass.

## Risks with Signals / Responses

| Risk                                               | Observable signal                                 | Pre-decided response                                                                                 |
| -------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Browser/server archive policies drift              | Same fixture yields different verdict             | Server verdict wins; share generated constants only if runtime-neutral                               |
| Rollback deletes shared media                      | Reused fixture disappears                         | Stop release; require exact session owner + hash + filename match                                    |
| Presentation visible before media terminal         | expiry removes media from a visible deck          | One server publish endpoint; durable committing lease; no rollback after publication intent          |
| Session ID treated as bearer authority             | guessed ID mutates import                         | Separate header capability, stored hashed and scoped; constant-time verification                     |
| Active-content hardening changes author content    | imported HTML/CSS/JS differs                      | Require acknowledgement and origin isolation; do not blanket-sanitize trusted author content         |
| Import session file becomes another workflow store | Presentation/package state duplicated there       | Limit record to media ownership and terminal receipt                                                 |
| Shared primitive becomes a second workflow         | project and PPTX recovery states diverge          | Primitive owns only file/hash transitions; callers own their single workflow states                  |
| Health endpoint performs repair                    | Probe latency or state mutation                   | Make probe read-only; recovery owns repair                                                           |
| Non-root image cannot mount legacy volume          | `EACCES` at startup                               | Document one-time ownership migration; never fall back to root                                       |
| POSIX modes claimed on Windows                     | Tests fake chmod guarantees                       | Assert best effort only on Windows; document ACL limitation                                          |
| Backup spans live writes                           | Cross-volume generation mismatch                  | Mandatory stopped-service snapshot; abort if container still running                                 |
| Backup failure strands service                     | pre-running service remains stopped               | Capture pre-state; restart in `finally`; retain separate backup and restart errors                   |
| Restore overwrites valuable volumes                | Non-empty target detected                         | Refuse unless exact empty-target precondition passes                                                 |
| Single-process check misses orchestrator           | duplicate writer/listener or Socket.IO divergence | Support explicit process-count env guards plus package writer refusal; document unsupported topology |
| Electron bypasses server topology checks           | two desktop backends race the same root           | Acquire `requestSingleInstanceLock()` before backend start; second instance exits                    |
| Image/browser dependency drifts                    | SBOM differs or scanner finds unapproved CVE      | Digest/version pins plus fail-closed CI/release scans and expiring exceptions                        |

## Security

- Project archives and media are untrusted input; validate names, sizes, ratios,
  MIME/magic bytes, and JSON shape before use.
- Never expose import capabilities or ownership tokens in URLs, logs, analytics,
  receipts, presentation JSON, or durable plaintext; `sessionId` is not authority.
- Trusted-author active content remains intentional product behavior. Require an
  explicit acknowledgement bound to the archive/payload digest and isolate the
  routes to the same-origin private editor surface; do not claim sanitization.
- Health endpoints are unauthenticated but disclose no sensitive state.
- Secret-file hardening reduces local disclosure; it does not create user auth.
- Non-loopback deployments still require an external authentication/reverse-proxy
  boundary. This phase must not imply otherwise.
- Backup archives contain credentials, share tokens, slide content, and media.
  Scripts warn accordingly and create local outputs with owner-only permissions.

## Next Steps

Phase 6 consumes readiness degradation and the storage/session patterns, then
closes exact compatibility receipts and durable PPTX imported-media recovery.
Do not begin G0/G1 qualification while Phase 5 restore or readiness gates are red.

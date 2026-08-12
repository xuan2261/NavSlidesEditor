---
phase: 3
title: "Loopback Deployment and SVG Isolation"
status: completed
priority: P1
effort: "3-4 engineer-days"
dependencies: []
---

# Phase 3: Loopback Deployment and SVG Isolation

<!-- Updated: Validation Session 1 - non-loopback missing acknowledgement warns and continues -->

## Context Links

- [Plan overview](./plan.md)
- [Live/deployment/SVG research](./research/live-deployment-svg-research.md)
- [Debug baseline](./reports/debug-verification-baseline.md)
- `C:\Work\NavSlidesEditor\docs\deployment-guide.md`
- `C:\Work\NavSlidesEditor\docs\code-standards.md`

## Overview

Make local, Electron, and Docker defaults consistent with the documented
single-user/no-auth threat model. Prevent uploaded SVG from obtaining
application-origin script authority while preserving sanitized inline SVG and
passive SVG image rendering.

## Requirements

### Functional

- Node server defaults to `127.0.0.1`.
- Electron always starts and navigates to an explicit loopback host, independent
  of inherited environment overrides.
- Docker container listens on `0.0.0.0` internally but publishes host port 3002
  to `127.0.0.1` by default.
- Direct LAN publication is an explicit environment opt-in and documentation
  requires an external authentication boundary.
- Non-loopback publication/listening without an explicit dangerous-exposure
  acknowledgement emits a prominent structured startup warning containing the
  actual bind/publication address. Per validation decision it does not abort.
  Container-internal listen and host publication remain separate settings.
- Server logs the actual bound address instead of claiming localhost generically.
- New SVG uploads are structurally parsed and sanitized before hashing/deduplication.
- SVG sanitizer input is capped at 5 MiB and read under a byte-bounded policy;
  oversized SVG is deleted and rejected before DOM construction.
- Every served SVG, including legacy uploads, receives a restrictive sandbox CSP,
  `nosniff`, and same-origin resource policy.
- Passive `<img src="/uploads/*.svg">` remains visible; top-level SVG navigation
  cannot execute script/event handlers or read application APIs.

### Non-functional

- Preserve `startServer(port)` compatibility and add options additively.
- Preserve upload response `{url, deduped}` and upload size/type limits.
- Preserve trusted author inline SVG behavior through existing client/shared
  render sanitizers.
- Do not claim Host/Origin ingress middleware is authentication.
- Do not silently enable LAN access during upgrade.

## Architecture

### Listen policy

```js
resolveListenHost({
  explicitHost,
  envHost = process.env.NAVSLIDES_LISTEN_HOST,
  fallback = '127.0.0.1'
})
```

`startServer(port, { host } = {})` resolves once and calls
`server.listen(port, host)`. Electron uses one literal origin,
`http://127.0.0.1:${PORT}`, for bind, `loadURL`, navigation allowlists, popup
checks and tests. It never mixes IPv4-only bind with `localhost`/`::1` resolution.

Docker:

```yaml
environment:
  NAVSLIDES_LISTEN_HOST: 0.0.0.0
  NAVSLIDES_PUBLISH_HOST: ${NAVSLIDES_PUBLISH_HOST:-127.0.0.1}
ports:
  - "${NAVSLIDES_PUBLISH_HOST:-127.0.0.1}:3002:3002"
```

Intentional exposure uses `NAVSLIDES_PUBLISH_HOST=0.0.0.0` plus authenticated
reverse proxy/firewall, explicit local ingress/proxy settings, and a separately
named danger acknowledgement. Without the acknowledgement, the server logs a
high-signal warning and continues per the validated operator-compatibility policy;
documentation states that neither acknowledgement nor warning is authentication.

### SVG policy

1. Parse one `<svg>` root. Reject DOCTYPE/entity declarations.
2. Sanitize with server DOMPurify/jsdom SVG profile.
3. Forbid script, `foreignObject`, embedded HTML, object/embed/iframe, event
   attributes, external references, unsafe CSS URLs, and URL-mutating animation.
4. Allow local fragments and bounded `data:image/*;base64`.
5. Persist and hash only sanitized bytes.
6. Serve `.svg` with:

```text
Content-Security-Policy: sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'
X-Content-Type-Options: nosniff
Cross-Origin-Resource-Policy: same-origin
```

Serving isolation is the invariant for legacy files. Sanitization is
defense-in-depth for new files.

## File Inventory

| Action | File | Planned change | Test impact |
|---|---|---|---|
| Create | `C:\Work\NavSlidesEditor\server\services\listen-host-policy.js` | Resolve validated bind host | New unit tests |
| Modify | `C:\Work\NavSlidesEditor\server\index.js` | Host-aware listen and SVG static headers | Server integration tests |
| Modify | `C:\Work\NavSlidesEditor\electron\main.js` | Explicit loopback start/navigation | Electron contract tests |
| Modify | `C:\Work\NavSlidesEditor\docker-compose.yml` | Loopback host publication + internal bind | Compose contract test |
| Modify | `C:\Work\NavSlidesEditor\Dockerfile` | Document/retain container port contract | Build smoke |
| Create | `C:\Work\NavSlidesEditor\server\services\svg-upload-sanitizer.js` | Server SVG parse/sanitize policy | New unit tests |
| Modify | `C:\Work\NavSlidesEditor\server\routes\upload.js` | Sanitize before hash/dedup | Upload route tests |
| Verify | `C:\Work\NavSlidesEditor\client\src\utils\content-safety.js` | Keep client inline SVG policy | Existing tests |
| Verify | `C:\Work\NavSlidesEditor\shared\src\content-safety.js` | Keep share/export sanitizer | Parity tests |
| Modify | `C:\Work\NavSlidesEditor\server\routes\upload-dedup.test.js` | Malicious/valid SVG upload | Focused unit gate |
| Create | `C:\Work\NavSlidesEditor\server\services\svg-upload-sanitizer.test.js` | SVG policy matrix | Focused unit gate |
| Modify | `C:\Work\NavSlidesEditor\tests\unit\electron-release-readiness-contract.test.js` | Loopback contract | Release gate |
| Create | `C:\Work\NavSlidesEditor\tests\unit\docker-compose-network-exposure-contract.test.js` | Compose publish policy | Release gate |
| Create | `C:\Work\NavSlidesEditor\tests\e2e\security\uploaded-svg-origin-isolation.spec.js` | Real upload/navigation/passive image | Browser gate |
| Create | `C:\Work\NavSlidesEditor\tests\e2e\deployment\loopback-runtime-smoke.spec.js` | Actual server/container reachability | Runtime gate |
| Create | `C:\Work\NavSlidesEditor\tests\e2e\electron\electron-loopback-launch-smoke.spec.js` | Launch packaged-prepared Electron and load literal origin | Electron gate |
| Modify | `C:\Work\NavSlidesEditor\README.md` | Local/network threat model | Docs gate |
| Modify | `C:\Work\NavSlidesEditor\docs\deployment-guide.md` | Bind/env/proxy/CORS instructions | Docs gate |
| Modify | `C:\Work\NavSlidesEditor\website\guide\installation.md` | Loopback/LAN behavior | Docs gate |
| Modify | `C:\Work\NavSlidesEditor\website\vi\guide\installation.md` | Vietnamese parity | Docs gate |

## Function and Interface Checklist

- [x] Enumerate every `startServer` caller and test.
- [x] Validate host values without accepting URLs, paths, or comma lists.
- [x] Keep development Vite proxy and Electron URL consistent with loopback.
- [x] Use literal `127.0.0.1` consistently for Electron bind/load/allowlists.
- [x] Distinguish container bind from host port publication.
- [x] Emit and test a structured warning for non-loopback start/publication
  without the explicit danger acknowledgement.
- [x] Document `NAVSLIDES_LOCAL_ALLOWED_HOSTS`, origins, trusted proxies, and
  missing-Origin policy for exposed deployments.
- [x] Run sanitizer before SHA-256 calculation.
- [x] Enforce 5 MiB SVG stat/read cap before jsdom/DOMPurify allocation.
- [x] Apply serving policy to legacy SVG without rewriting user files.
- [x] Prove client/shared inline SVG sanitizer parity for active constructs.
- [x] Correct stale documentation claiming production CORS is open.

## Dependency Map

```text
listen-host policy -> server start -> Electron and Docker contracts

SVG multipart upload -> server sanitizer -> hash/dedup -> /uploads static policy
                                          -> passive image / direct navigation
```

No phase dependency. This phase shares `server/index.js` with other server work,
so keep the host/SVG response changes isolated and rebase before closeout.

## Tests Before (RED)

| Scenario | Expected |
|---|---|
| `startServer(0)` default | listener address is loopback |
| explicit `0.0.0.0` | allowed only when requested |
| Electron inherited broad host env | still loopback |
| Electron literal origin | backend connect succeeds even when localhost resolves to `::1` |
| default Compose config | host publication starts with `127.0.0.1:` |
| LAN opt-in config | deterministic documented expansion |
| broad listen/publication without danger acknowledgement | server continues and emits structured security warning |
| SVG larger than 5 MiB | rejected and deleted before DOM parse |
| SVG script/onload/external href/foreignObject/SMIL URL | rejected or sanitized |
| SVG gradient/fragment/base64 image | preserved |
| direct navigation to legacy malicious SVG | script cannot run/fetch API |
| passive SVG `<img>` | remains rendered |
| ordinary PNG/video/audio | response behavior unchanged |

Use isolated temporary upload/data directories and a loopback-only test server.
The browser canary must assert no title/storage/API state mutation, not only headers.

## Implementation Steps

1. Add failing listen-host, Electron and Compose contract tests.
2. Implement validated host resolution and explicit Electron/Docker behavior.
3. Add danger-acknowledgement and literal Electron origin tests.
4. Add failing server-side SVG policy/size tests using active and safe fixtures.
5. Implement bounded sanitizer before hash/dedup.
6. Add restrictive response headers for all served SVG files.
7. Add real upload + Chromium direct-navigation/passive-image E2E.
8. Add actual loopback server, disposable Compose and Electron launch probes.
9. Update deployment, security, reverse-proxy and bilingual install docs.
10. Run focused, build, runtime, Electron and docs gates.

## Refactor

- Keep listen policy and sanitizer in small modules.
- Do not redesign server bootstrap, upload storage, or trusted SVG elements.
- Do not add authentication while fixing network defaults.

## Tests After (GREEN)

- Existing mutation ingress and upload dedup tests still pass.
- Production/development CORS contracts stay unchanged unless explicitly documented.
- Docker service starts and is reachable from host loopback.
- Electron startup contract uses explicit loopback.
- Legacy active SVG is inert under response policy.

## Regression Gate

```powershell
npx vitest run server/middleware/local-mutation-ingress.test.js server/middleware/local-mutation-ingress-app.test.js server/routes/upload-dedup.test.js server/services/svg-upload-sanitizer.test.js tests/unit/electron-release-readiness-contract.test.js tests/unit/docker-compose-network-exposure-contract.test.js client/src/utils/content-safety.test.js shared/tests/content-safety.test.js
npx playwright test --workers=1 tests/e2e/security/uploaded-svg-origin-isolation.spec.js
npx playwright test --workers=1 tests/e2e/deployment/loopback-runtime-smoke.spec.js tests/e2e/electron/electron-loopback-launch-smoke.spec.js
docker compose config
# Use a generated override with an unused host port and unique project name.
docker compose -p navslides-plan-gate -f docker-compose.yml -f <temp-override> up -d --build
# Probe default host-loopback reachability and default off-host denial, then:
docker compose -p navslides-plan-gate -f docker-compose.yml -f <temp-override> down
npm run lint
npm run build
npm run docs:build
```

## Success Criteria

- [x] Local and Electron listeners are loopback-only by default.
- [x] Docker host publication is loopback-only by default.
- [x] Explicit LAN/server mode is documented and contract-tested.
- [x] Non-loopback exposure without acknowledgement is never silent and logs the
  actual risk/address.
- [x] New and legacy SVG cannot execute with application-origin authority.
- [x] Passive SVG images and trusted sanitized inline SVG remain functional.
- [x] Focused, browser, Compose, lint, build and docs gates pass.
- [x] Disposable container and Electron runtime-connect smoke gates pass locally
  or are assigned to named deferred CI jobs.

## Risk Assessment

| Risk / assumption | Observable signal | Pre-decided response |
|---|---|---|
| Existing LAN users lose access | Remote host cannot connect after upgrade | Intentional secure default; document explicit opt-in |
| Container cannot reach listener | Compose smoke fails | Keep container bind `0.0.0.0`; do not broaden host publication |
| CSP breaks passive SVG | Browser image visibility test fails | Adjust response policy while preserving `sandbox` and no script |
| Sanitizer changes safe SVG visuals | fixture snapshots differ | Tighten allowlist only for proven safe constructs; no blanket pass-through |
| Proxy setup bypasses ingress assumptions | host/origin integration test fails | Require explicit proxy env settings and external auth |

## Security Considerations

- Host/Origin checks remain CSRF/local-ingress heuristics, not identity.
- Rollback to broad listener or unprotected SVG serving reintroduces risk.
- Existing malicious SVG files need no destructive migration while serving
  isolation remains enabled.

## Todo

- [x] Write RED host/Compose/Electron contracts.
- [x] Implement loopback-safe listener policy.
- [x] Write RED SVG sanitizer and browser canaries.
- [x] Implement sanitization and serving isolation.
- [x] Update deployment/security docs.
- [x] Run all phase gates.

Deferred CI lanes: Docker Compose runtime and the planned Electron/uploaded-SVG
browser probes are unavailable in this Windows checkout because Docker is not
installed and those spec files are absent.

# Production Readiness Remediation — Sync Back

- Date: 2026-08-12
- Plan status: `in-progress`
- Phase status: Phases 1, 3, and 4 `completed`; Phases 2, 5, 6, and 7
  `pending`
- Scope: reconcile the verified live-capability, loopback/SVG, and PPTX archive
  evidence without claiming pending phase completion

## Completed phase evidence

- **Phase 1 — Live capability separation:** live REST/unit `83/83`; live
  capability/security browser `9/9`.
- **Phase 3 — Loopback deployment and SVG isolation:** loopback/SVG contracts
  `36/36`; server loopback startup/shutdown smoke passed; `npm run build` and
  `npm run docs:build` passed.
- **Phase 4 — PPTX archive preflight and bounded CRC:** focused archive/worker
  gates passed; PPTX adversarial `10/10`, tiny performance check, and corpus
  `11/11` passed; lint reported 0 errors with 29 pre-existing warnings.

## Deferred CI and pending work

- Docker Compose runtime is deferred because the Docker command is unavailable
  in this checkout.
- Planned deployment and Electron runtime probes are deferred.
- Planned uploaded-SVG browser specs are deferred because those spec files are
  absent in this checkout.
- Phases 2 (portable HTML/GitHub export), 5 (PPTX compatibility receipts), 6
  (durable media recovery), and 7 (release closeout) remain pending.
- Deferred lanes are not treated as passing evidence, and the package-first
  dependency remains blocked until its mandatory CI evidence is green.

## Unresolved questions

- None blocking this sync-back.

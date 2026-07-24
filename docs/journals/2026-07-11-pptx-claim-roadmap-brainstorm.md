---
title: 'PPTX Claim Roadmap Brainstorm'
date: '2026-07-11'
updated: '2026-07-13'
status: completed
---

# PPTX Claim Roadmap Brainstorm

## Context

Reviewed the next steps for validated edited-export, OfficeCLI containment,
Docker/Electron packaging, preserve-only feature expansion, and protected
PowerPoint evidence.

## Decisions

- Replace the strict five-item sequence with claim-driven vertical slices.
- Build the minimum canonical matrix contract and Windows containment in parallel.
- Release claim level 3 before expanding level-4 feature coverage.
- Validate Docker and Electron using final artifacts.
- Use a disposable GitHub Actions self-hosted Windows VM for level-5 PowerPoint
  evidence, provisioned only after level-4 subjects stabilize.
- Build the NavSlides containment supervisor as a C++/Win32 CMake executable;
  OfficeCLI remains administrator-provided and external.
- Prefer AppContainer; permit dedicated service identity plus ACL/WFP only after
  equivalent physical evidence.
- Keep level 5 unavailable until its cloud destruction verifier and external
  KMS/HSM signer are selected during provisioning.
- Split gate approvals across App/Storage, Security, and Release roles.

## Impact

The reordered roadmap prevents edited-export from enabling without semantic and
containment qualification, while keeping lower claims releasable when packaging
or PowerPoint-provider infrastructure is unavailable.

## Artifact

- `plans/archive/260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd/reports/260711-1705-pptx-claim-roadmap-brainstorm.md`
- `plans/archive/260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd/plan.md`

## Plan Outcome

The existing 13-phase plan was reconciled instead of duplicated. Four hostile
reviewers produced 15 Session 2 findings; 14 were accepted and propagated, while
the multi-user authentication epic was rejected under the locked trusted-proxy
scope. The final consistency audit reported zero issues, Prettier passed, and
`ck plan validate --strict` passed with 13 phases, 0 errors, and 0 warnings.

## Next

Begin TDD execution with `/ck:cook` against the absolute plan path. Physical
OfficeCLI, Windows/MSVC, Docker, and protected PowerPoint gates remain fail-closed
when infrastructure is unavailable.

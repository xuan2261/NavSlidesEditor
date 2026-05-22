---
type: research
created: "2026-05-21T23:30:00+07:00"
source: "ck:plan --deep --tdd"
---

# Research Summary: Manual Linux Visual Baseline Regeneration

## Findings

- Project docs already require visual baselines to be regenerated inside `mcr.microsoft.com/playwright:v1.59.1-jammy`.
- Existing CI uses the same Playwright image for E2E jobs, including `e2e-visual`.
- Current local machine cannot run Docker-compatible container tooling: Docker, Podman, Nerdctl absent; WSL has no installed distro.
- GitHub Actions supports job-level `container:` and manual `workflow_dispatch`, which gives a canonical Linux environment without local Docker.
- Safer first iteration is artifact upload and manual application, not CI auto-commit.

## Recommended Direction

Add a manual workflow that:

1. runs in `mcr.microsoft.com/playwright:v1.59.1-jammy`;
2. executes `npm ci` and `npm run build`;
3. runs `npx playwright test tests/e2e/visual/ tests/e2e/visual-regression.spec.js --update-snapshots`;
4. immediately verifies with the same command without `--update-snapshots`;
5. uploads only snapshot PNGs as an artifact.

## Rejected Alternatives

| Alternative | Reason rejected |
|---|---|
| Install Docker/WSL locally | Outside requested direction; more host setup risk |
| Generate snapshots on Windows | Explicitly rejected by docs and helper comments due pixel drift |
| CI auto-commit snapshots | Faster but less reviewable; write token risk |
| Raise screenshot thresholds | Masks visual regressions instead of updating intentional baselines |
| Skip visual tests for PR | Leaves original blocker unresolved |

## Unresolved Questions

_None._

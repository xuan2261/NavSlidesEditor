# Brainstorm Report: CI/CD & Performance Evaluation

## Problem Statement & Requirements

The "Slides Platform Full Development" has successfully reached feature parity with `slides.com`. As the next step, there is a need to establish a safety net for future development via automated testing, and to establish performance baselines for the Live Presenting (WebSocket) and JSON payload capabilities. We have decided to postpone Multi-tenant architecture discussions to strictly separate concerns and prioritize stability.

## Evaluated Approaches & Rationale

We evaluated three approaches for CI/CD and three for Performance testing.

### CI/CD Pipeline

- **A1:** Basic PR Validation (Lint, Unit, Build check). Fast but lacks E2E coverage.
- **A2: Comprehensive Full-Stack Pipeline (Selected).** Covers Lint, Unit Tests, Build, and Playwright E2E.
- **A3:** CI/CD + Release workflow. Comprehensive but slows down the pipeline and introduces heavy complexity with Electron artifacts.

**Rationale for A2:** Provides ~90% confidence in UI/UX and environment compatibility without the heavy overhead of release packaging on every PR. It catches visual/E2E regressions which are critical for an editor application.

### Performance & Load Testing

- **B1: API & WebSocket Benchmarking via K6/Artillery (Selected).** Synthetic load generation to measure throughput and latency for heavy Base64 JSONs and Socket.IO.
- **B2:** Multi-browser Playwright testing. Most realistic but prohibitively expensive on resources.
- **B3:** APM + Memory Profiling. Good for leaks, but higher setup cost for initial baseline.

**Rationale for B1:** Gives accurate and highly repeatable metrics (P95/P99 latency) for the exact bottlenecks (WebSocket and JSON size) while being lightweight enough to potentially run locally or even integrate into CI later.

## Implementation Considerations & Risks

- **Playwright caching in CI:** Running headless browsers in GitHub Actions can be slow. We must leverage GitHub cache for `node_modules` and Playwright binaries.
- **K6 integraton limits:** Testing WebSockets via K6 requires specific plugins or scripts to simulate Socket.IO headers and handshake logic.
- **Electron Build exclusion:** The CI will currently verify `vite build`, but the `electron:build` command will remain manual until a future Release Pipeline project.

## Success Metrics & Validation Criteria

- **CI/CD:** Every push/PR to `main` must pass the A2 pipeline within ~5-7 minutes.
- **Performance:** K6 scripts successfully simulate 50+ concurrent Socket.IO viewer connections and provide a clear report on latency.

## Next Steps

- Generate a detailed Implementation Plan covering the YAML definitions for GitHub Actions (A2) and the test script architecture for K6 (B1).

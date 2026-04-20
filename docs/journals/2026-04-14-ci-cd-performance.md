# Journal: CI/CD and Performance Testing Setup

**Date:** 2026-04-14

## Actions Taken
- Implemented Phase 1: CI/CD Pipeline Setup. Created `.github/workflows/ci.yml` for automated linting, unit testing (Vitest), build checks, and E2E testing (Playwright) via GitHub Actions.
- Implemented Phase 2: Performance Load Testing Setup. Developed scripts for API and WebSocket load tests using `k6`. 
- Updated `package.json` with corresponding npm scripts (`test:load:api`, `test:load:ws`).
- Added documentation for `k6` load testing to `README.md`.

## Technical Decisions
- Selected `GitHub Actions` to provide a robust safety net (A2) that automatically validates PRs and pushes to `main`.
- Chose `k6` for performance load testing (B1) to robustly evaluate WebSocket connection stability under load (e.g., 50 VUs) and to assess the handling of large JSON payloads in the REST API.

## Outcome
- Setup significantly enhances codebase reliability and prepares the infrastructure for safe future scaling and feature additions.


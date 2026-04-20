---
status: completed
---

# Refactor HTML Duplication & Setup Tests/Linters

## Overview

- **Priority:** High
- **Current status:** Completed
- **Description:** Migrate duplicated HTML logic to a shared npm workspace and introduce ESLint, Prettier, Vitest, and Playwright to resolve critical technical debt.

## Phases

- [x] Phase 1: Setup `shared` workspace and extract duplicated code.
  - Link: [phase-01-setup-shared-workspace.md](./phase-01-setup-shared-workspace.md)
- [x] Phase 2: Refactor `client` and `server` to use the shared package.
  - Link: [phase-02-refactor-client-server.md](./phase-02-refactor-client-server.md)
- [x] Phase 3: Setup ESLint and Prettier for the monorepo.
  - Link: [phase-03-setup-linters.md](./phase-03-setup-linters.md)
- [x] Phase 4: Setup Vitest and Playwright for Testing.
  - Link: [phase-04-setup-testing.md](./phase-04-setup-testing.md)

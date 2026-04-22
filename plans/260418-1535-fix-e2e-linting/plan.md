---
title: Fix E2E Dashboard Test & Cleanup Linting
status: completed
---

# Fix E2E Dashboard Test & Cleanup Linting

## Overview

This plan outlines the steps to resolve the Playwright E2E test timeout issue on the Dashboard and clean up over 200 unused variable warnings reported by ESLint across the codebase.

## Key Insights

1. **E2E Failure Root Cause**: The `can create a new presentation from modal` E2E test times out waiting for the `/editor/:id` route. This occurs because `HomePage.jsx` sends `{ templateId: null }` in the API payload, which is rejected by the server's Zod schema (`z.string().uuid().optional()`) with a 400 Bad Request.
2. **Linting Bloat**: The recent aggressive refactoring left orphaned imports and variables (over 200 `no-unused-vars` warnings).

## Requirements

- The E2E test suite must pass completely.
- All unused variables/imports must be removed.
- Project must build and run successfully after cleanup.

## Implementation Steps

### Phase 1: Fix E2E Dashboard Test

- [x] **File**: `client/src/pages/HomePage.jsx`
- [x] **Action**: Modify `handleCreate` and `handleCreateTemplate` to strip `templateId` when its value is `null` before sending the payload to the API.
- [x] **Verification**: Run `npm run test:e2e` for the dashboard specs to confirm the timeout issue is resolved.

### Phase 2: Cleanup Unused Variables

- [x] **Files**: Across the `client` and `server` directories.
- [x] **Action**:
  - Run ESLint to identify unused variables.
  - Remove unused imports (e.g., unused Lucide icons, unused React components).
  - Remove unused function arguments or prefix them with `_` if they must be kept for signature compliance.
- [x] **Verification**: Run `npm run lint` and ensure 0 warnings for `no-unused-vars`.

## Next Steps

Both phases have been executed and verified.

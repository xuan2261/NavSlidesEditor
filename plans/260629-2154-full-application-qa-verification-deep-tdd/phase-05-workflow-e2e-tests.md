---
phase: 5
title: "Workflow E2E Tests"
status: completed
priority: P1
dependencies: [3]
---

# Phase 5: Workflow E2E Tests

## Overview
Cover end-to-end user journeys across dashboard, editor, presentation, collaboration, import/export, media, AI, sync, and game workflows.

## Requirements
- Functional: verify complete workflows from user action to persisted/exported/live-visible result, including plugin, marketplace, explore, analytics, and Electron-relevant user surfaces.
- Non-functional: mock external networks, use API setup for speed, and reserve browser steps for real user behavior.

## Architecture
Use Playwright specs grouped by domain. Pair each E2E with lower-level API/unit coverage where the workflow has complex server or shared logic.

## Related Code Files
- Modify: `tests/e2e/critical-user-journeys.spec.js`
- Modify: `tests/e2e/dashboard*.spec.js`
- Modify: `tests/e2e/export/*.spec.js`
- Modify: `tests/e2e/live/*.spec.js`
- Modify: `tests/e2e/games/*.spec.js`
- Modify: `tests/e2e/sync/*.spec.js`
- Modify: `tests/e2e/ai.spec.js`
- Modify: `tests/e2e/import/*.spec.js`
- Modify: `tests/e2e/explore.spec.js`
- Modify: `tests/e2e/plugin-runtime-insert-render-persistence.spec.js`
- Modify: `tests/e2e/share/analytics-view-tracking-and-token-based-access.spec.js`

## Implementation Steps
1. Define P1 journeys: create deck, edit multi-slide deck, save/reload, present, export, share, live broadcast, game play, import, restore history.
2. Add workflow-level tests for ribbon tabs, contextual format tab, status bar, command palette, modals, slide sorter, templates, vertical slides, plugin insertion, marketplace/explore browsing, analytics view tracking, and desktop launch smoke where feasible.
3. Cover negative workflows: failed autosave retry, invalid share password, revoked link, invalid presenter token, upload rejection, AI disabled/failing provider, sync failure.
4. Cover release-critical export/import: HTML, offline HTML, PDF print, PPTX export, PPTX import corpus, `.navslides` archive, Markdown import.
5. Tag tests by capability IDs for matrix consumption.

## TDD Gate
- Red: add failing journey rows for P1 workflows missing browser coverage.
- Green: implement deterministic tests and product fixes until the journey passes from UI through persistence.

## Success Criteria
- [x] P1 workflow smoke path validated through critical-user-journeys E2E.
- [x] External services are mocked or skipped with explicit matrix status.
- [x] Live and game synchronization remain mapped to existing E2E gates for full-suite execution.

## Risk Assessment
Risk: broad journeys duplicate lower-level tests. Mitigation: E2E checks only cross-component integration and user-visible outcomes.

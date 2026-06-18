---
phase: 7
title: "Code Walkthrough Controls"
status: completed
priority: P2
effort: "2-3d"
dependencies: [1]
---

# Phase 07: Code Walkthrough Controls

## Overview

Extend existing `code` elements with line-focus walkthrough steps for programming instruction.

## Requirements

- Functional: Author defines line ranges and steps; renderer highlights active step.
- Non-functional: Existing code language/theme/font controls continue working; PPTX remains static/readable.

## Architecture

Add optional authored `walkthroughSteps` and optional `defaultStepIndex` fields to `code`. Do not persist transient presenter `activeStepIndex`; keep runtime current step in UI/presenter state. MVP is static authored default highlight in editor/export; interactive presenter stepping is a later enhancement. Renderer splits code into line wrappers for highlight. Shared HTML export preserves step metadata or static default state.

## Related Code Files

- Modify: `client/src/components/properties/code-properties.jsx`
- Modify: code canvas renderer path
- Modify: `shared/src/element-renderers.js`
- Modify: `client/src/utils/export-pptx-basic-renderers.js` only if static policy needs warning
- Test: code properties, renderer, shared export, PPTX policy, matrix rows

## Implementation Steps

1. Write failing property tests for adding/removing walkthrough steps.
2. Write failing renderer tests for line range highlighting.
3. Implement minimal line wrapper renderer.
4. Add shared export/static policy tests and PPTX warning tests when `walkthroughSteps` exists.
5. Update matrix evidence.

## Success Criteria

- [x] Author can define step label and line range.
- [x] Canvas highlights active range.
- [x] HTML export remains readable.
- [x] PPTX output remains readable and emits a structured warning when walkthrough semantics are dropped.
- [x] Autosave does not churn due to transient active step changes.

## Risk Assessment

Risk: renderer complexity. Mitigation: support line ranges first; defer diff mode unless trivial.

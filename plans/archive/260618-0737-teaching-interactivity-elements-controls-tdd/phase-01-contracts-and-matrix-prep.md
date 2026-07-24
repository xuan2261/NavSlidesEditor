---
phase: 1
title: "Contracts And Matrix Prep"
status: completed
priority: P1
effort: "1-2d"
dependencies: []
---

# Phase 01: Contracts And Matrix Prep

## Overview

Define testable contracts before feature code. This phase prevents false green delivery without making the repository-wide matrix gate fail for intentionally pending future features.

## Requirements

- Functional: Add expected-control inventory entries using existing canonical elements only: Mermaid and STEM under `html`, live poll/word-cloud/matching under `game`, walkthrough under `code`, LaTeX UX under `latex`, symbol packs under `svg`/`icon`/`shape`.
- Non-functional: No runtime behavior changes; no new canonical element type.

## Architecture

Use the existing element-control audit matrix as the source of truth. Each planned control gets a surface decision: `editor`, `canvas`, `html-export`, `pptx-export`, or explicit out-of-scope.

## Related Code Files

- Modify: `scripts/feature-inventory/*`
- Modify: `package.json` only if matrix scripts need a narrow helper
- Modify: tests near `scripts/feature-inventory/`

## Implementation Steps

1. Write failing tests for missing expected-control inventory entries and reject non-canonical rows such as `mermaid.*`, `poll.*`, or `stem-simulation.*`.
2. Do not add passing placeholder matrix rows for unimplemented future behavior.
3. Add feature-phase tests that require matrix evidence to be added with real implementation.
4. Add export warning contract test scaffolds for HTML/live/PPTX fallback features.

## Success Criteria

- [x] Expected-control inventory knows every feature before implementation using canonical row mapping.
- [x] No feature can ship without editor/canvas/export decision.
- [x] New rows do not claim `works` before behavior exists.

## Risk Assessment

Risk: matrix scope balloons. Mitigation: add rows only for user-visible controls, not internal metadata.

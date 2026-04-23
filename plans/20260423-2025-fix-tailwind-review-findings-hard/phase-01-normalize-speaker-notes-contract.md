---
phase: 1
title: "Normalize Speaker Notes Contract"
status: completed
priority: P1
effort: "2h"
dependencies: []
---

# Phase 1: Normalize Speaker Notes Contract

## Overview

Make `Slide.notes` the only canonical speaker-notes field across load, save, AI flows, render, and export. Keep `speakerNotes` as legacy input alias only.

## Requirements

- Functional: legacy slides with `speakerNotes` normalize to `notes`; API responses and client saves strip `speakerNotes`.
- Non-functional: preserve existing slide data; no migration file needed for JSON store.

## Related Code Files

- Modify: `shared/src/slideNotes.js`, `shared/src/htmlGenerator.js`, `server/routes/presentations.js`, `server/routes/templates.js`, `server/routes/ai.js`
- Modify: `client/src/pages/EditorPage.jsx`, `client/src/components/AITranslateModal.jsx`, `client/src/utils/exportPptx.js`
- Tests: `client/src/utils/slide-notes.test.js`, `tests/e2e/properties-panel.spec.js`

## Implementation Steps

1. Reuse shared helpers `getSlideNotes`, `normalizeSlideNotes`, `normalizePresentationNotes`.
2. Normalize on server create/update/get/template paths before persistence or response.
3. Read only canonical notes in HTML/PPTX export after normalization.
4. Update AI generate/translate client flow to write `notes`, never `speakerNotes`.
5. Add tests for legacy alias migration, AI notes apply, persistence, Reveal notes, and PPTX notes.

## Success Criteria

- [x] API save/load strips `speakerNotes` when normalized.
- [x] Editor reload keeps speaker notes.
- [x] Export paths use `slide.notes`.
- [x] Unit and E2E notes regressions pass.

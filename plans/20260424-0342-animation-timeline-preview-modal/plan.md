---
title: "Animation Timeline Preview Modal"
description: "Replace Timeline Preview's present-mode shortcut with a real current-slide fragment preview modal."
status: completed
priority: P1
created: "2026-04-24T03:42:00+07:00"
createdBy: "ck:cook --tdd"
tags: [editor, animation, preview, fragments, tdd]
---

# Animation Timeline Preview Modal

## Overview

Implement a real preview flow for Animation Timeline. The Preview button must stop opening full present mode and instead open an in-editor modal with an iframe that renders only the current slide and allows fragment-by-fragment playback.

## Phases

| Phase | Name | Status | Gate |
|-------|------|--------|------|
| 1 | [Preview Modal And Step Logic](./phase-01-preview-modal-and-step-logic.md) | Completed | Modal previews current slide only and fragment stepping works |

## Dependencies

- Reuse `useRevealPreviewFrame` for iframe/deck control
- Reuse `generateRevealHTML` for reveal.js rendering
- Keep `Present` button behavior unchanged

## Verification

- `npm run test -- AnimationPreviewModal`
- `npm run test -- animation-preview-helpers`
- `npm run lint`
- `npm run build`

## Unresolved Questions

- None.

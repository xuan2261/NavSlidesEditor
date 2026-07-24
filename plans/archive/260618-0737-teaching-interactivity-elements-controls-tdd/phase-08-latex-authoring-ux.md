---
phase: 8
title: "LaTeX Authoring UX"
status: completed
priority: P2
effort: "1-2d"
dependencies: [1]
---

# Phase 08: LaTeX Authoring UX

## Overview

Improve the existing LaTeX editor with snippets, symbol palette, and parse/error feedback.

## Requirements

- Functional: Insert common symbols/templates; show errors without losing content.
- Non-functional: No new math engine; TikZ support unchanged.

## Architecture

Extract small palette/snippet components and data. Reuse current LaTeX modal preview path. Use KaTeX error handling for non-TikZ formulas; keep TikZ rendering behavior as-is.

## Related Code Files

- Modify: `client/src/components/LatexEditorModal.jsx`
- Create: `client/src/components/latex-symbol-palette.jsx`
- Create: `client/src/data/latex-snippets.js`
- Test: content editor modal tests, LaTeX property tests, matrix rows

## Implementation Steps

1. Write failing tests for symbol insertion at cursor.
2. Write failing tests for snippet insertion and save/cancel preservation.
3. Add parse/error feedback test.
4. Implement extracted palette under file-size limit.
5. Update matrix evidence.

## Success Criteria

- [x] Common symbols/templates available.
- [x] Invalid formula shows friendly error.
- [x] Save/cancel behavior unchanged.
- [x] Existing TikZ examples still render.

## Risk Assessment

Risk: modal file grows too large. Mitigation: extract palette/snippet component and data.

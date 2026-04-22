---
phase: 4
title: 'Refine Panel Spacing'
status: complete
priority: P2
effort: '2h'
dependencies: []
---

# Phase 04: Refine Panel Spacing

## Overview

The right-hand Properties Panel suffers from inconsistent padding, margin, and cramped inputs. The Tailwind migration stripped some of the finer spacing details, resulting in a UI that feels squashed and difficult to read.

## Requirements

- Functional: Input fields, labels, and sections within the Properties Panel must be clearly delineated with adequate whitespace.
- Non-functional: The spacing rhythm must adhere to standard Tailwind spacing scales (e.g., `p-4`, `gap-2`, `space-y-4`).

## Architecture

- Systematically audit the `PropertiesPanel` component tree to apply consistent flexbox layouts and spacing utilities.

## Related Code Files

- Modify: `client/src/components/PropertiesPanel.jsx`
- Modify: `client/src/components/ui/` (Input, Select, Label components if needed)

## Implementation Steps

1. Open `PropertiesPanel.jsx`.
2. Add consistent padding to panel sections (e.g., `p-4` or `p-3`).
3. Ensure form groups use `flex flex-col gap-1.5` or `space-y-1.5` for label-to-input spacing.
4. Ensure distinct sections (e.g., Background, Text Properties) are separated by `border-b border-border` and adequate vertical margins (`py-4`).
5. Verify that inputs have sufficient horizontal padding (`px-2 py-1`) so text isn't flush against the borders.

## Success Criteria

- [x] Properties Panel sections are visually distinct and un-cramped.
- [x] Labels align correctly with their corresponding inputs.
- [x] Overall layout feels "breathable" and professional.

## Risk Assessment

- Risk: Increasing padding too much might cause the panel to require excessive vertical scrolling.
- Mitigation: Use compact but legible spacing (e.g., `text-sm` or `text-xs` for labels, and `gap-2` instead of `gap-4` for tight groups).

---
phase: 3
title: 'Implement Mock Data'
status: completed
priority: P1
effort: '2h'
---

# Phase 3: Implement Mock Data

## Overview

Inject mock template data matching the new categories into the backend or data provider to populate the gallery.

## Requirements

- Functional: API must return templates covering all new categories (Pitch Deck, Strategy, Dark Mode, etc.) so the gallery is not empty.
- Non-functional: Fast loading.

## Architecture

- Update the mock database returned by `/api/marketplace/templates`.

## Related Code Files

- Modify: Data source for `/api/marketplace/templates` (could be in `server/` or a mock JSON file in `client/`).

## Implementation Steps

1. Locate the data source for `/api/marketplace/templates`.
2. Add new mock templates for `Pitch Deck`, `Company Profile`, `Dark Mode Tech`, `Minimalist Report`, etc.
3. Assign appropriate tags and difficulty levels to the new mock templates.
4. Ensure existing templates are mapped to the new `domains` categories (e.g. `Khoa học Kỹ thuật`).

## Success Criteria

- [x] Gallery is populated with at least 1-2 templates per new category.
- [x] Badges correctly render for the mock templates.

## Risk Assessment

- Finding the correct mock data source. Mitigation: Use `grep_search` to find where the API endpoint is defined or mocked.

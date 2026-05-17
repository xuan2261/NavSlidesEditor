# Phase 4: Editor Features

**Priority:** P1
**Status:** pending
**Effort:** 10-14h
**Upstream Commits:** `ce548c53`, `31d8ffbe`, `916a63df`

---

## Context Links

- [Brainstorm Report](../260516-1200-upstream-v2-comprehensive-port-brainstorm/upstream-v2-port-audit-and-brainstorm-report.md) — Section 3.5
- [Overview Plan](hybrid-upstream-port-overview-plan.md)

## Overview

Port 3 editor features: line-arrow shape, video from URL, and file browser. These are independent features that can be implemented in any order.

## Key Insights

- **Line-arrow**: Local already has `line` element type with `LineArrowRenderer` — evaluate if upstream `line-arrow` adds value or is redundant
- **Video from URL**: Simple change — add URL input option to Toolbar media dropdown
- **File browser**: Larger change — needs new API endpoint + UI modal. Local already has `MediaLibraryModal.jsx` — evaluate if upstream file browser should replace or supplement it

## Related Code Files

### Files to modify:
- `shared/src/shapeUtils.js` — add `line-arrow` to SHAPES (if needed)
- `client/src/components/Toolbar.jsx` — video from URL button
- `client/src/pages/EditorPage.jsx` — file browser button/modal
- `server/index.js` — new API endpoint for listing uploads (if needed)

### Files to read for context:
- `shared/src/shapeUtils.js` lines 1-30 (SHAPES array)
- `client/src/components/canvas/element-renderers/line-element-renderer.jsx` (existing line renderer)
- `client/src/components/Toolbar.jsx` lines 1-50 (imports, structure)
- `client/src/pages/EditorPage.jsx` lines 1-50 (structure)
- `client/src/components/MediaLibraryModal.jsx` (existing media library)

## Implementation Steps

### Step 1: Line-arrow shape evaluation (`ce548c53`)
1. Read existing `line-element-renderer.jsx` to understand current line capabilities
2. Read `shared/src/shapeUtils.js` SHAPES array
3. If `line` element already provides arrow functionality → document as "already covered, skip"
4. If `line-arrow` adds distinct value → add to SHAPES array and canvas renderer

### Step 2: Video from URL (`31d8ffbe`)
In `Toolbar.jsx`, add to the Media dropdown:
```jsx
<button onClick={() => {
  const url = window.prompt('Enter video URL:')
  if (url) onAddVideo({ src: url, type: 'video' })
}}>
  Video from URL
</button>
```
Also add URL validation (must be valid URL format).

### Step 3: File browser — evaluate existing solution
1. Read `MediaLibraryModal.jsx` to understand current media browsing
2. Compare with upstream's file browser (thumbnail grid, type filtering, URL copy)
3. Decision: enhance existing `MediaLibraryModal` or create new component

### Step 4: File browser — API endpoint (if needed)
If upstream's `GET /api/presentations/:id/uploads` endpoint is needed:
1. Check if `server/index.js` already has an uploads listing endpoint
2. If not, add route that reads `server/uploads/` directory and returns file list with metadata

### Step 5: File browser — UI (if needed)
If creating new file browser component:
1. Create modal with thumbnail grid
2. Filter by type (All, Image, Video, Audio)
3. Click to copy URL to clipboard
4. Integrate into EditorPage header

## Todo List

- [ ] Evaluate line-arrow vs existing line element
- [ ] Add line-arrow shape (if needed)
- [ ] Add video from URL button to Toolbar
- [ ] Add URL validation for video URL input
- [ ] Evaluate existing MediaLibraryModal vs upstream file browser
- [ ] Add uploads listing API endpoint (if needed)
- [ ] Add file browser UI (if needed)
- [ ] Run `npm run test` — all pass
- [ ] Manual: verify line-arrow shape renders in editor and present mode
- [ ] Manual: verify video from URL works (playback, trim, properties)
- [ ] Manual: verify file browser shows uploaded files

## Success Criteria

- Line-arrow shape available in shape picker (or documented as covered by existing line element)
- Video can be added by URL without uploading a file
- File browser accessible from editor (or existing MediaLibraryModal enhanced)
- All tests pass

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Line-arrow duplicates existing line element | Low | Evaluate first, skip if redundant |
| Video URL validation too strict/loose | Low | Test with common video hosting URLs |
| File browser conflicts with existing MediaLibraryModal | Medium | Evaluate before implementing — may enhance existing |
| New API endpoint security | Medium | Validate presentation ownership before listing uploads |

## Security Considerations

- File browser API must verify user owns the presentation before listing uploads
- Video URL input must validate URL format to prevent XSS
- File browser must not expose files from other presentations

## Verification Commands

```bash
npm run test 2>&1 | tail -10
# Manual tests:
# 1. Open shape picker → verify line-arrow (or equivalent) available
# 2. Insert video → choose "from URL" → enter URL → verify playback
# 3. Open file browser → verify uploaded files shown → click to copy URL
```

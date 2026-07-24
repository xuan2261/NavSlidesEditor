# Phase 02: Video Enhancements — URL, Trim, Speed

**Priority:** P1 | **Effort:** Low | **Status:** Complete

---

## Context

- Source: parallax commits `31d8ffb` (video URL), `a388d35` (trim), `f7a3a35` (speed + .ogv)
- NavSlidesEditor already has video element support (upload + render)
- Need to add: video from URL, start/end time trimming, playback speed control

---

## Requirements

### Functional
- Video element accepts URL input (not just file upload)
- Start time / end time controls for trimming playback
- Playback speed selector (0.25x, 0.5x, 1x, 1.25x, 1.5x, 2x)
- .ogv video format support in upload accept list
- URL video stored as `videoUrl` property on element

### Non-functional
- Trim controls use native HTML5 `video.currentTime` API
- Speed uses native `video.playbackRate`

---

## Files to Modify

| File | Change |
|------|--------|
| `client/src/pages/EditorPage.jsx` | Add `handleAddVideoUrl()` handler |
| `client/src/components/PropertiesPanel.jsx` | Add URL input, trim start/end, speed controls for video elements |
| `client/src/components/Toolbar.jsx` | Add "Video from URL" button alongside existing video upload |
| `client/src/components/SlideCanvas.jsx` | Apply `playbackRate` and `currentTime` constraints on video render |
| `shared/src/element-renderers.js` | Render `videoUrl` as `<video src="...">`, apply trim/speed attrs |

---

## Implementation Steps

### Step 1: Add videoUrl property to element model
In EditorPage `handleAddVideo` and new `handleAddVideoUrl`:
```js
// New handler
const handleAddVideoUrl = (url) => {
  const newElement = {
    id: crypto.randomUUID(),
    type: 'video',
    videoUrl: url,
    x: 100, y: 100, width: 480, height: 270,
    zIndex: 2,
    trimStart: 0,
    trimEnd: 0,
    playbackSpeed: 1,
  }
  // add to current slide elements
}
```

### Step 2: PropertiesPanel video controls
When element.type === 'video':
- Text input for video URL
- Number input for trim start (seconds)
- Number input for trim end (seconds)
- Dropdown for playback speed

### Step 3: Toolbar video URL button
Add "Video from URL" option in insert menu, prompts for URL via `window.prompt()` or modal

### Step 4: SlideCanvas video rendering
Apply `playbackRate` to video element ref, use `onLoadedMetadata` to set `currentTime` for trim start

### Step 5: element-renderers.js
Update `renderVideo()` to handle `videoUrl` property:
```js
if (el.videoUrl) {
  return `<video src="${el.videoUrl}" ${el.playbackSpeed !== 1 ? `playbackRate="${el.playbackSpeed}"` : ''} controls></video>`
}
```

---

## Tests

### Unit Tests
```js
// shared/src/video-element.test.js
import { describe, it, expect } from 'vitest'
import { renderVideo } from './element-renderers'

describe('renderVideo', () => {
  it('renders video from URL', () => {
    const el = { type: 'video', videoUrl: 'https://example.com/video.mp4' }
    const result = renderVideo(el, {}, () => '', () => '')
    expect(result).toContain('https://example.com/video.mp4')
  })

  it('renders uploaded video', () => {
    const el = { type: 'video', src: '/uploads/abc.mp4' }
    const result = renderVideo(el, {}, () => '', () => '')
    expect(result).toContain('/uploads/abc.mp4')
  })

  it('applies playback speed attribute', () => {
    const el = { type: 'video', videoUrl: 'test.mp4', playbackSpeed: 1.5 }
    const result = renderVideo(el, {}, () => '', () => '')
    expect(result).toContain('1.5')
  })
})
```

### Integration Test
1. Insert video from URL → verify it renders in canvas
2. Set trim start=5, trimEnd=30 → verify video plays from 5s to 30s in present mode
3. Set playback speed to 2x → verify video plays at 2x
4. Export to HTML → verify video URL persists in export

---

## Success Criteria

- [x] Video URL input available in PropertiesPanel
- [x] "Video from URL" insert flow available
- [x] Trim start/end controls functional
- [x] Playback speed dropdown/control functional
- [x] `.ogv` in upload accept list
- [x] Renderer/schema tests cover URL video, trim, speed, and `.ogv`
- [x] `npm run build` succeeds

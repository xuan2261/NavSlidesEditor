# Brainstorm Report: Anime.js Integration — NavSlides Editor

**Date:** 2026-04-28
**Author:** Claude Code (brainstorm session)
**Type:** Technical Decision — Animation Library Integration
**Status:** Planned (Phase H — Future Enhancement)

---

## 1. Problem Statement & Context

NavSlides Editor currently uses only Reveal.js 5.1.0 as its animation engine. The reveal.js powers:
- **Slide transitions** (6 types: none, fade, slide, convex, concave, zoom)
- **Fragment animations** (12 built-in CSS classes: fade-in/out, fade-up/down/left/right, grow, shrink, zoom-in, highlight colors)
- **Live presentation navigation** via `Reveal.slide()` + Socket.IO

The editor UI itself (React layer) uses only Tailwind CSS transitions. The live presentation viewer overlays (cursor, laser, annotations) use raw CSS `transition` properties with fixed timing.

The user requested evaluation of integrating [Anime.js](https://github.com/juliangarnier/anime) with requirements:
- **Không làm xáo trộn** — no disruption to existing architecture
- **Ưu tiên thấp** — enhancement only, not critical
- **Mức độ vừa** — moderate scope, controlled expansion

---

## 2. Anime.js Library Overview

| Aspect | Detail |
|---|---|
| Version | v4.3.6 (Feb 2026) |
| GitHub Stars | ~67.5k |
| License | MIT |
| Bundle Formats | ESM, UMD, CJS, IIFE |
| Install | `npm install animejs` |
| Core API | `import { animate, stagger } from 'animejs'` |
| Animates | CSS properties, SVG, DOM attributes, plain JS objects |
| Bundle Size | ~15KB gzipped (lean) |

**Pros:** Tiny footprint, clean minimal API, works across CSS/SVG/JS, 100% free, MIT license.

**Cons:** Fewer features than GSAP (no timeline rewinding, scroll triggers, drag built-in), smaller ecosystem, performance can lag behind GSAP on complex GPU-heavy scenes.

---

## 3. Evaluated Approaches

### Approach A: UI Editor Enhancement (AN TOÀN NHẤT — Zero Disruption)

**Idea:** Use Anime.js only in the React component layer (client), animate UI elements outside of reveal.js iframe.

**Targets:**
- Modal entrance/exit (slide+fade, scale, replacing Tailwind `animate-zoom-in`/`animate-fade-in`)
- Toolbar button hover stagger animations
- `AnimationTimeline` drag feedback (element snap on drop)
- `RemoteControlPage` button press feedback
- `LiveViewPage` cursor/laser (replace CSS `transition` with `animate()` + spring easing)

**Pros:** Completely isolated from reveal.js; no changes to HTML generation; straightforward install-and-use; significant UX improvement; minimal bundle size increase (~15KB).

**Cons:** Does not enhance presentation output animations (reveal.js fragments remain CSS-only).

**Risk:** Near zero. Only touches React component layer.

---

### Approach B: Live Presentation Overlay Enhancement (AN TOÀN — Controlled)

**Idea:** Use Anime.js specifically for live presentation overlay animations on the viewer side.

**Targets:**
- Cursor dot with spring physics (replacing `transition: all 0.08s linear`)
- Laser pointer with radial glow pulse effect (replacing `transition: all 0.05s linear`)
- Annotation SVG path drawing animation (stroke animation via anime.js)
- Viewer count badge entrance/exit animations
- Connection status transitions

**Pros:** Directly improves the core live presentation experience; viewer-side React components completely isolated from reveal.js iframe; Socket.IO data flow unchanged.

**Cons:** Only affects viewer-side; annotation path drawing needs additional coordination logic.

**Risk:** Low. Isolated to `LiveViewPage.jsx` + new hook.

---

### Approach C: Fragment Animation Extension (VỪA PHẢI — Needs Care)

**Idea:** Inject Anime.js into generated reveal.js HTML to extend fragment animation capabilities inside presentations.

**Targets:**
- Custom element entrance animations beyond 12 built-in reveal.js fragment types
- SVG path drawing animations for shapes
- Chart/data element animations
- Element exit animations (currently limited to fade-out)

**Implementation:** Inject Anime.js script tag into `shared/src/htmlGenerator.js`, create custom reveal.js fragment callbacks that invoke `anime()` instead of relying on CSS, map new `fragmentAnimation` values to Anime.js config objects.

**Pros:** Expands animation palette from 12 to 30+ types; precise control over timing/easing/chaining.

**Cons:** Requires changes to `shared/src/htmlGenerator.js`; backward compatibility risk with existing presentations; increases generated HTML size; harder to debug; complexity exceeds "enhancement" scope per user request.

**Risk:** Medium — needs regression testing across all existing presentations.

---

## 4. Recommended Solution: Combined A + B

**Chosen approach:** Combination of Approach A and Approach B.

**Rationale:**
- Matches user's stated requirements: "không làm xáo trộn", "ưu tiên thấp", "mức độ vừa"
- Approach A provides UX improvement across the entire editor UI
- Approach B directly enhances the live presentation feature (a core differentiator of NavSlides Editor)
- Combined approach stays within "moderate scope" — two isolated hooks, no reveal.js modifications
- Zero disruption to existing presentation output or fragment system
- Phased: can implement A first, then B, or both together

**NOT recommended:** Approach C — complexity exceeds the stated scope, requires modifying `htmlGenerator.js`, and introduces backward compatibility risks. Defer to a future phase if user validates demand from actual users.

---

## 5. Implementation Architecture

```
client/
├── package.json              # Add animejs dependency
└── src/
    └── hooks/
        ├── use-anime-ui.js       # NEW: Editor UI animations
        │   └── animate: modals, toolbar hover, timeline drag
        └── use-anime-overlays.js # NEW: Live presentation overlays
            └── animate: cursor (spring), laser (glow), annotations (path draw)
```

**Integration pattern (use-anime-ui):**
```js
// Example: modal entrance
import { animate } from 'animejs'
useEffect(() => {
  animate(modalRef.current, {
    opacity: [0, 1],
    scale: [0.9, 1],
    duration: 300,
    easing: 'easeOutExpo',
  })
}, [isOpen])
```

**Integration pattern (use-anime-overlays):**
```js
// Example: cursor with spring
import { animate } from 'animejs'
useEffect(() => {
  const anim = animate(cursorRef.current, {
    left: `${x * 100}%`,
    top: `${y * 100}%`,
    easing: 'spring',
    duration: 150,
  })
  return () => anim.pause
}, [x, y])
```

**No changes to:**
- `shared/src/htmlGenerator.js`
- `shared/src/element-renderers.js`
- `TransitionPreview.jsx`
- `AnimationTimeline.jsx`
- Reveal.js fragment system
- Socket.IO data flow

---

## 6. Files to Modify

| File | Change |
|---|---|
| `client/package.json` | Add `animejs` dependency |
| `client/src/hooks/use-anime-ui.js` | NEW — editor UI animation hook |
| `client/src/hooks/use-anime-overlays.js` | NEW — live overlay animation hook |
| `client/src/pages/LiveViewPage.jsx` | Replace CSS cursor/laser transitions with `useAnimeOverlays` |
| `client/src/pages/RemoteControlPage.jsx` | Add button press feedback via `useAnimeUI` |
| Modal components | Integrate `useAnimeUI` for entrance/exit |
| `AnimationTimeline.jsx` | Optional: drag feedback via `useAnimeUI` |

---

## 7. Success Metrics

- All existing tests pass (510 unit + 127 E2E)
- No regressions in presentation HTML generation
- Live presentation cursor/laser animation smoothness > 60fps
- Modal entrance/exit animations feel natural (no jank)
- Bundle size increase < 20KB gzipped
- Reveal.js fragment system unaffected

---

## 8. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Bundle size bloat | Low | Low | Anime.js is ~15KB gzipped; tree-shake unused features |
| Reveal.js conflict | Very Low | High | Anime.js only touches React layer; reveal.js iframe is sandboxed |
| Backward compatibility | Very Low | Low | Approach C deferred; A+B don't touch generated HTML |
| Test regression | Low | Low | Existing tests cover reveal.js output; new hooks isolated |

---

## 9. Unresolved Questions

- Should `animejs` be a runtime dependency or devDependency? (Runtime — needed at client execution)
- Should we use CDN injection for `animejs` in generated HTML (Approach C path), or just npm import in client? (npm import — aligns with approach A+B)
- Do users actually request richer fragment animations? If yes, Approach C becomes more justified

---

## 10. Next Steps

1. **Approve this report** — confirms Phase H scope
2. **Create implementation plan** via `/ck:plan` when ready to execute
3. **Execute Phase H** — install animejs → create hooks → migrate cursor/laser → enhance modals
4. **Verify** — run test suite, verify live presentation smoothness
5. **Document** — update `docs/project-changelog.md` with Phase H completion

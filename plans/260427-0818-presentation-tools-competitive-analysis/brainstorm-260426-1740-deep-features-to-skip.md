# Deep Technical Analysis: Features to SKIP for NavSlidesEditor

**Author:** brainstormer subagent
**Date:** 2026-04-26

---

## 1. Real-time Multi-user Collaboration

### What It Is
Simultaneous editing by multiple users on the same presentation in real-time. Requires conflict resolution (CRDTs or OT), presence awareness, and a sync infrastructure layer.

### Technical Reality
Building real-time collaboration is NOT adding WebSockets and being done. Yjs is the best open-source option but requires migrating the entire Zustand store to Y.Doc + Y.Map + Y.Array, custom bindings for all 17 element types, a persistence provider, and awareness protocol. Open-source slide tools avoid this because the state model is far more complex than rich text.

### Why SKIP
1. Architecture mismatch: file-lock persistence cannot support distributed writes
2. Scope explosion: 17 element types, each with 10-20 mutable properties
3. Identity conflict: privacy-first, no-account model conflicts with multi-user collab
4. Cost: 3-6 months of dedicated engineering

### Moderate Alternative
Async collaboration via shareable links with edit tokens - changes sync on page reload.

### Verdict
**SKIP indefinitely.**

---

## 2. AI Vibe Editing

### What It Is
Natural language commands that modify presentations in-place.

### Technical Reality
The LLM must have full slide state, generate valid data model edits, preserve layout integrity, and handle undo. Non-deterministic output means users cannot predict results.

### Why SKIP
1. Non-deterministic UX - undo complexity multiplies
2. Data model coupling - any refactor breaks the AI layer
3. Existing AI features (copywriting, translation, media) are sufficient

### Moderate Alternative
AI Assistant Panel with narrow scope: text-to-content, AI rewrite selected text, AI image search.

### Verdict
**SKIP for vibe editing. Keep AI Assistant Panel with narrow, reversible commands.**

---

## 3. Zone-Based AI Redraw

### What It Is
User draws a bounding box and asks AI to regenerate that area.

### Technical Reality
Slide elements are structured data, not pixels. Image inpainting operates on rasterized pixels. Cannot inpaint chart type changes without data extraction first.

### Why SKIP
1. Structured data vs. raster mismatch
2. High API cost per zone redraw
3. No existing infrastructure

### Moderate Alternative
AI Background Style Transfer - one-click regenerate slide background.

### Verdict
**SKIP.**

---

## 4. Plugin/Extension Marketplace

### What It Is
A marketplace for third-party plugins.

### Technical Reality
Even the minimum viable plugin system requires sandboxing, manifest management, DOM access control, and is a separate product. The app just hardened XSS protection.

### Why SKIP
1. Security minefield
2. API stability burden
3. Marketplace is a separate product

### Moderate Alternative
Built-in Extension Points - Tiptap extensions, PR contributions, template gallery.

### Verdict
**SKIP indefinitely.**

---

## 5. Mobile/Tablet Editing

### What It Is
Mobile-native editor for touch devices.

### Technical Reality
Every interaction needs touch-specific implementation - full rewrite of the interaction layer. Figma explicitly deprioritizes mobile editing.

### Why SKIP
1. Full rewrite of interaction layer
2. Feature parity impossible on touch
3. Platform fragmentation
4. 80%+ of editing on desktop

### Moderate Alternative
Mobile Presentation Mode via /live/:roomCode.

### Verdict
**SKIP for editing. Enhance presentation mode for mobile viewing.**

---

## 6. TypeScript Full Migration

### What It Is
Full TypeScript migration with compile-time checking.

### Technical Reality
4-8 months of work. JSDoc + ts-check already catches 80% of type errors.

### Why SKIP
1. Diminishing returns - 80% coverage already achieved
2. Wrong project phase - Phase C is current priority
3. Cost > benefit

### Moderate Alternative
Incremental: convert shared/ package first (2-3 weeks, 90% benefit).

### Verdict
**SKIP full migration. Pursue incremental conversion.**

---

## 7. Cloud SaaS Version

### What It Is
Hosted, managed version with accounts.

### Technical Reality
Full auth, multi-tenancy, PostgreSQL, S3 storage, CDN, email, Stripe, GDPR. 140-470 USD/month minimum. Directly conflicts with entire unique selling proposition.

### Why SKIP
1. Brand suicide
2. Full second product
3. Crowded market

### Moderate Alternative
One-click deploy to Railway/Render/Fly.io.

### Verdict
**SKIP indefinitely.**

---

## 8. Multi-Format Canvas

### What It Is
Supporting WeChat, Xiaohongshu, Instagram formats.

### Technical Reality
Each format is a DIFFERENT PRODUCT. Supporting 10 formats is a full design system overhaul.

### Why SKIP
1. Format bloat
2. Wrong tool for the job
3. Scope creep trigger

### Moderate Alternative
Custom Aspect Ratio Support.

### Verdict
**SKIP indefinitely.**

---

## 9. Presentation Recording

### What It Is
Browser-based recording producing video.

### Technical Reality
MediaRecorder limitations: no H.264, 1080p max, high CPU, stops on background tab. OBS is free and better.

### Why SKIP
1. OBS is better and free
2. Browser limitations are fundamental
3. Feature overlap with existing exports

### Moderate Alternative
Slide-to-Video Export via ffmpeg or headless browser.

### Verdict
**SKIP. Use slide-to-video export.**

---

## Decision Matrix

| Feature | Skip? | Primary Reason | Alternative | Reversal Trigger |
|---|---|---|---|---|
| Real-time Collaboration | SKIP | Architecture re-eng | Async edit tokens | 3+ engineers, v2.0 |
| AI Vibe Editing | SKIP | Non-deterministic UX | AI Panel (narrow) | Vibe-editing API |
| Zone-Based AI Redraw | SKIP | Data mismatch | AI Background Transfer | Slide inpainting API |
| Plugin Marketplace | SKIP | Security minefield | Built-in extensions | Platform team |
| Mobile Editing | SKIP | UX paradigm change | Mobile Preso Mode | Mobile UX validated |
| TypeScript Migration | SKIP | 4-8 months, 20% gain | Incremental shared/ | Phase C complete |
| Cloud SaaS | SKIP | Brand suicide | One-click deploy | Dedicated team |
| Multi-Format Canvas | SKIP | Graphic design tool | Custom aspect ratio | New personas |
| Recording | SKIP | Browser limits | Slide-to-Video export | WebCodecs |

---

## Summary

All 9 features SKIPPED. Engineering bandwidth better spent on Phase C, D, E and bug fixes.

---

## Unresolved Questions

1. AI Panel boundary: precise scope of narrow reversible commands?
2. Slide-to-Video: ffmpeg or headless browser?
3. Custom aspect ratio: auto-scale or show warnings?
4. Async collab: last-write-wins or merge conflict UI?
5. TypeScript: timeline for Phase 2 (Zustand stores)?
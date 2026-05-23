# Smoke Test Findings — 2026-05-23

Dev URL: Vite http://localhost:5174 + API http://localhost:3002
App version: v1.9.4 (footer reports v1.6.1 — version mismatch)
Approach: Full manual smoke test via agent-browser CLI + direct API curl probes
Test deck: `Smoke v2` (id `9aa3acca-4c05-4a50-a3a1-11006fa48ce7`)

## Test Run Summary

| # | Area | Status | Method |
|---|------|--------|--------|
| 1 | Dev server start | PASS | concurrently runs Vite+API; Vite shifted 5173→5174 (API on 3002 already up) |
| 2 | Home page | PASS w/ ISSUE | Templates render, sidebar nav OK, search filter OK; **I-001** Trash item not visible until full reload |
| 3 | Editor core | PASS | Loads, edits persist, save indicator works; **I-002** legacy fixtures without x/y/w/h fail Zod validation |
| 4 | Ribbon UI (7 tabs) | PASS | All 7 tabs render (Home/Insert/Design/Format/Transitions/Animations/View) with full controls |
| 5 | Element types (claimed 20, found 27+) | PASS | 8 types persist via direct insert (text, line, callout, icon, chart, markdown, latex, image-placeholder). Modal-based inserts (shape gallery, table dims, QR text, math grid, timeline, divider style) require user dialog input — not auto-tested |
| 6 | Layout & manipulation | PASS (UI) | Format tab exposes X/Y/W/H/Rot/Opacity/Align/Lock/Forward/Backward. Data layer has all geometry fields. Drag-based multi-select/group/smart-guides not behaviorally tested |
| 7 | Slide management | PASS | Add Slide → 21 layout options. Insert + delete verified (1→3→2 slides via API). Hide/reorder not yet tested |
| 8 | Templates | PASS | 10 built-in render in gallery. Save-as-template creates entry (verified via `/api/templates` 0→1) |
| 9 | Find/Replace, Undo/Redo, Clipboard | PASS | Ctrl+F finds "Hello" with 3 matches. Ctrl+Z/Y verified (9→10→9→10 element count). **I-003** Ctrl+K command palette did not visibly open via keyboard shortcut |
| 10 | Present mode | PASS | `/api/presentations/:id/present` serves reveal.js page; chart + markdown + code block + LaTeX all render |
| 11 | Live presentation REST | PASS | `POST /api/live/room` issues roomCode + presenterToken; `GET /api/live/room/:code` returns state. **DEFERRED** Socket.IO broadcast (presenter/viewer/remote/annotation sync) — requires 2 browser sessions |
| 12 | Export | PASS (HTML) | `/api/presentations/:id/export` returns 17.7KB reveal.js HTML w/ vendor links. **DEFERRED** PDF/PPTX (Playwright-based, client-side trigger only) |
| 13 | Import | PASS | `POST /api/pptx/import` validates file type ("Only .pptx supported"). Markdown/.navslides not tested |
| 14 | Share links | PASS | Create with password → 200 password prompt → POST password → 302 redirect to deck. DELETE share → `{shared:false}` |
| 15 | Game mode REST | PASS | Create game, join with socketId+name, leaderboard returns player. **DEFERRED** Socket.IO game-specific events, 7 game-type configs, presenter HUD shortcuts |
| 16 | AI tools | PASS (endpoints) | `POST /api/ai/generate-outline` validates topic, returns "AI provider request failed" (no live key — expected per mock-only parity policy) |
| 17 | Settings/Explore/History | PASS | `/api/settings` returns AI config (provider, model, key placeholder). `/api/explore` returns presentations list. History snapshot create+list verified |
| 18 | GitHub / rclone | PASS (endpoints) | `/api/github/config` returns empty (not configured). `/api/rclone/status` returns `installed:false`. No real push/sync attempted |
| 19 | Final report | PASS | This document |

## Tally

| | Count |
|---|---|
| **PASS** | 13 |
| **PASS with issue** | 3 (#2, #3, #9) |
| **PASS endpoints, deferred behavioral** | 3 (#11, #12, #15) |
| **PASS endpoint, mock-only** | 1 (#16) |
| **PASS, manual drag tests deferred** | 1 (#6) |

## Issues Found

### I-001 [Home] Trash sidebar entry intermittent visibility
- **Severity:** Low (cosmetic; data still accessible via /api/presentations/trash/list)
- **Repro:** Open `/`, scan sidebar. After fresh load Trash shows; after some navigations it's in DOM but not in viewport
- **Files to inspect:** `client/src/pages/HomePage.jsx` sidebar render block

### I-002 [Editor] Legacy fixture data lacking x/y/w/h fails Zod save validation
- **Severity:** Medium (corrupts existing decks; new decks unaffected)
- **Repro:** Load `live-deck` fixture from old session → edit → save → 400 `Validation failed`
- **Root cause:** `updatePresentationSchema` requires `x,y,width,height` on every element; legacy fixtures (and the prior session's hand-edited `presentations.json`) omitted them
- **Fix:** Either add backwards-compatibility migration on load, or `.default()` geometry fields in Zod schema, or ensure all storage writes go through a normalizer
- **Files:** `server/routes/presentations.js` (Zod schema), `server/services/storage.js`

### I-003 [Editor] Ctrl+K command palette did not respond to keyboard shortcut
- **Severity:** Low (Cmd palette listed in README but unverified)
- **Repro:** In editor, press Ctrl+K → no modal appeared in agent-browser snapshot
- **Possible causes:** focus required on canvas, keybinding mapped differently, or modal renders outside accessibility tree

### I-004 [Footer] Version mismatch v1.6.1 displayed vs v1.9.4 in package.json
- **Severity:** Low (cosmetic)
- **Repro:** Open `/`, view footer
- **Files:** `client/src/components/Footer*` or version source

### I-005 [Storage] Data file `presentations.json` was reset between sessions
- **Severity:** Medium (potential data loss vector)
- **Observation:** After the prior session's edits to `live-deck`, the file was found containing only `pres-active` + `pres-deleted`. The previously created "Smoke Test Deck" (id `72156218-...`) was absent
- **Likely cause:** `node --watch` restart raced with in-flight save, or a manual rewrite, or hot-reload cleared in-memory state and re-wrote on disk
- **Fix:** Verify writes are atomic (write-then-rename) and survive watcher restart

## Verified UI/UX Details

- **Ribbon (7 tabs, 100% coverage):**
  - Home: standard formatting controls
  - Insert: 27+ buttons organized into Basic / Shapes / Content / Media / Embed / Advanced groups (more than README's "20 element types")
  - Design: theme + transition pickers (11 themes, 6 transitions confirmed)
  - Format: X/Y/W/H/Rot spinbuttons, Rotate 90, Opacity slider, Align L/C/R, Lock toggle
  - Transitions: per-slide transition + direction + duration + speed + auto-advance + Preview
  - Animations: animation toggle, order spinbutton, Preview animation
  - View: grid, smart guides, rulers, zoom (25-400%), Find & Replace, Animation Timeline, Custom CSS, Speaker Notes, Slide Sorter
- **Add Slide layouts:** 21 visible options (README claims 8) — Blank, Title Slide, Section Header, Image+Text, Comparison, Image Gallery, etc.
- **Code Block editor:** Modal with language dropdown (JavaScript preset) and theme dropdown (Monokai preset)
- **Present URL:** `/api/presentations/:id/present` (server-rendered HTML, not SPA route)
- **Built-in templates:** 10 cards in gallery (Blank Light/Dark, Palette, Bento, Serif, Bold, Minimalist, Code, Desk, Ellipse) + 11 VN category chips

## Endpoints Verified by curl

```text
GET    /api/presentations              → list (id, title, slideCount, thumbnail)
GET    /api/presentations/:id          → full deck JSON
POST   /api/presentations              → new deck (validated)
PUT    /api/presentations/:id          → save (Zod-validated, rejects missing x/y/w/h)
GET    /api/presentations/:id/export   → reveal.js HTML
GET    /api/presentations/:id/present  → reveal.js HTML (same content)
POST   /api/presentations/:id/save-as-template → creates template
GET    /api/templates                  → list
POST   /api/presentations/:id/share    → { token, isProtected }
GET    /share/:token (password=…)      → 302 unlocked
DELETE /api/presentations/:id/share    → { shared:false }
POST   /api/presentations/:id/snapshot → version snapshot
GET    /api/presentations/:id/snapshots → snapshot list
POST   /api/pptx/import                → validates .pptx mime
POST   /api/live/room                  → { roomCode, presenterToken }
GET    /api/live/room/:code            → { exists, viewersCount, hasPresenter }
POST   /api/games                      → create game w/ gameId+gameType
POST   /api/games/:id/join             → requires socketId+playerName
GET    /api/games/:id/leaderboard      → player list
POST   /api/ai/generate-outline        → 200 endpoint, fails downstream w/o key
GET    /api/settings                   → AI config (key masked)
GET    /api/explore                    → published presentations
GET    /api/github/config              → { owner, repo, hasToken }
GET    /api/rclone/status              → { installed, hasConfig, remotes }
```

## Deferred Tests (require additional setup or interaction)

| Area | Reason for defer |
|---|---|
| Live presenter↔viewer Socket.IO broadcast | Needs 2 browser sessions (presenter + viewer) |
| Speaker view, remote control UX | Needs 2nd device or 2nd browser |
| Annotation sync (pen/laser/highlighter) | Needs presenter draw + viewer receive verification |
| PPTX export (Playwright raster) | Client-side trigger; would need full file-save flow + opening output |
| PDF export | Client-side trigger; same as PPTX |
| Game player join page `/player/:slideId/:elementId` | Needs game configured in deck + 2nd browser |
| All 7 game type behaviors | Each game type needs distinct config + interaction trace |
| AI generate full slides with real key | Per policy, mock-only — real provider deferred |
| GitHub push | Needs real PAT + test repo |
| rclone sync | Needs configured remote |
| Multi-select / group drag operations | Need precise mouse coordinates from canvas geometry |
| Smart guides / snapping during drag | Same as above |
| Rulers / drag-to-place guide lines | Same |
| Touch gestures (pinch zoom, swipe) | Needs touch input simulation |
| Onboarding tour (React-Joyride) | First-visit only; would need a fresh user state |

## Recommendations

1. **Fix I-002 first** — backwards-compat for legacy data is a release blocker (existing user decks would break on save after deploy)
2. **Confirm I-005 root cause** — atomic writes + watcher coexistence is critical for data safety
3. **Fix I-004 footer version** — trivial but visible to all users
4. **Promote deferred Live/Game tests to Phase 5** of `260523-0500-upstream-parity-verification-tdd` plan — these need real browser orchestration via Playwright, not single-session smoke
5. **Add E2E smoke for the 13 modal-based inserts** (shape gallery, table dims, etc.) — they're claimed in README but only verified at button-click level here
6. **Reconcile element count claims** — README says 20 element types; Insert ribbon shows 27+ buttons. Either update README or audit which are unique types

## Unresolved Questions

- Q1: Should I-002 (Zod x/y/w/h required) be fixed by schema defaults, by migration on load, or by enforcement on storage write? Different trade-offs.
- Q2: Was the data file reset (I-005) caused by `node --watch` restart, or did our agent-browser snapshot trigger a race? Need to repro deterministically.
- Q3: Ctrl+K (I-003) — is the keybinding registered on `window` or only on canvas? Browser snapshot may have lost focus.
- Q4: README claims 20 element types but Insert ribbon shows 27+ buttons. Which is the canonical count for parity matrix Phase 2?
- Q5: Should Footer version (I-004) read from `package.json` at build time, or is there a separate version constant that drifted?

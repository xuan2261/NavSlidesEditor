# Agent Browser Visual Audit - 2026-05-30

Scope: exploratory visual QA with `ck:agent-browser` against running dev app.

Runtime:
- App: `http://localhost:5173`
- API: `http://localhost:3002`
- Viewports checked: `1366x768`, `1262x568` default headless, `390x844`
- Browser evidence: screenshots in this folder
- Console/page errors: no page errors; only Vite/React dev informational logs

## Coverage

- Home dashboard: search area, theme/settings/new controls, presentation cards, New Presentation modal.
- Editor desktop: onboarding, ribbon tabs, Insert, Shape Format, Design, Transitions, Animations, View, File menu, AI menu, Share menu/modal, slide panel, properties panel, timeline, find bar, status bar, present mode.
- Element operations: add text, open shape menu, add rectangle, select element, contextual panel/ribbon display, add slide layout.
- Insert matrix spot-check: text, shape, chart, table, code, markdown, LaTeX, QR, icon search/insert, HTML embed, drawing. Media Library was checked separately because it exposed performance issues.
- Share flow: open share menu, create share link, verify generated link row, verify embed code tab.
- File/export flow: Export PDF, Version History, Save to GitHub modal, Sync to Cloud modal, import attempts from Home.
- Live flow: Present Live, presenter view, viewer page, mobile remote control, speaker view.
- Game flow: Advanced Insert -> Games menu, 7 game buttons, Name Picker insertion, player join page.
- Media/image flow: image URL prompt, video URL prompt, audio upload button behavior, Media Library stress behavior.
- Pages: Settings and Explore desktop/mobile.
- Responsive: Home, New Presentation modal, Editor, Settings, Explore at `390x844`.

## Findings

### High - Mobile Home layout is not usable

Evidence: `mobile-home-390x844.png`

At `390x844`, the left navigation remains wide and fixed, leaving only a narrow strip of main content. Presentation cards are clipped to the right, the heading/control row is cramped, and the fixed footer overlaps visible content.

Impact: phone users cannot reliably browse or manage decks.

Repro:
1. Set viewport to `390x844`.
2. Open `/`.
3. Observe sidebar consumes most width and content is clipped.

### High - Mobile Editor layout hides the canvas and most editor controls

Evidence: `mobile-editor-390x844.png`, `mobile-editor-panels-hidden.png`

At `390x844`, the editor shows slide thumbnails and properties, but the main canvas is not practically visible. The ribbon collapses into a clipped top row with only a few controls visible. Status bar text/controls are cramped and partially clipped.

Impact: editing is effectively blocked on mobile-size screens.

Repro:
1. Set viewport to `390x844`.
2. Open `/editor/:id`.
3. Try using the ribbon/canvas/status controls.

### Medium - Low-height New Presentation modal clips primary actions

Evidence: `home-new-presentation-modal.png`, `home-new-presentation-modal-after-scroll.png`

At the default agent-browser viewport (`1262x568`), `Cancel` and `Create` sit below the visible viewport (`top ~= 661`, viewport height `568`) and page scroll does not expose them. At `1366x768`, actions are visible.

Impact: users on short laptop/browser windows may not be able to create a deck from the modal.

Repro:
1. Use a viewport around `1262x568`.
2. Open `/`, click `New Presentation`.
3. Try to scroll to `Create`; scroll does not reveal it.

### Medium - Find bar and Timeline can stack into a cluttered overlay state

Evidence: `editor-find-open.png`, `editor-timeline-open.png`, `editor-after-add-slide.png`

Opening Find and Timeline together leaves both active, covering the upper-right editor and bottom canvas. In this state, `Escape` did not clear all overlays, and clicking `Add Slide` did not immediately add a slide; it required closing Find and Timeline individually first.

Impact: mode confusion and blocked workflow in common editor tools.

Repro:
1. Open editor.
2. View tab -> Find.
3. View tab -> Timeline.
4. Press `Escape`, then try `Add Slide`.

### Medium - Contextual Shape Format tab appears but does not auto-activate after shape insertion

Evidence: `editor-after-add-rectangle.png`, `editor-shape-format-tab.png`

After adding a rectangle, the contextual tab changes to `Shape Format` and the element is selected, but the active ribbon remains `Insert`. User must click `Shape Format` manually to see shape controls. README says contextual format tab auto-activates on first selection.

Impact: feature works, but behavior contradicts advertised workflow and can make shape controls feel hidden.

Repro:
1. Open editor.
2. Insert -> Shape -> Rectangle.
3. Observe selected shape while active tab remains `Insert`.

### Medium - Media Library renders too much content and causes automation/read timeouts

Evidence: `after-media-library-timeout.png` attempted twice but screenshot timed out; DOM evidence via browser eval.

Opening Media Library succeeds, but the dialog rendered about `39,238` media/button nodes and `959,995` visible text characters in the tested local data set. `agent-browser snapshot` and screenshot timed out twice with connection read timeout. The app did not crash and `Escape` closed the modal, but the modal is likely not virtualized enough for large media libraries.

Impact: slow UI, accessibility tree bloat, browser automation instability, likely poor keyboard/screen-reader performance.

Repro:
1. Open editor with existing media library data.
2. Insert -> Open media library.
3. Try to snapshot/screenshot or inspect dialog; command times out.

### Medium - Advanced Insert controls are covered by the properties panel at normal desktop width

Evidence: `games-menu-click-result.png`, `editor-advanced-button-wide.png`, `games-panel-open-1600.png`

At `1262x568` and `1366x768`, the `More advanced insert options` button is present in the accessibility tree but its click target is covered by the right properties panel (`elementFromPoint` returned the properties panel). Clicks do not open the advanced menu. At `1600x900`, the same control opens correctly and shows `Games...` and `Animated Counter`.

Impact: users on common laptop/desktop widths cannot reach advanced insert controls such as Games from the ribbon.

Repro:
1. Set viewport to `1366x768`.
2. Open editor -> Insert.
3. Click `More advanced insert options`; no menu appears.
4. Set viewport to `1600x900`; click again and menu appears.

### Medium - Inserting Name Picker game creates a validation save failure

Evidence: `games-panel-open-1600.png`, `game-name-picker-inserted.png`

At `1600x900`, Advanced Insert -> Games opens and lists all 7 game types: Name Picker, Hot Potato, Jeopardy, Four Corners, Relay Race, Trivia, Scattergories. Clicking `Name Picker` adds a visible game element to the canvas, but autosave then shows `Save failed: Validation failed`; network log shows `PUT /api/presentations/:id` returned `400`.

Impact: game elements can appear editable locally but fail persistence, risking data loss after reload.

Repro:
1. Set viewport to `1600x900`.
2. Insert -> More advanced insert options -> Games...
3. Click `Name Picker`.
4. Observe game element appears and save status changes to validation failure.

### Medium - Home Markdown/PPTX import attempts hang browser session and do not create visible decks

Evidence: import attempts via `agent-browser upload` to Home import inputs; `server/data/presentations.json` checked afterward.

Uploading `tests/e2e/fixtures/sample.md` to the Markdown import input and `server/data/test-corpus/chart-bars-lines.pptx` to the PPTX import input caused subsequent browser read/screenshot/URL operations to time out. The API remained listening, but `server/data/presentations.json` did not show a newly imported presentation after either attempt.

Impact: import may leave users without success/failure feedback and can stall the browser session.

Repro:
1. Open Home.
2. Upload a Markdown file through the Markdown import input.
3. Repeat with a PPTX file through the PPTX import input.
4. Observe browser automation timeouts and no new persisted deck.

### Medium - Multiple inserted elements overlap at default positions

Evidence: `insert-more-advanced-options.png`, `insert-html-result.png`, `insert-qr-result.png`, `insert-chart-result.png`

Adding several element types in sequence places many of them around the same default coordinates. Chart, markdown, LaTeX, QR, code, icon, and HTML embeds visually pile up, making the slide hard to inspect and making the selected element unclear.

Impact: rapid insert workflows become visually confusing; users must manually separate every new element.

Repro:
1. Open editor.
2. Insert several elements sequentially: Chart, Code, Markdown, LaTeX, QR, Icon, HTML.
3. Observe overlapping default placement.

### Low - Footer overlays page content on mobile Settings/Explore/Home

Evidence: `settings-mobile-390x844.png`, `explore-mobile-390x844.png`, `mobile-home-390x844.png`

The fixed footer remains visible and overlays bottom content on mobile. On Settings, shortcut rows are hidden behind the footer. On Home, footer text wraps/chops over controls.

Impact: visual polish/accessibility issue; can block bottom content.

Repro:
1. Set viewport `390x844`.
2. Open `/settings`, scroll near bottom.
3. Observe footer overlap.

### Low - Audio upload button gives no visible response in this tested state

Evidence: `insert-audio-click-result.png`

Clicking `Audio / Upload` from the Insert ribbon produced no visible modal, prompt, file input in DOM, or canvas change during the tested state. By contrast, Image and Video opened URL prompts.

Impact: users may not know whether audio upload is unavailable, blocked, or waiting on a native file picker.

## Passed Checks

- Desktop Home dashboard renders and presentation cards/actions are reachable.
- New Presentation modal is usable at `1366x768`.
- Editor desktop ribbon tabs render without obvious overlap at `1366x768`.
- Insert ribbon shape menu opens; rectangle insertion works.
- Insert controls spot-check passed for chart, table, code, markdown, LaTeX, QR, icon insertion, HTML embed, and drawing.
- Image URL insertion opens a prompt and accepts `http://localhost:5173/favicon.png`.
- Video insertion opens a URL prompt with Cancel/OK controls.
- Games menu lists all 7 game types at `1600x900`.
- Player join page renders; empty submit keeps user on form; entering a name moves to waiting state.
- Shape selection shows handles and properties panel.
- Add Slide modal opens and adding a blank slide creates slide 2.
- Present mode opens at `/api/presentations/:id/present` and renders slide content.
- Share menu opens; create link flow succeeds; embed tab generates iframe code.
- Version History opens and saving a snapshot succeeds.
- Export PDF opens a PDF blob tab.
- Present Live creates room `9U9FC9`; presenter, viewer, mobile remote, and speaker pages render; remote Next moves viewer to slide 2.
- File menu and AI menu open at correct desktop positions.
- Save to GitHub modal opens with owner/repo/token/settings fields and disabled Push until configured.
- Sync to Cloud modal opens and reports rclone is not installed in the tested runtime.
- Settings desktop form is usable.
- Explore desktop/mobile layout is mostly usable except footer overlap.

## Artifacts

Important screenshots:
- `home-dashboard.png`
- `home-new-presentation-modal.png`
- `editor-home-clean.png`
- `editor-insert-tab.png`
- `editor-after-add-rectangle.png`
- `editor-find-open.png`
- `editor-timeline-open.png`
- `editor-share-link-final.png`
- `insert-chart-result.png`
- `insert-table-result.png`
- `insert-code-result.png`
- `insert-markdown-result.png`
- `insert-latex-result.png`
- `insert-qr-result.png`
- `insert-icon-inserted.png`
- `insert-html-result.png`
- `insert-drawing-result.png`
- `games-panel-open-1600.png`
- `game-name-picker-inserted.png`
- `player-join-page.png`
- `player-joined.png`
- `file-sync-to-cloud-modal.png`
- `file-save-to-github-modal.png`
- `version-history-modal-retake.png`
- `version-history-snapshot-saved.png`
- `export-pdf-after-click.png`
- `present-live-modal.png`
- `present-live-presenter-view.png`
- `live-viewer-9U9FC9.png`
- `remote-mobile-after-next.png`
- `speaker-view-9U9FC9.png`
- `present-mode.png`
- `mobile-home-390x844.png`
- `mobile-editor-390x844.png`
- `settings-mobile-390x844.png`

## Unresolved Questions

- Should mobile phone view be fully supported for editing, or should the app show a deliberate "tablet/desktop recommended" layout with focused viewing/import actions?
- Should contextual Format tabs always auto-activate on selection, or only when selection happens from the canvas rather than insert actions?
- Should game elements be allowed by the presentation validation schema, and is the 400 caused by missing/default game fields or stale API schema?
- Should Audio / Upload expose an in-app file picker/status message instead of relying only on native file chooser behavior?

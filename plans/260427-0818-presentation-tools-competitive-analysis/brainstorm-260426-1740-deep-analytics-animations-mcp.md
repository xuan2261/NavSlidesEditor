# Deep Technical Dive: Analytics, Per-Element Animations, MCP Integration

**Date:** 2026-04-26
**Author:** brainstormer agent
**Scope:** Feature A (Presentation Analytics), Feature B (Per-Element Animations), Feature C (MCP Server Integration)

---


## Feature A: Presentation Analytics

### 1. Current State

NavSlidesEditor already has a partial analytics pipeline:

- Backend (server/routes/analytics.js): Records totalViews and per-presentation events[] via recordView() called at GET /share/:token. Events capped at 200 entries. Stores { timestamp, token, referrer } per event.
- Storage: server/data/analytics.json -- JSON flat-file per presentation ID.
- API: GET /api/analytics/:id?token=X returns { totalViews, dailyViews, byToken, recentEvents }. Requires valid share token.
- Frontend: AnalyticsModal.jsx shows total views, daily bar chart, views-by-link breakdown, recent events list.

Critical gap: The Socket.IO live presenter script in generated HTML (server/index.js) captures slidechanged, fragmentshown, fragmenthidden events and broadcasts to viewers -- but these events are NEVER persisted. There is no watch-time tracking, no navigation pattern capture, no drop-off detection.

### 2. Research Findings

#### 2.1 What Data Is Available

| Data Point | Source | Currently Persisted |
|---|---|---|
| Share link views | /share/:token GET | Yes (count + timestamp) |
| Referrer per view | Same | Yes |
| Slide navigation order | Socket.IO navigate events | No |
| Time spent per slide | Client-side beacon | No |
| Fragment step progression | Socket.IO fragmentIndex | No |
| Live session end | Socket.IO end-presentation | No |
| Viewer drop-off | Socket.IO disconnect | No |

#### 2.2 What Users Actually Want

- How many people viewed my presentation? (basic -- already exists)
- Which slides do people drop off on? (needs per-slide time tracking)
- What is the average watch completion rate? (needs session start/end tracking)
- Which share link drives the most engagement? (needs by-token breakdown -- partial)
- How long do people spend on each slide? (needs beacon-based timing)
- What navigation patterns exist? (needs sequential data)

#### 2.3 Competitive Context

| Tool | Analytics Depth |
|---|---|
| gamma.app | Views, average watch time, completion %, drop-off slide |
| Tome | Views, time on slide heatmap, audience engagement score |
| Sendsteps | Views, average completion, slide-by-slide drop-off |
| NavSlidesEditor (current) | Views only |

### 3. Technical Approach

#### 3.1 Three Data Collection Pipelines

Pipeline 1 -- Share View Tracking (already exists, extend):

Extend server/data/analytics.json schema per presentation to include liveSessions[]. Each session record contains: sessionId, startTime, endTime, durationSec, viewToken, slidePath (array of indices), slideTime (map of slide index to seconds), and completionRate.

Pipeline 2 -- Live Session via Socket.IO (new):

Modify server/index.js inline Socket.IO script to POST session data on end-presentation or beforeunload. Track session UUID, start time, slide path, and per-slide dwell time by accumulating time spent on each slide between slidechanged events. Use navigator.sendBeacon for reliable delivery.

Pipeline 3 -- Client-Side Beacon (new):

For non-live exported HTML viewed standalone, add a lightweight beacon on page load: navigator.sendBeacon with presId, token, referrer, timestamp.

### 4. Data Model / API Design

#### 4.1 Extended Storage Schema

New fields per presentationId: liveSessions: SessionRecord[], slideTimeMap: { [slideIndex]: { avgSec, viewCount } }.

SessionRecord: { sessionId, startTime, endTime, durationSec, viewToken, slidePath: string[], slideTime: Object, completionRate }

#### 4.2 New API Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | /api/analytics/view | Record standalone HTML view via sendBeacon |
| POST | /api/analytics/session | Record live session data (end of session) |
| GET | /api/analytics/:id (extend) | Add avgWatchTime, completionRate, dropOffSlide fields |
| GET | /api/analytics/:id/heatmaps | Per-slide heatmap: avg time, % viewers who reached |
| DELETE | /api/analytics/:id | Clear analytics data (GDPR/compliance) |

### 5. UI/UX Considerations

#### 5.1 AnalyticsModal.jsx Enhancements

Current: total views + daily bar chart + by-link breakdown + recent events.

Upgrade to include:

1. Summary Cards Row: Total Views (keep), Avg Watch Time (new), Completion Rate (new), Live Sessions count (new)

2. Slide Heatmap (new): Horizontal bar chart, one bar per slide. Bar width = avg time. Color gradient green to red. Hover tooltip with slide stats.

3. Drop-off Chart (new): Line chart showing % viewers still watching at each slide. Red marker on peak drop-off.

4. Session Replay Table (new): Expandable rows per session. Date, duration, completion %, slide path preview. Click to expand: full slide path + time per slide.

5. Share Link Comparison (extend existing): Side-by-side metrics per token.

#### 5.2 UX Constraints

- Analytics data only accessible to presentation owner (share token match, already enforced)
- No PII collected -- only timestamps, referrer URLs, slide paths
- GDPR consideration: DELETE /api/analytics/:id endpoint needed
- Performance: heatmap O(sessions * slides) -- cache for datasets > 1000 sessions

### 6. Implementation Steps

1. Extend storage schema (server/services/storage.js): add liveSessions[] and slideTimeMap fields. Update read/write functions.

2. Add two new API endpoints (server/routes/analytics.js): POST /view beacon handler and POST /session session recorder.

3. Modify inline Socket.IO presenter script (server/index.js): add session tracking (UUID, start time, slide path, slide time accumulation). POST session data on end-presentation or beforeunload.

4. Add beacon to exported HTML (shared/src/htmlGenerator.js): inject navigator.sendBeacon on page load for standalone HTML exports.

5. Extend GET /api/analytics/:id: compute avgWatchTime, avgCompletionRate, dropOffSlide from liveSessions array.

6. Upgrade AnalyticsModal.jsx: add summary cards, heatmap, drop-off chart, session replay table.

7. Add DELETE /api/analytics/:id endpoint for data clearing.

### 7. Effort Estimate and YAGNI Assessment

| Dimension | Estimate |
|---|---|
| Backend complexity | Low-Medium |
| Frontend complexity | Medium |
| Effort | 1.5-2 weeks |
| YAGNI risk | MEDIUM -- analytics is useful but adds storage and complexity. Core editing is unaffected if skipped. |
| Priority | MEDIUM -- extends existing AnalyticsModal UI, needs backend data |
| Dependencies | None |
| Test surface | API unit tests for aggregation logic, modal rendering tests |

YAGNI: Most users want basic view counts (already works). Deep analytics serve power users and educators. Implement Pipeline 1 + 2 fully for v1.7, Pipeline 3 as stretch. Start with summary cards (avgWatchTime, completionRate) -- cheap and immediately actionable.

---


## Feature B: Per-Element Animations

### 1. Current State

NavSlidesEditor has fragment-level animations via AnimationTimeline.jsx:

- Model: Each element has el.fragment = true, el.fragmentIndex = N, el.fragmentAnimation = "fade-in"
- Available types (12): fade-in, fade-out, fade-up, fade-down, fade-left, fade-right, grow, shrink, zoom-in, highlight-red, highlight-green, highlight-blue
- Rendering: shared/src/element-renderers.js buildWrapperAttrs() outputs class="fragment {fragmentAnimation}" + data-fragment-index="{fragmentIndex}"
- Preview: AnimationPreviewModal.jsx + animation-preview-helpers.js for iframe-based preview
- Trigger: Reveal.js built-in fragment animations

Critical gap: All animations are reveal.js built-ins scoped to fragment visibility. There is no per-element animation that runs independently of fragment steps.

### 2. Research Findings

#### 2.1 Animation Taxonomy

PowerPoint-style animation model has three categories:

| Category | Purpose | Examples |
|---|---|---|
| Entrance | Element appears | Fly in, Fade, Zoom, Expand |
| Emphasis | Element draws attention while visible | Spin, Pulse, Grow/Shrink, Color change |
| Exit | Element disappears | Fly out, Fade out, Shrink, Collapse |
| Motion Path | Element moves along a path | Arc, Line, Custom Bezier |

Current NavSlidesEditor covers only Entrance (via fragment visibility). Emphasis and Exit are missing. Motion Path is out of scope.

#### 2.2 Technical Options

| Approach | Library | Pros | Cons |
|---|---|---|---|
| A. reveal.js built-in fragments | None | Zero dependency, already working | Limited to fade/grow/zoom; no emphasis/exit |
| B. CSS keyframes injection | None | Zero dependency, GPU-accelerated, works in every exported HTML | Requires per-animation CSS |
| C. GSAP | gsap npm | Most powerful; timeline control, motion paths | Adds ~60KB per export; overkill |
| D. Web Animations API | None (native) | Zero dependency, modern, good browser support | Slightly more verbose than CSS |
| E. Animate.css + class toggle | animate.css | Battle-tested, many animations | Adds CSS dependency |

Recommendation: Option B (CSS keyframes) for Entrance/Exit + Option D (Web Animations API) for Emphasis. Avoid GSAP.

#### 2.3 CSS Keyframes for Custom Animations

Example: Fly-in from left using a CSS animation that translates the element horizontally from -100px to 0 with a fade-in effect. Example: Spin animation that rotates the element 360 degrees. Example: Pulse animation that scales and opacity-flashes the element. These keyframes can be injected once into the HTML head and referenced by data-animation attribute on element wrappers.

### 3. Technical Approach

#### 3.1 New Element-Level Animation Model

Extend the BaseElement typedef in shared/src/types/presentation.js:

ElementAnimation type with entrance, emphasis, and exit animation properties. The existing fragment, fragmentIndex, and fragmentAnimation fields are preserved for fragment-step sequencing, while the new animation field handles per-element motion independently.

#### 3.2 CSS Keyframe Library

Create shared/src/animation-css.js exporting all keyframes: entrance animations (fly-left, fly-right, fly-up, fly-down, zoom-in, bounce-in, wipe-left), emphasis animations (spin, pulse, shake, bounce), and exit animations (fly-left-out, fly-right-out, fade-out, shrink-out, expand-out, slide-down-out).

#### 3.3 Injection into htmlGenerator.js

Inject the ANIMATION_CSS into the generated HTML head alongside reveal.js styles. Add utility classes for animation duration: anim-fast, anim-normal, anim-slow.

#### 3.4 Rendering per Element

Modify element-renderers.js buildWrapperAttrs() to add data-animation-entrance attribute and duration class when an element has animation properties.

### 4. Data Model / API Design

No new API endpoints needed. Animation data lives in the presentation JSON.

#### 4.1 Extended BaseElement

The ElementAnimation typedef adds entrance, entranceDelay, emphasis, emphasisDelay, exit, exitDelay, and duration properties to BaseElement.

#### 4.2 Animation Catalog

Entrance (10): fly-left, fly-right, fly-up, fly-down, fade-in, zoom-in, bounce-in, wipe-left, slide-up, pop-in.
Emphasis (5): spin, pulse, bounce, shake, glow.
Exit (6): fly-left-out, fly-right-out, fade-out, shrink-out, expand-out, slide-down-out.

### 5. UI/UX Considerations

#### 5.1 AnimationTimeline.jsx Enhancement

Transform the current 2-column layout into a 3-column design: element list, fragment sequence, and new animation panel. The animation panel per selected element: Entrance dropdown (10 options), Delay input (ms), Duration toggle (Fast/Normal/Slow), Emphasis dropdown (5 options), Exit dropdown (6 options, for last fragment step only).

#### 5.2 Preview Integration

Extend AnimationPreviewModal.jsx to handle entrance, emphasis, and exit animations as separate timeline phases.

#### 5.3 UX Constraints

- Add an animation density warning if >3 animated elements per slide
- Entrance animations should not conflict with fragment steps
- Performance: CSS animations are GPU-accelerated; keep total < 10 active at once
- Fallback: noscript users get static slides -- graceful degradation

### 6. Implementation Steps

1. Create shared/src/animation-css.js with all @keyframes definitions (~100 LOC).
2. Inject ANIMATION_CSS into htmlGenerator.js. Ensure no duplicate injections.
3. Extend shared/src/types/presentation.js with ElementAnimation typedef and animation field.
4. Update shared/src/element-renderers.js buildWrapperAttrs() for data-animation-entrance attribute.
5. Expand AnimationTimeline.jsx with 3-column layout: Animation panel.
6. Update element-defaults.js with animation field defaults (disabled by default).
7. Extend AnimationPreviewModal.jsx to preview entrance/emphasis/exit phases.
8. Test: verify all 21 animation types render correctly. No conflict with fragment animations.

### 7. Effort Estimate and YAGNI Assessment

| Dimension | Estimate |
|---|---|
| Backend complexity | None (client + shared only) |
| Frontend complexity | Medium-High (new UI panel + preview logic) |
| Effort | 2 weeks |
| YAGNI risk | MEDIUM-HIGH -- most presentations use fade-in for everything. Complex animations are a nice-to-have that adds UI surface area. |
| Priority | LOW-MEDIUM -- premium feature, build after Phase C decomposition |
| Dependencies | Phase C (SlideCanvas decomposition) |

YAGNI: Competitive analysis flagged this as DEFER. Existing 12 fragment animations cover 90% of use cases. Build the CSS keyframe library and htmlGenerator injection as infrastructure, then defer the AnimationTimeline UI enhancement to a later phase.

---


## Feature C: MCP Server Integration

### 1. Current State

NavSlidesEditor has zero MCP integration. The codebase is JavaScript (not TypeScript), uses JSON file storage, and exposes a REST API + Socket.IO for live presentation. There is no packages/mcp/ directory or any MCP-related code.

From the competitive analysis: MCP was flagged as SKIP for v1.x -- too niche. This assessment remains valid, but a deep technical dive is warranted for planning purposes.

### 2. Research Findings

#### 2.1 MCP Protocol Basics

MCP (Model Context Protocol) is Anthropics open standard for connecting AI agents to external tools. Key concepts:

- Transports: stdio (for Claude Desktop CLI integration) and Streamable HTTP (for production/server deployments)
- Features: Tools, Resources, Prompts
- SDK: @modelcontextprotocol/sdk for Node.js / TypeScript
- Registry: mcp.so, smithery.ai for discovering existing servers

#### 2.2 What MCP Would Enable

An AI agent (Claude Desktop, Claude Code, any MCP-compatible agent) could:
1. Read existing presentations and analyze their content
2. Create new slides from natural language descriptions
3. Edit slide content (text, formatting)
4. Convert between formats (PPTX to NavSlides, Markdown to NavSlides)
5. Trigger exports (to HTML, PDF, PPTX)
6. Generate AI content (outline, translation) via existing /api/generate endpoint
7. Manage templates programmatically
8. Trigger live presentations
9. Query analytics data

#### 2.3 Relevant Existing Code

| File | MCP Relevance |
|---|---|
| server/index.js | REST API routes (CRUD, share, export) -- map to MCP tools |
| server/services/storage.js | File I/O for presentations -- expose as MCP resources |
| shared/src/htmlGenerator.js | Export pipeline -- expose as MCP tool |
| server/routes/share.js | Share token generation -- expose as MCP tool |
| client/src/utils/api.js | Client-side API calls -- reference for tool signatures |

### 3. Technical Approach

#### 3.1 Integration Options

| Option | Location | Pros | Cons |
|---|---|---|---|
| A. Standalone MCP server | packages/mcp-server/ | Fully isolated; own package.json; no impact on main server | Duplicates Express API logic; needs separate process + port |
| B. Express middleware | server/index.js | Single process; reuses existing routes; simple | Pollutes server with MCP concepts; no stdio transport |
| C. Workspace package | packages/mcp/ | Clean separation; workspace symlink; TypeScript-ready | Requires splitting some server logic into shared; most complex setup |

Recommendation: Option C for production (best architecture), but start with Option A for rapid prototyping.

#### 3.2 Proposed Tool List (9 tools)

- list_presentations: List all presentations. No input.
- read_presentation: Retrieve full JSON by ID. Input: { id: string }.
- create_presentation: Build from structured data. Input: { title: string, slides: array }.
- update_slide_content: Modify element text. Input: { presentationId, slideIndex, elementId, content }.
- export_presentation: Export to HTML/PDF/PPTX. Input: { id: string, format: html | pdf | pptx }.
- import_pptx: Convert PPTX to NavSlides. Input: { filePath: string }.
- generate_outline: AI outline from topic. Input: { topic: string, slideCount?: number }.
- get_analytics: Analytics for a presentation. Input: { id: string }.
- start_live_presentation: Start live and get room code. Input: { presentationId: string }.

#### 3.3 MCP Resources

- navslides://presentations: List of all presentation IDs and titles
- navslides://presentation/{id}: Full presentation JSON
- navslides://analytics/{id}: Analytics data for a presentation
- navslides://templates: List of available templates

#### 3.4 MCP Prompts

- create_presentation: Create from topic or description. Arguments: { topic: string (required), style: string (optional) }.
- improve_slides: Improve content and layout. Arguments: { presentationId: string (required), instructions: string (required) }.

#### 3.5 Transport Strategy

For Claude Desktop local development: use stdio transport. Configure Claude Desktop to point to node packages/mcp/server.js.

For production/server: use Streamable HTTP transport. Add POST /mcp endpoint on existing Express server using the MCP SDK.

### 4. Data Model / API Design

MCP tools wrap existing REST API endpoints. No new data model needed.

#### 4.1 Tool-to-API Mapping

| MCP Tool | Underlying API |
|---|---|
| list_presentations | GET /api/presentations |
| read_presentation | GET /api/presentations/:id |
| create_presentation | POST /api/presentations |
| update_slide_content | PUT /api/presentations/:id |
| export_presentation | GET /api/export/:id |
| import_pptx | POST /api/import/pptx |
| generate_outline | POST /api/generate |
| get_analytics | GET /api/analytics/:id |
| start_live_presentation | Socket.IO presenter-join |

#### 4.2 Authentication

MCP tools require a server API key. Use X-API-Key header for HTTP transport (matches existing server auth pattern). No auth needed for stdio transport.

### 5. UI/UX Considerations

MCP integration is primarily a developer/AI-agent feature with no direct user-facing UI.

- Settings page: Add MCP Server section -- enable/disable, server URL, API key management, connected agents
- No new UI for end users -- MCP is invisible to non-developer users
- Developer documentation: docs/mcp-integration.md explaining how to connect Claude Desktop or other MCP clients
- Security: MCP server has full CRUD access -- rate limiting, input validation, and audit logging needed

### 6. Implementation Steps

1. Create packages/mcp/ workspace package with npm init. Add @modelcontextprotocol/sdk dependency.
2. Implement tool handlers (packages/mcp/tools/*.js): One file per tool, wrapping existing server logic.
3. Create MCP server entry point (packages/mcp/server.js): Initialize Server, register all tools, resources, prompts.
4. Add Streamable HTTP transport (packages/mcp/http-server.js).
5. Add stdio transport (packages/mcp/cli.js).
6. Add npm run mcp:dev and npm run mcp:build scripts in root package.json.
7. Add MCP settings UI (SettingsPage.jsx).
8. Write docs/mcp-integration.md: Developer guide.
9. Add authentication layer: API key middleware for MCP HTTP endpoints.

### 7. Effort Estimate and YAGNI Assessment

| Dimension | Estimate |
|---|---|
| Backend complexity | Medium |
| Frontend complexity | Low (settings page only) |
| Effort | 1.5-2 weeks |
| YAGNI risk | MEDIUM-HIGH -- MCP is a developer/enterprise feature. Most users will never use it. It adds maintenance surface. Only worth doing if there is clear enterprise or AI-agent integration demand. |
| Priority | SKIP for v1.x -- revisit if enterprise interest emerges |
| Dependencies | None (can be standalone) |

YAGNI: Competitive analysis explicitly flags this as too niche for v1.x. For the general user base, this is completely invisible. The effort is moderate but the payoff is uncertain without actual enterprise demand.

Recommended approach: Do not implement in v1.x. If demand emerges, the workspace package approach (Option C) provides the cleanest long-term separation.

---


## Cross-Feature Summary

### Shared Infrastructure

| Component | Used By |
|---|---|
| shared/src/types/presentation.js | Feature A (SessionRecord), Feature B (ElementAnimation) |
| shared/src/htmlGenerator.js | Feature A (beacon injection), Feature B (CSS keyframes), Feature C (export tool) |
| server/routes/analytics.js | Feature A (extend), Feature C (analytics tool) |
| Socket.IO live presenter script | Feature A (session tracking) |
| AnimationTimeline.jsx | Feature B (3-column enhancement) |

### Recommended Implementation Order

If all three features were to be built:

| Order | Feature | Rationale |
|---|---|---|
| 1 | Feature A (Analytics) | Extends existing work. Biggest user value per effort. Backend-only changes minimize risk. |
| 2 | Feature B (Animations) | CSS keyframes + shared/type changes; defer UI panel. Can be done incrementally. |
| 3 | Feature C (MCP) | Only if enterprise demand materializes. Workspace package is cleanest architecture. |

### Features to Skip Per Competitive Analysis

| Feature | Reason |
|---|---|
| Real-time multi-user collaboration | Extreme complexity (CRDTs), explicitly non-roadmap |
| AI vibe editing (natural language) | banana-slides niche, adds LLM dependencies |
| Zone-based AI redraw | Gemini API cost, uncertain demand |
| Plugin/extension marketplace | Ecosystem play, explicitly non-roadmap |
| Mobile/tablet editing | Touch UX fundamentally different |
| Cloud SaaS version | Dilutes self-hostable brand |
| TypeScript full migration | Months of work, no user-facing benefit |
| Presentation recording | Many free tools do this better |

### Open Questions

1. Analytics priority: Should the focus be on live session tracking (Pipeline 2) or standalone view tracking (Pipeline 3)? Most users share links -- Pipeline 2 gives richer data but requires live presentation mode.

2. Animation scope: Is the AnimationTimeline 3-column UI worth the complexity, or should CSS keyframes be injected silently (no UI) and let users edit via direct JSON manipulation?

3. MCP timing: Is there actual enterprise demand for MCP integration, or is this purely speculative? Without demand, this is pure YAGNI.

4. Storage scalability: The current analytics.json flat-file approach works for under 1000 presentations. At what scale should this migrate to a proper database? No threshold has been defined.

5. Phase C dependency: All three features benefit from Phase C (SlideCanvas decomposition). Should they wait for Phase C completion, or proceed in parallel?

---

**Status:** DONE
**Summary:** Deep technical analysis of three proposed features: (A) Presentation Analytics with 3-pipeline data collection, extended API, and 7-step implementation; (B) Per-Element Animations with CSS keyframes taxonomy and 8-step build; (C) MCP integration with 9 tools, 4 resources, workspace package architecture, and 9-step implementation. YAGNI risk: MEDIUM-HIGH for all three. Priority: Analytics > Animations > MCP. Phase C dependency flagged for all three.

